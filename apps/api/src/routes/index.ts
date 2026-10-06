import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import accountRoutes from "../modules/accounts/account.routes.js";
import messageRoutes from "../modules/messages/message.routes.js";
import automationRoutes from "../modules/automation/automation.routes.js";
import historyRoutes from "../modules/history/history.routes.js";
import facebookRoutes from "../modules/facebook/facebook.routes.js";
import webhookRoutes from "../modules/webhooks/webhook.routes.js";
import aiRoutes from "../modules/ai/ai.routes.js";
import profileRoutes from "../modules/profile/profile.routes.js";
import workspaceRoutes from "../modules/workspace/workspace.routes.js";
import uploadRoutes from "../modules/uploads/upload.routes.js";
import scheduleRoutes from "../modules/schedules/schedule.routes.js";
import liveRoutes from "../modules/lives/live.routes.js";
import leadRoutes from "../modules/leads/lead.routes.js";
import statsRoutes from "../modules/stats/stats.routes.js";
import marketplaceRoutes from "../modules/marketplace/marketplace.routes.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
router.use("/auth", authRoutes);
router.use("/accounts", accountRoutes);
router.use("/messages", messageRoutes);
router.use("/automation", automationRoutes);
router.use("/history", historyRoutes);
router.use("/facebook", facebookRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/ai", aiRoutes);
router.use("/profile", profileRoutes);
router.use("/workspace", workspaceRoutes);
router.use("/uploads", uploadRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/lives", liveRoutes);
router.use("/leads", leadRoutes);
router.use("/stats", statsRoutes);
router.use("/marketplace", marketplaceRoutes);

export default router;