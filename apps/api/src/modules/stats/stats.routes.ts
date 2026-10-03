import { Router } from "express";
import { statsController } from "./stats.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

// Statistiques : vue globale, engagement quotidien, rapports par compte et par règle
const router = Router();
router.use(authenticate);

router.get("/overview", statsController.overview);
router.get("/engagement", statsController.engagement);
router.get("/accounts", statsController.accounts);
router.get("/rules", statsController.rules);

export default router;
