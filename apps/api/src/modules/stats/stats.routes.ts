import { Router } from "express";
import { statsController } from "./stats.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePlanFeature } from "../../middlewares/plan.middleware.js";

// Statistiques : vue globale, engagement quotidien, rapports par compte et par règle
const router = Router();
router.use(authenticate);

// Vue globale : toutes les formules ; analyses détaillées : formule Pro et plus
const advanced = requirePlanFeature("advancedStats");

router.get("/overview", statsController.overview);
router.get("/engagement", advanced, statsController.engagement);
router.get("/accounts", advanced, statsController.accounts);
router.get("/rules", advanced, statsController.rules);
router.get("/revenue", advanced, statsController.revenue);

export default router;
