import { Router } from "express";
import { historyController } from "./history.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authenticate);
router.get("/", historyController.list);
router.get("/counts", historyController.counts);

export default router;
