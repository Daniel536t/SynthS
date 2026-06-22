import { useState, useEffect } from "react";
import { Lightbulb, Music, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface VibeTrack {
  trackId: number;
  name: string;
  artist: string;
  moods: string[];
}

export function MxmVibeSuggestions({ vibe }: { vibe: string }) {
  const [tracks, setTracks] = useState<VibeTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!vibe || vibe === fetched) return;
    const fetchVibe = async () => {
      setLoading(true);
      setFetched(vibe);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/mxm/vibe?q=${encodeURIComponent(vibe)}`);
        if (res.ok) {
          const data: VibeTrack[] = await res.json();
          setTracks(data.slice(0, 3));
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchVibe();
  }, [vibe, fetched]);

  if (!tracks.length && !loading) return null;

  return (
    <Card className="border-primary/10 bg-primary/5 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          Vibe inspiration
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Finding inspiration...
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((t) => (
              <div key={t.trackId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {t.moods.slice(0, 2).map((m) => (
                    <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
