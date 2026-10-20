import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { billingService } from "./billing.service.js";
import type { PapiNotification } from "./papi.client.js";

const PURCHASABLE = ["STARTER", "PRO", "BUSINESS"] as const;
const PERIODS = ["MONTHLY", "ANNUAL"] as const;

const checkoutSchema = z.object({
  plan: z.enum(PURCHASABLE, { errorMap: () => ({ message: "Formule invalide" }) }),
  period: z.enum(PERIODS, { errorMap: () => ({ message: "Période invalide" }) }),
});

const limit = z.number().int().min(0).nullable().optional();
const adminSchema = z.object({
  email: z.string().trim().email("E-mail invalide"),
  plan: z.enum(["STARTER", "PRO", "BUSINESS", "AGENCY"]),
  periodEnd: z.coerce.date().nullable(),
  limits: z.object({ pages: limit, aiReplies: limit, liveHours: limit }).optional(),
  note: z.string().trim().max(500).optional(),
});

// Abonnements : formules, paiement Papi.mg, consommation
const router = Router();

// Notification de paiement envoyée par Papi : publique (pas de session), authentifiée par signature.
// Déclarée avant authenticate ; le corps brut (req.rawBody) est capturé par express.json dans app.ts.
router.post(
  "/papi/notify",
  catchAsync(async (req: Request, res: Response) => {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    const result = await billingService.handleNotification(raw, req.header("x-papi-signature"), req.body as PapiNotification);
    res.status(result.status).json(result.body);
  }),
);

router.use(authenticate);

const uid = (req: Request) => req.user!.userId;
const ok = (res: Response, data: unknown) => res.json({ status: "success", data });

router.get("/", catchAsync(async (req, res) => ok(res, await billingService.overview(uid(req)))));

router.get(
  "/quote",
  catchAsync(async (req, res) => {
    const q = checkoutSchema.safeParse(req.query);
    if (!q.success) throw new AppError("Formule ou période invalide", 422);
    ok(res, await billingService.quote(uid(req), q.data.plan, q.data.period));
  }),
);

router.post(
  "/checkout",
  validate(checkoutSchema),
  catchAsync(async (req, res) => ok(res, await billingService.checkout(uid(req), req.body.plan, req.body.period))),
);

router.post(
  "/payments/:reference/refresh",
  catchAsync(async (req, res) => ok(res, await billingService.refresh(uid(req), req.params.reference))),
);

// Administrateur : formule Agence, prolongation, geste commercial
router.put(
  "/admin/subscription",
  authorize("ADMIN"),
  validate(adminSchema),
  catchAsync(async (req, res) => ok(res, await billingService.adminSetSubscription(uid(req), req.body))),
);

export default router;
