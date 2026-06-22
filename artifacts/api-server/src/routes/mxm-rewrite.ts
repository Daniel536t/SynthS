import { Router, type IRouter, type Request, type Response } from "express";
import { getRichsync } from "../lib/musixmatch/search";
import { rewriteLyrics } from "../lib/nvidia";
import { fingerprintLyrics } from "../lib/musixmatch/fingerprint";
import { mxmGet } from "../lib/musixmatch/client";

const router: IRouter = Router();

async function getLyricsText(trackId: number): Promise<string | null> {
  // Try richsync first
  try {
    const synced = await getRichsync(trackId);
    if (synced && synced.length > 0) {
      return synced.map((l) => l.x).join("\n");
    }
  } catch {}
  
  // Fall back to plain lyrics
  try {
    const body = await mxmGet<{ lyrics: { lyrics_body: string } }>("track.lyrics.get", {
      track_id: String(trackId),
    });
    if (body?.lyrics?.lyrics_body) {
      return body.lyrics.lyrics_body.split("...\n\n*******")[0].trim();
    }
  } catch {}
  
  return null;
}

router.post("/mxm/rewrite", async (req: Request, res: Response): Promise<void> => {
  try {
    const { track_id, theme, vibe } = req.body;
    
    if (!track_id || typeof track_id !== "number") {
      res.status(400).json({ error: "Missing track_id" });
      return;
    }
    if (!theme || typeof theme !== "string") {
      res.status(400).json({ error: "Missing theme" });
      return;
    }
    if (!vibe || typeof vibe !== "string") {
      res.status(400).json({ error: "Missing vibe" });
      return;
    }

    const originalLyrics = await getLyricsText(track_id);
    if (!originalLyrics) {
      res.status(404).json({ error: "No lyrics found for this track" });
      return;
    }

    const rewritten = await rewriteLyrics({
      originalLyrics,
      theme,
      vibe,
    });

    let fingerprint: unknown[] = [];
    try {
      fingerprint = await fingerprintLyrics(rewritten);
    } catch {}

    res.json({
      original: originalLyrics.slice(0, 500),
      rewritten,
      fingerprint,
    });
  } catch (error) {
    console.error("MXM rewrite error:", error);
    res.status(500).json({ error: "Rewrite failed" });
  }
});

export default router;
