import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { EXPENSE_CATEGORIES, MODERATION_ACTIONS, adminService, type ModerationAction } from "./admin.service.js";
import { defaultFeeRates, getFeeRates, setFeeRates } from "../billing/feeRates.js";
import { prisma } from "../../config/prisma.js";
import { sendTestMail } from "../mail/mail.service.js";
import { contactService } from "../contact/contact.service.js";
import { aiBudgetAlertMail, aiUsageReport, checkAiBudget, defaultAiUsageSettings, getAiUsageSettings, monthTotals, saveAiUsageSettings } from "../ai/ai.usage.js";
import { sendMail } from "../mail/mail.service.js";
import { env } from "../../config/env.js";

// Tableau de bord administrateur : réservé au rôle ADMIN (le premier compte inscrit)
const router = Router();
router.use(authenticate, authorize("ADMIN"));

const ok = (res: Response, data: unknown) => res.json({ status: "success", data });
const page = (v: unknown) => Math.max(1, Math.min(10_000, Number(v) || 1));
const pageSize = (v: unknown, fallback: number) => ([10, 20, 25, 50, 100].includes(Number(v)) ? Number(v) : fallback);

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
    ok(res, await adminService.users({ ...q.data, page: page(req.query.page), pageSize: pageSize(req.query.pageSize, 20) }));
  }),
);

router.get(
  "/payments",
  catchAsync(async (req, res) => {
    const status = z.enum(["PENDING", "PAID", "FAILED", "EXPIRED"]).optional().safeParse(req.query.status || undefined);
    if (!status.success) throw new AppError("Statut invalide", 422);
    ok(res, await adminService.payments({ status: status.data, page: page(req.query.page), pageSize: pageSize(req.query.pageSize, 25) }));
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

// Suivi des tokens du modèle IA : consommation, coût, limite mensuelle et alertes par e-mail
router.get(
  "/ai-usage",
  catchAsync(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    if (![7, 30, 90].includes(days)) throw new AppError("Période invalide", 422);
    ok(res, await aiUsageReport(days));
  }),
);
const positive = (label: string) => z.number({ invalid_type_error: `${label} invalide` }).min(0, `${label} invalide`).max(1_000_000_000, `${label} trop élevé`);
router.put(
  "/settings/ai-usage",
  validate(
    z.object({
      settings: z
        .object({
          inputPerM: positive("Prix d'entrée"),
          outputPerM: positive("Prix de sortie"),
          cachedPerM: positive("Prix du cache").nullable(),
          usdToAr: positive("Taux de change").refine((v) => v > 0, "Taux de change invalide"),
          monthlyBudgetUsd: positive("Budget").nullable(),
          monthlyTokenLimit: positive("Limite de tokens").nullable(),
          alertPercent: z.number().min(1, "Seuil invalide").max(99, "Seuil entre 1 et 99 %"),
        })
        .nullable(),
    }),
  ),
  catchAsync(async (req: Request, res) => {
    await saveAiUsageSettings(req.body.settings);
    await prisma.activityLog.create({ data: { userId: req.user!.userId, action: "AI_USAGE_SETTINGS_UPDATED", meta: { reset: req.body.settings === null } } });
    // Une limite abaissée sous la consommation du mois prévient tout de suite
    void checkAiBudget();
    ok(res, await aiUsageReport(30));
  }),
);
// E-mail d'essai de l'alerte : le message exact qu'un administrateur recevrait, envoyé à celui qui clique
router.post(
  "/ai-usage/test-alert",
  catchAsync(async (req: Request, res) => {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { email: true, name: true } });
    const { settings } = await getAiUsageSettings();
    const totals = await monthTotals();
    const mail = aiBudgetAlertMail(me.name, { level: Math.round(settings.alertPercent), percent: settings.alertPercent, month: "essai", totals, settings: settings ?? defaultAiUsageSettings(), model: env.ai.model });
    await sendMail(me.email, `[Essai] ${mail.subject}`, mail.text, mail.html);
    ok(res, { to: me.email });
  }),
);

// E-mails : envoi d'un message de test à l'administrateur (erreur SMTP détaillée)
router.post(
  "/settings/mail-test",
  catchAsync(async (req: Request, res) => {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { email: true } });
    ok(res, { to: me.email, ...(await sendTestMail(me.email)) });
  }),
);

// Messages du formulaire « Nous contacter »
router.get(
  "/contacts",
  catchAsync(async (req, res) => {
    const status = req.query.status === "NEW" || req.query.status === "HANDLED" ? req.query.status : undefined;
    ok(res, await contactService.list({ status, page: page(req.query.page), pageSize: pageSize(req.query.pageSize, 20) }));
  }),
);
router.patch(
  "/contacts/:id",
  validate(z.object({ status: z.enum(["NEW", "HANDLED"]) })),
  catchAsync(async (req, res) => ok(res, await contactService.setStatus(req.params.id, req.body.status))),
);

router.post(
  "/users/:id/reply-credits",
  validate(z.object({ credits: z.number().int().min(1, "1 crédit minimum").max(100_000, "100 000 crédits maximum") })),
  catchAsync(async (req: Request, res) => ok(res, await adminService.addReplyCredits(req.user!.userId, req.params.id, req.body.credits))),
);
router.post(
  "/users/:id/live-hours",
  validate(z.object({ hours: z.number().int().min(1, "1 heure minimum").max(500, "500 heures maximum") })),
  catchAsync(async (req: Request, res) => ok(res, await adminService.addLiveHours(req.user!.userId, req.params.id, req.body.hours))),
);

export default router;
