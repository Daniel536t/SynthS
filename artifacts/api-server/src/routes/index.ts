import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import storageRouter from "./storage";
import mxmRouter from "./mxm";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(storageRouter);
router.use(mxmRouter);

export default router;
