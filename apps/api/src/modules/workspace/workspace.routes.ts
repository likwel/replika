import { Router } from "express";
import { workspaceController as c } from "./workspace.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { commentSchema, directMessageSchema, hideSchema, suggestSchema } from "./workspace.schema.js";

// Espace de gestion : publications, commentaires et messages de toutes les Pages / comptes
const router = Router();
router.use(authenticate);

router.get("/accounts", c.accounts);
router.get("/posts", c.posts); // ?accounts=id1,id2
router.get("/conversations", c.conversations); // ?accounts=id1,id2

router.get("/accounts/:accountId/posts/:postId", c.post);
router.get("/accounts/:accountId/posts/:postId/comments", c.comments);
router.post("/accounts/:accountId/posts/:postId/comments", validate(commentSchema), c.commentOnPost);
router.post("/accounts/:accountId/comments/:commentId/replies", validate(commentSchema), c.replyToComment);
router.patch("/accounts/:accountId/comments/:commentId", validate(hideSchema), c.hideComment);
router.delete("/accounts/:accountId/comments/:commentId", c.deleteComment);

router.get("/accounts/:accountId/people/:personId/conversation", c.conversationWith);
router.get("/accounts/:accountId/conversations/:conversationId", c.conversation);
router.post("/accounts/:accountId/conversations/:conversationId/messages", validate(directMessageSchema), c.sendMessage);

router.post("/accounts/:accountId/suggest", validate(suggestSchema), c.suggest);

export default router;
