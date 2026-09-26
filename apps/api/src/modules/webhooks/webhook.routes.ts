import { Router } from "express";
import { webhookController } from "./webhook.controller.js";

const router = Router();

// Pas d'auth JWT : Meta appelle directement, l'authenticité est vérifiée par signature
router.get("/meta", webhookController.verify);
router.post("/meta", webhookController.receive);

export default router;
