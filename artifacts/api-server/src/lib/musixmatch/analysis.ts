import { mxmGet } from "./client";

export interface AnalysisResult {
  meaning?: {
    explanation: string;
  };
  moods?: {
    main_moods: string[];
  };
  themes?: {
    main_themes: Array<{
      theme: string;
      quotes: string[];
    }>;
  };
  rating?: {
    audience: string;
    descriptor: string;
  };
  language_detection?: {
    languages: Array<{
      language_name: string;
      language_iso_code_1: string;
      percentage: number;
    }>;
  };
  entities?: {
    entity_list: Array<{
      entity_name: string;
      categories: string[];
      occurrences: number;
    }>;
  };
  moderation?: {
    needs_moderation: boolean;
    categories: Array<{
      category: string;
      is_present: boolean;
      score: number;
    }>;
  };
  religion?: {
    has_references: boolean;
    referenced_religions?: string[];
  };
}

export async function getAnalysis(trackId: number): Promise<AnalysisResult> {
  const body = await mxmGet<{ analysis: AnalysisResult }>("track.lyrics.analysis.get", {
    track_id: String(trackId),
  });
  return body.analysis;
}

export async function searchByVibe(vibe: string): Promise<Array<{ trackId: number; name: string; artist: string; moods: string[] }>> {
  // Search for tracks matching the vibe, then analyze them
  const { mxmGet: get } = await import("./client");
  
  const searchBody = await get<{
    track_list: Array<{
      track: {
        track_id: number;
        track_name: string;
        artist_name: string;
      };
    }>;
  }>("track.search", {
    q_track: vibe,
    page_size: "5",
    s_track_rating: "desc",
  });

  const results = await Promise.all(
    searchBody.track_list.map(async ({ track }) => {
      try {
        const analysis = await getAnalysis(track.track_id);
        return {
          trackId: track.track_id,
          name: track.track_name,
          artist: track.artist_name,
          moods: analysis.moods?.main_moods || [],
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
