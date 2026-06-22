import { mxmGet } from "./client";

interface TranslationResponse {
  lyrics: {
    lyrics_id: number;
    lyrics_body: string;
    lyrics_language: string;
    lyrics_translated?: {
      lyrics_body: string;
      selected_language: string;
    };
  };
}

export interface TranslatedLyrics {
  original: string;
  translated: string;
  language: string;
}

export async function getTranslations(trackId: number, language?: string): Promise<TranslatedLyrics | null> {
  const params: Record<string, string> = {
    track_id: String(trackId),
  };
  if (language) params.selected_language = language;

  const body = await mxmGet<TranslationResponse>("track.lyrics.translation.get", params);
  
  if (!body.lyrics?.lyrics_translated?.lyrics_body) return null;
  
  return {
    original: body.lyrics.lyrics_body,
    translated: body.lyrics.lyrics_translated.lyrics_body,
    language: body.lyrics.lyrics_translated.selected_language || language || "unknown",
  };
}
