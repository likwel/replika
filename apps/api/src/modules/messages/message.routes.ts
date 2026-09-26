import { Router } from "express";
import { messageController } from "./message.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { replySchema } from "./message.schema.js";

const router = Router();
router.use(authenticate);

router.get("/", messageController.list);
router.post("/:id/reply", validate(replySchema), messageController.reply);
router.post("/:id/ai-suggest", messageController.aiSuggest);
router.post("/:id/escalate", messageController.escalate);
router.post("/:id/ignore", messageController.ignore);

export default router;