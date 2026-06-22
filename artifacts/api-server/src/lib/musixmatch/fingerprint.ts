import { mxmPost } from "./client";

interface FingerprintResult {
  track_list: Array<{
    similarity: number;
    track: {
      track_id: number;
      track_name: string;
      artist_name: string;
      album_name: string;
      track_spotify_id?: string;
      primary_genres: {
        music_genre_list: Array<{
          music_genre: { music_genre_name: string };
        }>;
      };
    };
  }>;
}

export interface FingerprintMatch {
  similarity: number;
  trackId: number;
  name: string;
  artist: string;
  album: string;
  genres: string[];
  spotifyId?: string;
}

export async function fingerprintLyrics(text: string): Promise<FingerprintMatch[]> {
  const body = await mxmPost<FingerprintResult>("track.lyrics.fingerprint.post", {
    data: { text },
  });

  return body.track_list.map(({ similarity, track }) => ({
    similarity: Math.round(similarity * 100) / 100,
    trackId: track.track_id,
    name: track.track_name,
    artist: track.artist_name,
    album: track.album_name,
    genres: track.primary_genres.music_genre_list.map((g) => g.music_genre.music_genre_name),
    spotifyId: track.track_spotify_id,
  }));
}
