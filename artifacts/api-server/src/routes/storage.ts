import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const router: IRouter = Router();
const STORAGE_ROOT = process.env.PRIVATE_OBJECT_DIR || "/home/ubuntu/synthscribe-audio/private";

router.get("/storage/objects/*path", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = wildcardPath.replace(/^objects\//, "");
    const fullPath = path.join(STORAGE_ROOT, objectPath);

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    const stat = fs.statSync(fullPath);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "audio/wav");

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (error) {
    console.error("Error serving object:", error);
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
