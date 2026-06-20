---
name: SynthScribe backing-engine coupling
description: The per-generation backing "engine" toggle (musicgen|elevenlabs) is a hand-maintained allowlist plus a DB column, spread across many files.
---

# SynthScribe backing engine selection

Each project stores a backing `engine` chosen per generation. Current UI values:
`musicgen` (default) and `elevenlabs`. Legacy values `gpu` and `arranger` are NOT
offered in the UI but MUST stay in the OpenAPI `Engine` enum so old DB rows still
deserialize through `GetProjectResponse.parse` (responses serialize the stored
engine via `serialize.ts`); dropping them from the enum 500s old projects.

Adding/changing engine values touches a spread similar to vibes:
1. `lib/api-spec/openapi.yaml` — `Engine` enum (keep legacy values for response
   compat) → run `pnpm --filter @workspace/api-spec run codegen`.
2. `lib/db/src/schema/projects.ts` — `engine` text column default → `pnpm --filter @workspace/db run push`.
3. `artifacts/api-server/src/routes/projects.ts` — hand-maintained `ENGINES` Set
   allowlist (only the values accepted for NEW projects) + the `?? "musicgen"` default.
4. `artifacts/synthscribe/src/pages/Home.tsx` — engine picker array + form default.
(`serialize.ts` just passes `engine` through; no per-value change needed there.)

**Why:** pipeline routing is `(engine === "musicgen" || engine === "gpu") && modalConfigured()`
→ Modal MusicGen with graceful ElevenLabs fallback; everything else (incl. legacy
`arranger`) → ElevenLabs. The raw hum is mixed over the bed in BOTH modes, so only
the backing bed differs — that is what makes A/B comparison on the same hum meaningful.

**How to apply:** default is `musicgen` to restore the original loved behavior. The
orval zod schema rejects bad enum values before the `ENGINES` Set check runs, so the
Set is defense-in-depth, not the primary validator. New-project validation and the
response enum are intentionally asymmetric (Set is narrow, enum is wide).
