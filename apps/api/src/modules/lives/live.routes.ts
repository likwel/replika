import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import {
  createOrderSchema,
  createSessionSchema,
  detectSchema,
  markJpSchema,
  messageSchema,
  productsSchema,
  updateOrderSchema,
  updateSessionSchema,
} from "./live.schema.js";
import { explain, liveService } from "./live.service.js";
import { pollSession } from "./live.capture.js";

// Lives : sessions de vente, commentaires capturés et commandes JP
const router = Router();
router.use(authenticate);

const uid = (req: Request) => req.user!.userId;
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ status: "success", data });

router.get("/defaults", (_req, res) => ok(res, liveService.defaults()));
router.post("/detect", validate(detectSchema), (req, res) => ok(res, liveService.detect(req.body.text, req.body.keywords, req.body.products)));

router.get(
  "/sources",
  catchAsync(async (req, res) => {
    if (typeof req.query.accountId !== "string") throw new AppError("Compte requis", 422);
    ok(res, await liveService.sources(uid(req), req.query.accountId));
  })
);

router.get("/sessions", catchAsync(async (req, res) => ok(res, await liveService.listSessions(uid(req)))));
router.post(
  "/sessions",
  validate(createSessionSchema),
  catchAsync(async (req, res) => {
    const session = await liveService.createSession(uid(req), req.body);
    // Premier passage immédiat (commentaires déjà publiés, si demandé)
    void liveService.withAccount(uid(req), session.id).then(pollSession).catch(() => {});
    ok(res, session, 201);
  })
);
router.get("/sessions/:id", catchAsync(async (req, res) => ok(res, await liveService.getSession(uid(req), req.params.id))));
router.patch("/sessions/:id", validate(updateSessionSchema), catchAsync(async (req, res) => ok(res, await liveService.updateSession(uid(req), req.params.id, req.body))));
router.delete(
  "/sessions/:id",
  catchAsync(async (req, res) => {
    await liveService.removeSession(uid(req), req.params.id);
    res.status(204).send();
  })
);
router.put(
  "/sessions/:id/products",
  validate(productsSchema),
  catchAsync(async (req, res) => ok(res, await liveService.replaceProducts(uid(req), req.params.id, req.body.products)))
);
router.post(
  "/sessions/:id/sync",
  catchAsync(async (req, res) => {
    const session = await liveService.withAccount(uid(req), req.params.id);
    try {
      ok(res, { created: await pollSession(session) });
    } catch (e) {
      throw new AppError(`Lecture des commentaires impossible : ${explain(e)}`, 502);
    }
  })
);
router.get(
  "/sessions/:id/comments",
  catchAsync(async (req, res) => {
    const after = typeof req.query.after === "string" && !Number.isNaN(Date.parse(req.query.after)) ? req.query.after : undefined;
    ok(res, await liveService.comments(uid(req), req.params.id, after));
  })
);
router.post(
  "/sessions/:id/comments/:commentId/jp",
  validate(markJpSchema),
  catchAsync(async (req, res) => ok(res, await liveService.markJp(uid(req), req.params.id, req.params.commentId, req.body), 201))
);
router.post(
  "/sessions/:id/orders",
  validate(createOrderSchema),
  catchAsync(async (req, res) => ok(res, await liveService.createOrder(uid(req), req.params.id, req.body), 201))
);

router.get(
  "/orders",
  catchAsync(async (req, res) => {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status.split(",") : undefined;
    ok(res, await liveService.listOrders(uid(req), { sessionId, status }));
  })
);
router.patch("/orders/:id", validate(updateOrderSchema), catchAsync(async (req, res) => ok(res, await liveService.updateOrder(uid(req), req.params.id, req.body))));
router.delete(
  "/orders/:id",
  catchAsync(async (req, res) => {
    await liveService.removeOrder(uid(req), req.params.id);
    res.status(204).send();
  })
);
router.post(
  "/orders/:id/message",
  validate(messageSchema),
  catchAsync(async (req, res) => ok(res, await liveService.messageOrder(uid(req), req.params.id, req.body.text)))
);

export default router;
