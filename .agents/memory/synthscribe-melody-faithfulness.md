---
name: SynthScribe melody faithfulness
description: How to make the generated song actually reproduce the hummed notes — extraction, conditioning, and mixing rules.
---

# Making SynthScribe actually reproduce the hummed melody

Neither AI path reproduces the user's tune on its own: MusicGen-melody conditions on a
loose *chroma* contour and improvises away from it (with `do_sample=True` it drifts),
and the ElevenLabs Music path ignores the hum entirely (text-prompt only). So a song
built only from those will never contain the user's actual notes ("it's not even my
melody").

**The architecture that works (the clean melody is the single source of truth):**
1. `transcribe.py` extracts notes from the hum (pyin → `notes = [[startSec, durSec, midi], ...]`).
2. `render_melody.py` synthesizes those notes into a clean lead WAV (additive tone + ADSR +
   vibrato), looped to fill the song.
3. That **clean lead** is used for BOTH:
   - conditioning the GPU backing (send the lead WAV to Modal, *never the raw hum*), and
   - the dominant melodic line in the final mix (lead gain 1.0, backing ~0.4).
4. The raw hum is NEVER used as audio anywhere in output. No notes → ship vibe-only
   backing (never raw hum).

**Why the raw hum must not be conditioned-on or mixed-in:** it is breathy and full of
octave/pitch noise. Conditioning MusicGen on it produced an incoherent bed; mixing it in
produced an unsynced clashing layer. Garbage in → garbage out, faithfully rendered.

## pyin extraction is fragile — the post-processing is what makes it clean
A naive `librosa.pyin` with a wide range (e.g. FMAX ~1050) produces **octave errors +
chromatic staircases** — a real hum centered on B3 came out spanning C♯3→G♯5 (3 octaves).
The synth lead then renders that chaos faithfully. The hardening that fixes it:
- Search a **wide** band (FMIN 70, FMAX 1000) so pyin can lock the fundamental, THEN
  correct errors in post — narrowing the range instead just loses real notes.
- **Energy + confidence gate**: keep a frame only if `voiced_prob > ~0.25` AND
  `rms > max(0.02, mean_rms*0.6)`. Hums are breathy; the RMS gate drops inter-note breath.
- **Octave folding**: fold every voiced frame to within ±6 semitones of the global median
  MIDI. This is what kills the staircase and keeps the line in one octave.
- **Median-filter within each contiguous voiced run** (kernel ≤5) before quantizing.
- Then key-snap, stability-segment (min ~0.10s), merge same-pitch gaps, gentle 16th-grid
  timing quantize.
- **Known limitation:** global-median ±6 fold can over-correct genuinely wide-interval
  melodies; for hums it's the right tradeoff. A phrase-local/running reference would be
  more general (see follow-up).

## Library choice
Hardened **pyin (librosa)** chosen over Spotify **Basic Pitch** despite Basic Pitch being
the user's suggestion: Basic Pitch pulls TensorFlow/onnxruntime which conflicts with the
api-server's numpy 2.x (librosa 0.11 needs numpy 2). The hardened pyin produces a clean
single-octave melody from real hums with zero new heavy deps. Revisit Basic Pitch only if
pyin proves insufficient on wider-range melodies AND the dep conflict is resolved.

**Constraint:** the lead is quantized but the AI bed's tempo can't be forced, so tight
beat-lock between lead and bed isn't guaranteed — prefer melody faithfulness over rhythmic
sync. All stages degrade gracefully.

**Verify on REAL hums, not synthetic tones** — synthetic sines hide the octave/breath
problems that only show up on actual breathy human humming. Keep a real hum fixture.
