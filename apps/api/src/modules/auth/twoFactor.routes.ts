import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { prisma } from "../../config/prisma.js";
import { twoFactorService } from "./twoFactor.service.js";

// Réglages de la validation en deux étapes (Paramètres › Sécurité) : utilisateur connecté
const router = Router();
router.use(authenticate);

const uid = (req: Request) => req.user!.userId;
const ok = (res: Response, data: unknown) => res.json({ status: "success", data });
const code = z.string({ required_error: "Code requis" }).trim().min(6, "Code incomplet").max(20);

router.get(
  "/",
  catchAsync(async (req, res) => ok(res, twoFactorService.status(await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } })))),
);
router.post("/email/start", catchAsync(async (req, res) => ok(res, await twoFactorService.startEmail(uid(req)))));
router.post(
  "/email/confirm",
  validate(z.object({ challengeId: z.string().min(10), code })),
  catchAsync(async (req, res) => ok(res, await twoFactorService.confirmEmail(uid(req), req.body.challengeId, req.body.code))),
);
router.post("/totp/start", catchAsync(async (req, res) => ok(res, await twoFactorService.startTotp(uid(req)))));
router.post(
  "/totp/confirm",
  validate(z.object({ code })),
  catchAsync(async (req, res) => ok(res, await twoFactorService.confirmTotp(uid(req), req.body.code))),
);
router.post("/disable/start", catchAsync(async (req, res) => ok(res, await twoFactorService.startDisable(uid(req)))));
router.post(
  "/disable",
  validate(z.object({ code, challengeId: z.string().optional() })),
  catchAsync(async (req, res) => ok(res, await twoFactorService.disable(uid(req), req.body.code, req.body.challengeId))),
);

export default router;
