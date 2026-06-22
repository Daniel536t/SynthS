import express, { Request, Response } from "express";
import routes from "./routes";

const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Synthscribe API running on Vercel"
  });
});

app.use("/api", routes);

export default app;
