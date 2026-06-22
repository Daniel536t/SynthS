import { useState, useEffect } from "react";
import { Fingerprint, Music, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FingerprintMatch {
  similarity: number;
  trackId: number;
  name: string;
  artist: string;
  album: string;
  genres: string[];
}

export function MxmFingerprint({ lyrics, onMatch }: { lyrics: string | null; onMatch?: (match: FingerprintMatch) => void }) {
  const [matches, setMatches] = useState<FingerprintMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!lyrics || lyrics.trim().length < 10 || checked) return;
    
    const check = async () => {
      setLoading(true);
      setChecked(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/mxm/fingerprint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: lyrics }),
        });
        if (res.ok) {
          const data: FingerprintMatch[] = await res.json();
          setMatches(data.slice(0, 5));
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    check();
  }, [lyrics, checked]);

  if (!lyrics || lyrics.trim().length < 10) return null;
  if (!matches.length && !loading) return null;

  return (
    <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2 text-amber-400">
          <Fingerprint className="w-5 h-5" />
          Similar songs found
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking...
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div
                key={m.trackId}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-amber-500/10 cursor-pointer transition-colors"
                onClick={() => onMatch?.(m)}
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.artist}</p>
                </div>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                  {m.similarity}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
