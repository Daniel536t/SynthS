import { useState } from "react";
import { Wand2, Loader2, Music, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface FingerprintMatch {
  similarity: number;
  name: string;
  artist: string;
}

interface RewriteResult {
  original: string;
  rewritten: string;
  fingerprint: FingerprintMatch[];
}

export function MxmRewrite({ 
  trackId, 
  trackName, 
  vibe, 
  onUseLyrics 
}: { 
  trackId: number; 
  trackName: string; 
  vibe: string;
  onUseLyrics: (lyrics: string) => void;
}) {
  const [theme, setTheme] = useState("");
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRewrite = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/mxm/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: trackId, theme: theme.trim(), vibe }),
      });
      if (!res.ok) throw new Error("Rewrite failed");
      const data: RewriteResult = await res.json();
      setResult(data);
    } catch {
      setError("Rewrite failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-purple-500/20 bg-purple-500/5 backdrop-blur">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-purple-400">
          <Wand2 className="w-5 h-5" />
          Rewrite "{trackName}"
        </h3>
        
        <div className="flex gap-2">
          <Input
            placeholder="What should it be about? e.g. dancing under neon lights"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRewrite()}
            className="flex-1"
          />
          <Button onClick={handleRewrite} disabled={loading || !theme.trim()} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? "" : "Rewrite"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-purple-400 mb-1 font-medium">NVIDIA Rewrite</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{result.rewritten}</p>
            </div>

            {result.fingerprint.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Fingerprint className="w-3 h-3" /> Originality check
                </p>
                {result.fingerprint.slice(0, 3).map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">{m.name} — {m.artist}</span>
                    <span className="text-purple-400 font-bold ml-2">{m.similarity}%</span>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={() => onUseLyrics(result.rewritten)} variant="secondary" size="sm" className="w-full">
              <Music className="w-4 h-4 mr-1" /> Use rewritten lyrics
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
