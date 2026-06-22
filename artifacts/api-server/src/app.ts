import express, { Request, Response } from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

app.use(cors({
  origin: ["https://synth-s-synthscribe.vercel.app", "https://synthscribe.duckdns.org"],
  credentials: true,
}));

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Synthscribe API running on Vercel"
  });
});

app.use("/api", routes);

export default app;
