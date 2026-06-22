import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import storageRouter from "./storage";
import mxmRouter from "./mxm";
import mxmRewriteRouter from "./mxm-rewrite";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(storageRouter);
router.use(mxmRouter);
router.use(mxmRewriteRouter);

export default router;
