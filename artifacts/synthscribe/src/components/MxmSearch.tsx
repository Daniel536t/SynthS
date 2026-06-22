import { useState } from "react";
import { Search, Music, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface TrackInfo {
  trackId: number;
  name: string;
  artist: string;
  album: string;
  genres: string[];
}

interface SyncedLyric {
  ts: number;
  te: number;
  x: string;
}

interface SearchResult {
  track: TrackInfo;
  syncedLyrics: SyncedLyric[] | null;
}

export function MxmSearch({ onSelectLyrics, onTrackFound }: { onSelectLyrics: (lyrics: string) => void }) {
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ q: query });
      if (artist.trim()) params.set("artist", artist);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/mxm/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data: SearchResult = await res.json();
      setResult(data);
      if (onTrackFound && data?.track) onTrackFound(data.track.trackId, data.track.name);
      if (!data?.track) setError("No results found");
    } catch (e) {
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseLyrics = () => {
    if (result?.syncedLyrics) {
      const plainText = result.syncedLyrics.map((l) => l.x).join("\n");
      onSelectLyrics(plainText);
    }
  };

  return (
    <Card className="border-white/10 bg-background/30 backdrop-blur">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Find song lyrics
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="Song name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Input
            placeholder="Artist (optional)"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-1/3"
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result?.track && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Music className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold">{result.track.name}</p>
                <p className="text-sm text-muted-foreground">{result.track.artist} • {result.track.album}</p>
                <div className="flex gap-1 mt-1">
                  {result.track.genres.map((g) => (
                    <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{g}</span>
                  ))}
                </div>
              </div>
            </div>

            {result.syncedLyrics && (
              <>
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {showLyrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showLyrics ? "Hide" : "Show"} synced lyrics
                </button>
                {showLyrics && (
                  <div className="max-h-48 overflow-y-auto rounded-xl bg-background/50 p-3 text-sm space-y-1">
                    {result.syncedLyrics.map((l, i) => (
                      <p key={i} className="text-muted-foreground">{l.x}</p>
                    ))}
                  </div>
                )}
                <Button onClick={handleUseLyrics} variant="secondary" size="sm" className="w-full">
                  <Music className="w-4 h-4 mr-1" /> Use these lyrics
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
