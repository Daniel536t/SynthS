import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { logger } from "./logger";
import { uploadBuffer, downloadToBuffer } from "./storage";
import {
  normalizeHum,
  toWav,
  mixAndMaster,
  getDurationSeconds,
  type MixInput,
} from "./audio";
import { transcribeHum } from "./transcribe";
import { generateBacking, generateVocals } from "./elevenlabs";
import { modalConfigured, generateBackingFromHum } from "./musicgen";

type Stage =
  | "draft"
  | "transcribing"
  | "generating_backing"
  | "singing"
  | "mixing"
  | "complete"
  | "error";

interface PatchFields {
  stage?: Stage;
  progress?: number;
  message?: string | null;
  key?: string | null;
  tempo?: number | null;
  durationSeconds?: number | null;
  error?: string | null;
  humPath?: string | null;
  backingPath?: string | null;
  vocalsPath?: string | null;
  finalPath?: string | null;
}

async function patch(projectId: string, fields: PatchFields): Promise<void> {
  await db.update(projectsTable).set(fields).where(eq(projectsTable.id, projectId));
}

const DEFAULT_DURATION = 24; // seconds for generated stems

// The wordless ElevenLabs vocal layer is a second paid Music call. It is off by
// default to roughly halve per-request credit cost; set SYNTHSCRIBE_ENABLE_VOCALS=1
// (or "true") to re-enable it.
function vocalsEnabled(): boolean {
  const v = (process.env.SYNTHSCRIBE_ENABLE_VOCALS ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

// Resolve the stored engine value to a concrete backing path. New rows store
// "musicgen" or "elevenlabs"; old rows may still hold the legacy "gpu"
// (treated as musicgen) or "arranger" (the retired studio band -> elevenlabs).
function useGpuEngine(engine: string): boolean {
  return engine === "musicgen" || engine === "gpu";
}

export async function runPipeline(projectId: string): Promise<void> {
  const log = logger.child({ projectId });
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    if (!project) throw new Error("Project not found");
    if (!project.humPath) throw new Error("No hum uploaded");

    // 1. Transcribe -------------------------------------------------------
    // We normalize the raw recording and detect its key/tempo. The cleaned hum
    // itself is what we layer into the final mix (see step 4) — its melody calls
    // out at the start and then gives way to the AI band.
    await patch(projectId, {
      stage: "transcribing",
      progress: 15,
      message: "Listening to your melody",
      error: null,
    });
    const humRaw = await downloadToBuffer(project.humPath);
    const hum = await normalizeHum(humRaw);
    const humNormPath = await uploadBuffer(
      `synthscribe/${projectId}/hum.wav`,
      hum,
      "audio/wav",
    );
    const transcription = await transcribeHum(hum);
    const key = transcription.key ?? "C major";
    const tempo = transcription.tempo ?? 90;
    const humDuration = transcription.durationSeconds ?? (await getDurationSeconds(hum));
    const targetDuration = Math.max(24, Math.min(Math.round(humDuration * 3) || DEFAULT_DURATION, 30));
    log.info(
      { key, tempo, noteCount: transcription.notes.length },
      "Hum transcribed",
    );
    await patch(projectId, {
      humPath: humNormPath,
      key,
      tempo,
      progress: 30,
      message: `Detected ${key} at ${Math.round(tempo)} BPM`,
    });

    // 2. Backing track ----------------------------------------------------
    // The user picks the backing engine per generation:
    //   - "musicgen" (default): the Modal MusicGen-melody GPU worker, which
    //     conditions on the hum's chroma so the band follows the real tune.
    //   - "elevenlabs": the premium ElevenLabs Music model (prompted with the
    //     detected vibe/key/tempo).
    // MusicGen falls back to ElevenLabs if the GPU worker is unavailable.
    const useGpu = useGpuEngine(project.engine) && modalConfigured();
    await patch(projectId, {
      stage: "generating_backing",
      progress: 50,
      message: useGpu
        ? "Composing music around your hum"
        : "Producing your backing track",
    });
    const elevenlabsBacking = async (): Promise<Buffer> => {
      const raw = await generateBacking({
        vibe: project.vibe,
        key,
        tempo,
        lengthMs: targetDuration * 1000,
      });
      return toWav(raw);
    };
    let backing: Buffer;
    if (useGpu) {
      try {
        const raw = await generateBackingFromHum({
          hum,
          vibe: project.vibe,
          durationSeconds: targetDuration,
        });
        backing = await toWav(raw);
      } catch (err) {
        log.warn({ err }, "Modal backing failed, falling back to ElevenLabs");
        backing = await elevenlabsBacking();
      }
    } else {
      backing = await elevenlabsBacking();
    }
    const backingPath = await uploadBuffer(
      `synthscribe/${projectId}/backing.wav`,
      backing,
      "audio/wav",
    );
    await patch(projectId, { backingPath, progress: 65 });

    // 3. Vocals (optional, off by default) -------------------------------
    let vocals: Buffer | null = null;
    let vocalsPath: string | null = null;
    if (vocalsEnabled()) {
      await patch(projectId, {
        stage: "singing",
        progress: 72,
        message: "Adding a vocal layer",
      });
      try {
        const raw = await generateVocals({
          vibe: project.vibe,
          key,
          tempo,
          lengthMs: targetDuration * 1000,
        });
        vocals = await toWav(raw);
        vocalsPath = await uploadBuffer(
          `synthscribe/${projectId}/vocals.wav`,
          vocals,
          "audio/wav",
        );
        await patch(projectId, { vocalsPath, progress: 82 });
      } catch (err) {
        log.warn({ err }, "Vocal layer failed, continuing without it");
        await patch(projectId, { progress: 82 });
      }
    } else {
      await patch(projectId, { progress: 82 });
    }

    // 4. Mix & master -----------------------------------------------------
    // Layer the user's own hum (with a touch of reverb) over the AI backing.
    // Because the hum is short and the song is ~3x longer, the hum "calls out"
    // at the start and then melts into the generated band — the original, loved
    // SynthScribe sound. The AI bed sits just under it and carries the rest.
    await patch(projectId, {
      stage: "mixing",
      progress: 90,
      message: "Mixing and mastering",
    });
    const inputs: MixInput[] = [
      { buffer: backing, gain: 0.9 },
      { buffer: hum, gain: 0.85, reverb: true, fadeInSeconds: 0.1 },
    ];
    if (vocals) inputs.push({ buffer: vocals, gain: 0.6 });
    const master = await mixAndMaster(inputs);
    const finalPath = await uploadBuffer(
      `synthscribe/${projectId}/final.wav`,
      master,
      "audio/wav",
    );
    const finalDuration = await getDurationSeconds(master);

    await patch(projectId, {
      stage: "complete",
      progress: 100,
      message: "Your song is ready",
      finalPath,
      durationSeconds: finalDuration,
      error: null,
    });
    log.info("Pipeline complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    logger.error({ err, projectId }, "Pipeline failed");
    await patch(projectId, {
      stage: "error",
      message: "Something went wrong while making your song",
      error: message,
    });
  }
}
