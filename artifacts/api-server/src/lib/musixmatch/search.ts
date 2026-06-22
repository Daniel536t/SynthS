import { mxmGet } from "./client";

interface TrackSearchResult {
  track_list: Array<{
    track: {
      track_id: number;
      track_name: string;
      artist_name: string;
      album_name: string;
      track_spotify_id?: string;
      track_isrc?: string;
      track_length: number;
      has_richsync: number;
      has_lyrics: number;
      primary_genres: {
        music_genre_list: Array<{
          music_genre: { music_genre_name: string };
        }>;
      };
    };
  }>;
}

interface RichsyncResult {
  richsync: {
    richsync_body: string; // JSON string of synced lyrics
  };
}

export interface SyncedLyric {
  ts: number;   // timestamp in seconds
  te: number;   // end time
  l: Array<{
    c: string;  // character
    o: number;  // offset in ms from ts
    d: number;  // duration in ms
  }>;
  x: string;    // full word
}

export interface TrackInfo {
  trackId: number;
  name: string;
  artist: string;
  album: string;
  genres: string[];
  spotifyId?: string;
  isrc?: string;
  duration: number;
}

export interface SearchResult {
  track: TrackInfo;
  syncedLyrics: SyncedLyric[] | null;
}

export async function searchTrack(query: string, artist?: string): Promise<TrackInfo[]> {
  const params: Record<string, string> = {
    q_track: query,
    page_size: "10",
    s_track_rating: "desc",
  };
  if (artist) params.q_artist = artist;

  const body = await mxmGet<TrackSearchResult>("track.search", params);
  return body.track_list.map(({ track }) => ({
    trackId: track.track_id,
    name: track.track_name,
    artist: track.artist_name,
    album: track.album_name,
    genres: track.primary_genres.music_genre_list.map((g) => g.music_genre.music_genre_name),
    spotifyId: track.track_spotify_id,
    isrc: track.track_isrc,
    duration: track.track_length,
  }));
}

export async function getRichsync(trackId: number): Promise<SyncedLyric[] | null> {
  const body = await mxmGet<RichsyncResult>("track.richsync.get", {
    track_id: String(trackId),
  });

  if (!body.richsync?.richsync_body) return null;

  try {
    return JSON.parse(body.richsync.richsync_body) as SyncedLyric[];
  } catch {
    return null;
  }
}

export async function searchWithLyrics(query: string, artist?: string): Promise<SearchResult | null> {
  const tracks = await searchTrack(query, artist);
  if (tracks.length === 0) return null;

  const track = tracks[0];
  const syncedLyrics = await getRichsync(track.trackId);

  return { track, syncedLyrics };
}
