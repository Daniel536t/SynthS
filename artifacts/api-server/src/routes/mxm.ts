import { Router, type IRouter, type Request, type Response } from "express";
import { searchTrack, getRichsync, searchWithLyrics } from "../lib/musixmatch/search";
import { fingerprintLyrics } from "../lib/musixmatch/fingerprint";
import { getAnalysis, searchByVibe } from "../lib/musixmatch/analysis";
import { getTranslations } from "../lib/musixmatch/translations";

const router: IRouter = Router();

router.get("/mxm/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, artist } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Missing query parameter 'q'" });
      return;
    }
    const result = await searchWithLyrics(q, typeof artist === "string" ? artist : undefined);
    res.json(result);
  } catch (error) {
    console.error("MXM search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/mxm/fingerprint", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.length < 10) {
      res.status(400).json({ error: "Text must be at least 10 characters" });
      return;
    }
    const matches = await fingerprintLyrics(text);
    res.json(matches);
  } catch (error) {
    console.error("MXM fingerprint error:", error);
    res.status(500).json({ error: "Fingerprint failed" });
  }
});

router.get("/mxm/analysis", async (req: Request, res: Response): Promise<void> => {
  try {
    const { track_id } = req.query;
    if (!track_id || typeof track_id !== "string") {
      res.status(400).json({ error: "Missing track_id" });
      return;
    }
    const analysis = await getAnalysis(Number(track_id));
    res.json(analysis);
  } catch (error) {
    console.error("MXM analysis error:", error);
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.get("/mxm/vibe", async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Missing vibe query" });
      return;
    }
    const tracks = await searchByVibe(q);
    res.json(tracks);
  } catch (error) {
    console.error("MXM vibe search error:", error);
    res.status(500).json({ error: "Vibe search failed" });
  }
});

router.get("/mxm/translate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { track_id, language } = req.query;
    if (!track_id || typeof track_id !== "string") {
      res.status(400).json({ error: "Missing track_id" });
      return;
    }
    const translation = await getTranslations(
      Number(track_id),
      typeof language === "string" ? language : undefined,
    );
    if (!translation) {
      res.status(404).json({ error: "No translation available" });
      return;
    }
    res.json(translation);
  } catch (error) {
    console.error("MXM translate error:", error);
    res.status(500).json({ error: "Translation failed" });
  }
});

export default router;
