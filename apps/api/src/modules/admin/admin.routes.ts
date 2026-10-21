import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { EXPENSE_CATEGORIES, MODERATION_ACTIONS, adminService, type ModerationAction } from "./admin.service.js";
import { defaultFeeRates, getFeeRates, setFeeRates } from "../billing/feeRates.js";
import { prisma } from "../../config/prisma.js";

// Tableau de bord administrateur : réservé au rôle ADMIN (le premier compte inscrit)
const router = Router();
router.use(authenticate, authorize("ADMIN"));

const ok = (res: Response, data: unknown) => res.json({ status: "success", data });
const page = (v: unknown) => Math.max(1, Math.min(10_000, Number(v) || 1));

router.get(
  "/overview",
  catchAsync(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    if (![7, 30, 90, 365].includes(days)) throw new AppError("Période invalide", 422);
    ok(res, await adminService.overview(days));
  }),
);

const usersQuery = z.object({
  search: z.string().trim().max(100).optional(),
  plan: z.enum(["STARTER", "PRO", "BUSINESS", "AGENCY"]).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "EXPIRED"]).optional(),
  account: z.enum(["current", "active", "suspended", "banned", "deleted", "all"]).optional(),
});
router.get(
  "/users",
  catchAsync(async (req, res) => {
    const q = usersQuery.safeParse({
      ...req.query,
      search: req.query.search || undefined,
      plan: req.query.plan || undefined,
      status: req.query.status || undefined,
      account: req.query.account || undefined,
    });
    if (!q.success) throw new AppError("Filtres invalides", 422);
    ok(res, await adminService.users({ ...q.data, page: page(req.query.page) }));
  }),
);

router.get(
  "/payments",
  catchAsync(async (req, res) => {
    const status = z.enum(["PENDING", "PAID", "FAILED", "EXPIRED"]).optional().safeParse(req.query.status || undefined);
    if (!status.success) throw new AppError("Statut invalide", 422);
    ok(res, await adminService.payments({ status: status.data, page: page(req.query.page) }));
  }),
);

// Dépenses de l'entreprise (bénéfice = encaissé net − coût IA − dépenses)
router.get(
  "/expenses",
  catchAsync(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    if (![7, 30, 90, 365].includes(days)) throw new AppError("Période invalide", 422);
    ok(res, await adminService.expenses(days));
  }),
);
router.post(
  "/expenses",
  validate(
    z.object({
      date: z.coerce.date({ invalid_type_error: "Date invalide" }),
      category: z.enum(EXPENSE_CATEGORIES),
      label: z.string().trim().min(1, "Libellé requis").max(120),
      amount: z.number({ invalid_type_error: "Montant invalide" }).int().min(1, "Montant invalide").max(1_000_000_000),
      recurring: z.boolean().default(false),
      note: z.string().trim().max(500).nullish(),
    }),
  ),
  catchAsync(async (req: Request, res) => ok(res, await adminService.addExpense(req.user!.userId, req.body))),
);
router.delete(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    await adminService.removeExpense(req.params.id);
    ok(res, null);
  }),
);

// Suspendre, bannir, supprimer (sans effacer : drapeau deletedAt), restaurer, déconnecter
router.post(
  "/users/:id/moderation",
  validate(
    z.object({
      action: z.enum(MODERATION_ACTIONS as [ModerationAction, ...ModerationAction[]]),
      reason: z.string().trim().max(500, "Motif : 500 caractères maximum").nullish(),
      until: z.coerce.date().nullish(),
    }),
  ),
  catchAsync(async (req: Request, res) => ok(res, await adminService.moderate(req.user!.userId, req.params.id, req.body))),
);

// Commissions Papi par opérateur (estimation quand Papi ne transmet pas la commission)
const rate = z.number({ invalid_type_error: "Taux invalide" }).min(0, "Taux invalide").max(20, "20 % maximum");
router.get("/settings/fees", catchAsync(async (_req, res) => ok(res, { ...(await getFeeRates()), presets: { transit: defaultFeeRates("transit"), direct: defaultFeeRates("direct") } })));
router.put(
  "/settings/fees",
  validate(z.object({ rates: z.object({ MVOLA: rate, ORANGE_MONEY: rate, AIRTEL_MONEY: rate, BRED: rate }).nullable() })),
  catchAsync(async (req: Request, res) => {
    const r = await setFeeRates(req.body.rates);
    await prisma.activityLog.create({ data: { userId: req.user!.userId, action: "FEE_RATES_UPDATED", meta: { rates: r.rates } } });
    ok(res, r);
  }),
);

router.post(
  "/users/:id/live-hours",
  validate(z.object({ hours: z.number().int().min(1, "1 heure minimum").max(500, "500 heures maximum") })),
  catchAsync(async (req: Request, res) => ok(res, await adminService.addLiveHours(req.user!.userId, req.params.id, req.body.hours))),
);

export default router;
