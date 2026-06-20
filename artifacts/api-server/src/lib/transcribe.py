import json
import sys
import warnings

warnings.filterwarnings("ignore")

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

# Scale degree semitone offsets from the tonic.
MAJOR_SCALE = {0, 2, 4, 5, 7, 9, 11}
MINOR_SCALE = {0, 2, 3, 5, 7, 8, 10}

# pyin search range. We deliberately search a WIDE band so pyin can lock onto
# the fundamental, then fold octave-jump errors back toward the melody's median
# register afterwards (see extract_notes). A naive narrow range loses real notes;
# a naive wide range produces the multi-octave "staircase" garbage we used to
# ship. The post-processing below is what makes the result clean.
FMIN = 70.0
FMAX = 1000.0
MIN_NOTE_SECONDS = 0.10  # drop blips shorter than this
# A hummed note must be both pitch-confident AND have real energy. Breath noise
# between notes is low-energy, so an RMS gate removes it before segmentation.
VOICED_PROB_MIN = 0.25
# Fold any frame more than this many semitones from the running melody median
# back by whole octaves. Keeps the melody inside a single octave band so the
# synthesized lead plays one coherent line instead of jumping octaves.
OCTAVE_FOLD_SEMITONES = 6


def correlate(chroma, profile, shift):
    rotated = profile[-shift:] + profile[:-shift] if shift else profile
    n = len(chroma)
    mc = sum(chroma) / n
    mp = sum(rotated) / n
    num = sum((chroma[i] - mc) * (rotated[i] - mp) for i in range(n))
    den_c = sum((chroma[i] - mc) ** 2 for i in range(n)) ** 0.5
    den_p = sum((rotated[i] - mp) ** 2 for i in range(n)) ** 0.5
    if den_c == 0 or den_p == 0:
        return 0.0
    return num / (den_c * den_p)


def detect_key(chroma_mean):
    best = (-2.0, 0, "major")
    for shift in range(12):
        cmaj = correlate(chroma_mean, MAJOR_PROFILE, shift)
        cmin = correlate(chroma_mean, MINOR_PROFILE, shift)
        if cmaj > best[0]:
            best = (cmaj, shift, "major")
        if cmin > best[0]:
            best = (cmin, shift, "minor")
    return best[1], best[2]  # (root_pitch_class, mode)


def snap_to_key(midi, root_pc, mode):
    """Nudge a clearly off-key note onto the nearest scale tone (max 1 semitone)."""
    scale = MAJOR_SCALE if mode == "major" else MINOR_SCALE
    degree = (int(midi) - root_pc) % 12
    if degree in scale:
        return int(midi)
    for delta in (-1, 1):
        if ((degree + delta) % 12) in scale:
            return int(midi) + delta
    return int(midi)


def extract_notes(y, sr, root_pc, mode, tempo):
    import librosa
    import numpy as np
    from scipy.signal import medfilt

    frame_length = 2048
    hop_length = 512

    # pyin returns (f0, voiced_flag, voiced_prob). We use voiced_prob (a soft
    # confidence) plus a per-frame energy gate rather than the hard voiced_flag,
    # which over-keeps breathy frames.
    f0, _voiced_flag, voiced_prob = librosa.pyin(
        y,
        fmin=FMIN,
        fmax=FMAX,
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length,
        fill_na=np.nan,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)
    hop = float(times[1] - times[0]) if len(times) > 1 else hop_length / sr

    rms = librosa.feature.rms(
        y=y, frame_length=frame_length, hop_length=hop_length
    )[0]
    rms = rms[: len(f0)]
    if len(rms) < len(f0):  # pad if rms came back short
        rms = np.pad(rms, (0, len(f0) - len(rms)), mode="edge")

    midi = librosa.hz_to_midi(f0)

    # A frame counts as a real hummed note only if pyin is confident AND there
    # is enough energy (drops inter-note breath/silence). The energy floor is
    # relative to the take's own loudness so quiet recordings still work.
    energy_floor = max(0.02, float(rms.mean()) * 0.6)
    voiced = (~np.isnan(midi)) & (voiced_prob > VOICED_PROB_MIN) & (rms > energy_floor)
    if not voiced.any():
        return []

    # --- Octave-error correction -------------------------------------------
    # pyin occasionally reports a note an octave (or two) off. Fold every voiced
    # frame to within OCTAVE_FOLD_SEMITONES of the melody's median register so
    # the line stays in one octave instead of leaping around.
    ref = float(np.median(midi[voiced]))
    corr = midi.copy()
    idx = np.where(voiced)[0]
    for i in idx:
        m = corr[i]
        while m - ref > OCTAVE_FOLD_SEMITONES:
            m -= 12
        while ref - m > OCTAVE_FOLD_SEMITONES:
            m += 12
        corr[i] = m

    # --- Smooth within each contiguous voiced run --------------------------
    # Median-filter the pitch contour inside each sung phrase to remove
    # single-frame jitter before we quantize to discrete notes.
    smooth = corr.copy()
    i = 0
    n_frames = len(corr)
    while i < n_frames:
        if not voiced[i]:
            i += 1
            continue
        j = i
        while j < n_frames and voiced[j]:
            j += 1
        run = corr[i:j]
        if len(run) >= 3:
            k = min(5, len(run))
            if k % 2 == 0:
                k -= 1
            if k >= 3:
                smooth[i:j] = medfilt(run, kernel_size=k)
        i = j

    # Frame -> quantized, key-snapped MIDI (or None when unvoiced).
    frame_midi = []
    for i in range(n_frames):
        if voiced[i] and not np.isnan(smooth[i]):
            m = int(round(float(smooth[i])))
            m = snap_to_key(m, root_pc, mode)
            frame_midi.append(m)
        else:
            frame_midi.append(None)

    # Group consecutive equal-pitch frames into notes.
    raw = []
    cur_midi = None
    start_t = 0.0
    for i, m in enumerate(frame_midi):
        if m != cur_midi:
            if cur_midi is not None:
                raw.append([start_t, times[i] - start_t, cur_midi])
            cur_midi = m
            start_t = times[i]
    if cur_midi is not None:
        raw.append([start_t, times[-1] + hop - start_t, cur_midi])

    # Keep only voiced notes long enough to matter.
    notes = [n for n in raw if n[2] is not None and n[1] >= MIN_NOTE_SECONDS]
    if not notes:
        return []

    # Trim leading silence so the melody starts at t=0.
    offset = notes[0][0]
    for n in notes:
        n[0] = round(n[0] - offset, 4)

    # Merge adjacent same-pitch notes separated by a tiny gap.
    merged = [notes[0]]
    for n in notes[1:]:
        prev = merged[-1]
        gap = n[0] - (prev[0] + prev[1])
        if n[2] == prev[2] and gap <= 0.06:
            prev[1] = round(n[0] + n[1] - prev[0], 4)
        else:
            merged.append(n)

    # Gentle timing quantization to a sixteenth-note grid (only if tempo is sane).
    if tempo and 40 <= tempo <= 220:
        grid = (60.0 / tempo) / 4.0
        for n in merged:
            n[0] = round(round(n[0] / grid) * grid, 4)
            steps = max(1, round(n[1] / grid))
            n[1] = round(steps * grid, 4)

    return [[float(s), float(d), int(m)] for s, d, m in merged]


def main(path):
    import librosa
    import numpy as np

    y, sr = librosa.load(path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo = 0.0
    try:
        t, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(np.atleast_1d(t)[0])
    except Exception:
        tempo = 0.0

    root_pc, mode, key = 0, "major", None
    try:
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1).tolist()
        root_pc, mode = detect_key(chroma_mean)
        key = f"{PITCH_CLASSES[root_pc]} {mode}"
    except Exception:
        key = None

    notes = []
    try:
        notes = extract_notes(y, sr, root_pc, mode, tempo)
    except Exception:
        notes = []

    print(
        json.dumps(
            {
                "key": key,
                "tempo": round(tempo, 1),
                "durationSeconds": round(duration, 2),
                "notes": notes,
            }
        )
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no path"}))
        sys.exit(1)
    try:
        main(sys.argv[1])
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
