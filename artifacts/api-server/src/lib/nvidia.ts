import { logger } from "./logger";

// SynthScribe drafts lyrics with the user's own NVIDIA-hosted model through the
// OpenAI-compatible endpoint at integrate.api.nvidia.com. The model name is
// swappable via NVIDIA_MODEL so we can move between hosted models without code
// changes.
const BASE = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL || "mistralai/mistral-medium-3.5-128b";

const TIMEOUT_MS = 60_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function apiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY is not set");
  return key;
}

/** Returns true when the NVIDIA model is configured and usable. */
export function nvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

/**
 * Call the NVIDIA OpenAI-compatible chat completions endpoint and return the
 * assistant's message text. Throws on transport or API errors so callers can
 * fall back gracefully.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts?.temperature ?? 0.8,
      max_tokens: opts?.maxTokens ?? 900,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NVIDIA chat ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    logger.warn({ model: MODEL }, "NVIDIA returned empty content");
    throw new Error("NVIDIA returned an empty response");
  }
  return content;
}

/**
 * Rewrite existing lyrics into completely original lyrics that preserve the
 * structure and emotional tone but avoid copyright issues.
 */
export async function rewriteLyrics(opts: {
  originalLyrics: string;
  theme: string;
  vibe: string;
}): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a professional songwriter. Rewrite the given lyrics to be completely original.
- Keep the same number of lines and approximate syllable count per line
- Maintain the emotional tone and rhythm
- Change the words, metaphors, and specific phrases entirely
- Theme: ${opts.theme}
- Musical style: ${opts.vibe}
- Output ONLY the rewritten lyrics. No explanations, no titles, no markdown formatting.
- Make them sound natural and singable.`,
    },
    {
      role: "user",
      content: `Rewrite these lyrics to be about "${opts.theme}":\n\n${opts.originalLyrics}`,
    },
  ];

  const rewritten = await chatComplete(messages, { temperature: 0.9, maxTokens: 1200 });
  return rewritten.trim();
}
