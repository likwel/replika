import { Router } from "express";
import { facebookController } from "./facebook.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/connect", authenticate, facebookController.connect);
router.get("/callback", facebookController.callback); // pas d'auth : Meta appelle directement
router.get("/posts", authenticate, facebookController.posts);
router.get("/insights", authenticate, facebookController.insights);
router.get("/posts/:postId/comments", authenticate, facebookController.comments);
router.post("/posts/:postId/comments/:commentId/ai-reply", authenticate, facebookController.aiReply);

export default router;