import { Prisma, type BillingPeriod, type Payment, type PlanId } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { computeNextSubscription, newReference, normalizePhone, usageMonth } from "./billing.logic.js";
import { feeRates, feeWith } from "./feeRates.js";
import {
  countActivePages,
  enforcePageLimit,
  getEntitlements,
  invalidateEntitlements,
  summarize,
} from "./entitlements.js";
import {
  createPaymentLink,
  getPaymentLinkStatus,
  isPapiConfigured,
  safeEqual,
  verifySignature,
  type PapiNotification,
} from "./papi.client.js";
import { PLANS, priceOf, publicPlans } from "./plans.js";
import { getUsage } from "./usage.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const PERIOD_LABEL: Record<BillingPeriod, string> = { MONTHLY: "mensuel", ANNUAL: "annuel" };

// Papi ne peut pas joindre une adresse locale : on omet alors notificationUrl, et le paiement
// est confirmé au retour sur SuiteFlow ou par la vérification périodique (billing.worker.ts)
export function notificationUrl(): string | undefined {
  try {
    const host = new URL(env.publicApiUrl).hostname;
    if (["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"].includes(host) || host.endsWith(".local")) return undefined;
    return `${env.publicApiUrl}/api/billing/papi/notify`;
  } catch {
    return undefined;
  }
}

// Ce que le front peut voir d'un paiement (jamais le jeton de notification ni la réponse brute)
function publicPayment(p: Payment) {
  const linkUsable = p.status === "PENDING" && p.paymentLink && (!p.linkExpiresAt || p.linkExpiresAt > new Date());
  return {
    reference: p.reference,
    kind: p.kind,
    plan: p.plan,
    planName: p.plan ? PLANS[p.plan].name : p.kind === "REPLY_CREDITS" ? "Crédits de réponses" : "Heures de live",
    period: p.period,
    liveHours: p.liveHours,
    replyCredits: p.replyCredits,
    amount: p.amount,
    status: p.status,
    paymentMethod: p.paymentMethod,
    failureMessage: p.failureMessage,
    paymentLink: linkUsable ? p.paymentLink : null,
    linkExpiresAt: p.linkExpiresAt,
    paidAt: p.paidAt,
    appliedPeriodEnd: p.appliedPeriodEnd,
    extraDays: p.extraDays,
    createdAt: p.createdAt,
  };
}

function toInt(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

// Réponse Papi conservée pour l'audit, sans le jeton de notification
function stripToken(raw: object): Prisma.InputJsonValue {
  const { notificationToken: _omit, ...rest } = raw as Record<string, unknown>;
  return JSON.parse(JSON.stringify(rest)) as Prisma.InputJsonValue;
}

interface PaidDetails {
  paymentMethod?: string | null;
  papiReference?: string | null;
  fee?: number | null;
  payerPhone?: string | null;
  raw?: object;
}

// Active la période achetée. Idempotent : notification, retour utilisateur et vérification
// périodique peuvent arriver en même temps, une seule activation a lieu.
export async function activatePayment(paymentId: string, details: PaidDetails) {
  const rates = await feeRates();
  const done = await prisma.$transaction(async (tx) => {
    const before = await tx.payment.findUnique({ where: { id: paymentId }, select: { amount: true, paymentMethod: true } });
    // Commission : transmise par Papi dans la notification, sinon estimée d'après les taux par opérateur
    const fee = details.fee ?? (before ? feeWith(rates, before.amount, details.paymentMethod ?? before.paymentMethod) : undefined);
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "PAID" } },
      data: {
        status: "PAID",
        paidAt: new Date(),
        failureMessage: null,
        paymentMethod: details.paymentMethod ?? undefined,
        papiReference: details.papiReference ?? undefined,
        fee,
        feeEstimated: details.fee === undefined || details.fee === null,
        payerPhone: details.payerPhone ?? undefined,
        raw: details.raw ? stripToken(details.raw) : undefined,
      },
    });
    if (claimed.count === 0) return null; // déjà activé
    if (details.payerPhone) {
      const normalized = normalizePhone(details.payerPhone);
      if (normalized) {
        const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { userId: true } });
        await tx.user.update({ where: { id: p.userId }, data: { paymentPhone: normalized } });
      }
    }

    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

    // Heures de Live Manager à l'unité : ajoutées au crédit, la formule ne change pas
    if (payment.kind === "LIVE_HOURS") {
      const seconds = (payment.liveHours ?? 0) * 3600;
      await tx.subscription.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, plan: "STARTER", kind: "PAID", periodEnd: new Date(), liveCreditSeconds: seconds },
        update: { liveCreditSeconds: { increment: seconds } },
      });
      await tx.activityLog.create({
        data: {
          userId: payment.userId,
          action: "LIVE_HOURS_PURCHASED",
          meta: { reference: payment.reference, hours: payment.liveHours, amount: payment.amount, paymentMethod: details.paymentMethod ?? null },
        },
      });
      return { ...payment, liveOnly: true };
    }

    // Pack de réponses automatiques : ajouté au crédit, la formule ne change pas
    if (payment.kind === "REPLY_CREDITS") {
      const credits = payment.replyCredits ?? 0;
      await tx.subscription.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, plan: "STARTER", kind: "PAID", periodEnd: new Date(), replyCredits: credits },
        update: { replyCredits: { increment: credits } },
      });
      await tx.activityLog.create({
        data: {
          userId: payment.userId,
          action: "REPLY_CREDITS_PURCHASED",
          meta: { reference: payment.reference, credits, amount: payment.amount, paymentMethod: details.paymentMethod ?? null },
        },
      });
      return { ...payment, liveOnly: true };
    }

    // Verrou : deux paiements du même utilisateur s'appliquent l'un après l'autre
    await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "userId" = ${payment.userId} FOR UPDATE`;
    const sub = await tx.subscription.findUnique({ where: { userId: payment.userId } });
    const next = computeNextSubscription(sub, { plan: payment.plan!, period: payment.period! });
    const data = { plan: next.plan, kind: next.kind, billingPeriod: next.billingPeriod, periodEnd: next.periodEnd };
    await tx.subscription.upsert({
      where: { userId: payment.userId },
      create: { userId: payment.userId, ...data },
      update: { ...data, customLimits: Prisma.DbNull },
    });
    await tx.payment.update({ where: { id: paymentId }, data: { appliedPeriodEnd: next.periodEnd, extraDays: next.extraDays } });
    await tx.activityLog.create({
      data: {
        userId: payment.userId,
        action: "SUBSCRIPTION_ACTIVATED",
        meta: {
          reference: payment.reference,
          plan: payment.plan,
          period: payment.period,
          amount: payment.amount,
          periodEnd: next.periodEnd.toISOString(),
          extraDays: next.extraDays,
          paymentMethod: details.paymentMethod ?? null,
        },
      },
    });
    return { ...payment, liveOnly: false };
  });

  if (done) {
    invalidateEntitlements(done.userId);
    if (!done.liveOnly) await enforcePageLimit(done.userId).catch((e) => console.error("❌ Limite de Pages :", e));
  }
  return done;
}

// Relit le statut du lien chez Papi et applique le résultat
async function reconcilePayment(p: Payment) {
  const s = await getPaymentLinkStatus(p.reference);
  await prisma.payment.update({ where: { id: p.id }, data: { lastCheckedAt: new Date() } });
  if (!s) return;

  if (s.linkStatus === "PAID" || s.paymentStatus === "SUCCESS") {
    const amount = toInt(s.amount);
    if (amount !== null && amount < p.amount) {
      await logMismatch(p, amount);
      return;
    }
    await activatePayment(p.id, {
      paymentMethod: s.paymentMethod,
      papiReference: s.papiPaymentReference,
      payerPhone: s.payerPhone ?? null,
      raw: s,
    });
    return;
  }
  if (s.linkStatus === "EXPIRED" || s.linkStatus === "DISABLED") {
    const failed = s.paymentStatus === "FAILED";
    await prisma.payment.updateMany({
      where: { id: p.id, status: "PENDING" },
      data: {
        status: failed ? "FAILED" : "EXPIRED",
        failureMessage: s.message ?? (failed ? "Paiement refusé" : "Lien de paiement expiré sans paiement"),
        raw: stripToken(s),
      },
    });
    return;
  }
  // Lien encore actif : un essai a pu échouer, le client peut réessayer sur le même lien
  if (s.paymentStatus === "FAILED" && s.message !== p.failureMessage) {
    await prisma.payment.update({ where: { id: p.id }, data: { failureMessage: s.message ?? "Paiement refusé" } });
  }
}

async function logMismatch(p: Payment, received: number) {
  console.error(`❌ Paiement ${p.reference} : montant reçu ${received} Ar, attendu ${p.amount} Ar — non activé`);
  await prisma.activityLog.create({
    data: { userId: p.userId, action: "PAYMENT_AMOUNT_MISMATCH", meta: { reference: p.reference, expected: p.amount, received } },
  });
}

interface Purchase {
  kind: "SUBSCRIPTION" | "LIVE_HOURS" | "REPLY_CREDITS";
  plan?: PlanId;
  period?: BillingPeriod;
  liveHours?: number;
  replyCredits?: number;
  amount: number;
  description: string;
  phone?: string | null; // numéro saisi (facultatif) ; sinon celui que Papi transmet après le paiement
}

// Crée (ou réutilise) le lien de paiement Papi d'un achat
async function createCheckout(userId: string, purchase: Purchase) {
  if (!isPapiConfigured()) {
    throw new AppError("Le paiement en ligne n'est pas encore configuré : contactez-nous pour souscrire.", 503, "PAPI_NOT_CONFIGURED");
  }
  const { kind, plan = null, period = null, liveHours = null, replyCredits = null, amount, phone } = purchase;
  const now = Date.now();

  // Lien déjà créé pour le même achat et encore valide : réutilisé (sauf s'il vient d'être payé)
  const reusable = await prisma.payment.findFirst({
    where: { userId, kind, plan, period, liveHours, replyCredits, amount, ...(phone ? { payerPhone: phone } : {}), status: "PENDING", paymentLink: { not: null }, linkExpiresAt: { gt: new Date(now + 10 * MINUTE) } },
    orderBy: { createdAt: "desc" },
  });
  if (reusable) {
    await reconcilePayment(reusable).catch(() => {});
    const fresh = await prisma.payment.findUnique({ where: { id: reusable.id } });
    if (fresh?.status === "PENDING" && fresh.paymentLink) return { reference: fresh.reference, paymentLink: fresh.paymentLink };
    if (fresh?.status === "PAID") throw new AppError("Ce paiement vient d'être confirmé.", 409, "ALREADY_PAID");
  }

  const recent = await prisma.payment.count({ where: { userId, createdAt: { gt: new Date(now - HOUR) } } });
  if (recent >= 10) throw new AppError("Trop de tentatives de paiement : réessayez dans une heure.", 429);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, companyName: true, email: true } });
  const reference = newReference();
  const payment = await prisma.payment.create({ data: { reference, userId, kind, plan, period, liveHours, replyCredits, amount, payerPhone: phone ?? null } });
  if (phone) await prisma.user.update({ where: { id: userId }, data: { paymentPhone: phone } });
  // Page de retour : prévient la fenêtre principale (paiement ouvert dans une fenêtre à part) puis se ferme
  const back = `${env.clientUrl}/paiement/retour`;
  try {
    const link = await createPaymentLink({
      amount,
      reference,
      clientName: user.companyName?.trim() || user.name,
      description: purchase.description,
      successUrl: `${back}?payment=success&ref=${reference}`,
      failureUrl: `${back}?payment=failed&ref=${reference}`,
      notificationUrl: notificationUrl(),
      payerEmail: user.email,
      payerPhone: phone ?? undefined,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentLink: link.paymentLink,
        shortLink: link.shortLink ?? null,
        notificationToken: link.notificationToken,
        linkExpiresAt: link.linkExpirationDateTime ? new Date(link.linkExpirationDateTime) : new Date(now + env.papi.linkHours * HOUR),
      },
    });
    await prisma.activityLog.create({ data: { userId, action: "CHECKOUT_CREATED", meta: { reference, kind, plan, period, liveHours, replyCredits, amount } } });
    return { reference, paymentLink: link.paymentLink };
  } catch (e) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureMessage: e instanceof AppError ? e.message : "Création du lien de paiement impossible" },
    });
    throw e;
  }
}

export const billingService = {
  async overview(userId: string) {
    invalidateEntitlements(userId);
    const [ent, usage, pages, payments, owner] = await Promise.all([
      getEntitlements(userId),
      getUsage(userId),
      countActivePages(userId),
      prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.user.findUnique({ where: { id: userId }, select: { paymentPhone: true, phone: true } }),
    ]);
    return {
      subscription: summarize(ent),
      usage: {
        month: usageMonth(),
        aiReplies: usage?.aiReplies ?? 0,
        liveSeconds: usage?.liveSeconds ?? 0,
        liveCreditUsed: usage?.liveCreditUsed ?? 0,
        replyCreditUsed: usage?.replyCreditUsed ?? 0,
        pages,
      },
      liveHourPrice: env.liveHourPrice,
      replyPack: env.replyPack,
      paymentPhone: owner?.paymentPhone ?? owner?.phone ?? null,
      plans: publicPlans(),
      payments: payments.map(publicPayment),
      papiConfigured: isPapiConfigured(),
      testMode: env.papi.testMode,
    };
  },

  // Ce que donnerait le paiement : montant, nouvelle échéance, jours convertis, Pages désactivées
  async quote(userId: string, plan: PlanId, period: BillingPeriod) {
    const amount = priceOf(plan, period);
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const next = computeNextSubscription(sub, { plan, period });
    const limit = PLANS[plan].limits.pages;
    const active = await countActivePages(userId);
    return {
      plan,
      period,
      amount,
      periodEnd: next.periodEnd,
      extraDays: next.extraDays,
      pagesToDeactivate: limit === null ? 0 : Math.max(0, active - limit),
    };
  },

  async checkout(userId: string, plan: PlanId, period: BillingPeriod, phone?: string) {
    return createCheckout(userId, {
      phone,
      kind: "SUBSCRIPTION",
      plan,
      period,
      amount: priceOf(plan, period), // jamais un montant envoyé par le navigateur
      description: `SuiteFlow ${PLANS[plan].name} — abonnement ${PERIOD_LABEL[period]}`,
    });
  },

  // Heures de Live Manager à l'unité (prix par heure fixé par le serveur)
  async buyLiveHours(userId: string, hours: number, phone?: string) {
    return createCheckout(userId, {
      phone,
      kind: "LIVE_HOURS",
      liveHours: hours,
      amount: hours * env.liveHourPrice,
      description: `SuiteFlow — ${hours} h de Live Manager`,
    });
  },

  // Packs de réponses automatiques (taille et prix d'un pack fixés par le serveur)
  async buyReplyCredits(userId: string, packs: number, phone?: string) {
    const credits = packs * env.replyPack.size;
    return createCheckout(userId, {
      phone,
      kind: "REPLY_CREDITS",
      replyCredits: credits,
      amount: packs * env.replyPack.price,
      description: `SuiteFlow — ${credits.toLocaleString("fr-FR")} réponses automatiques`,
    });
  },

  // Notification de Papi : signature vérifiée sur le corps brut, puis référence et jeton
  async handleNotification(rawBody: Buffer | undefined, signature: string | undefined, body: PapiNotification) {
    if (!rawBody) return { status: 400, body: { received: false } };
    if (!verifySignature(rawBody, signature, env.papi.secretKey)) {
      console.warn("⚠️ Notification Papi refusée : signature invalide");
      return { status: 401, body: { received: false } };
    }
    const reference = body.merchantPaymentReference;
    const payment = reference ? await prisma.payment.findUnique({ where: { reference } }) : null;
    if (!payment) return { status: 404, body: { received: false } };
    if (!payment.notificationToken || !body.notificationToken || !safeEqual(body.notificationToken, payment.notificationToken)) {
      console.warn(`⚠️ Notification Papi ${reference} refusée : jeton invalide`);
      return { status: 401, body: { received: false } };
    }

    if (body.paymentStatus === "SUCCESS") {
      const amount = toInt(body.amount);
      if ((amount !== null && amount < payment.amount) || (body.currency && body.currency !== "MGA")) {
        await logMismatch(payment, amount ?? 0);
        return { status: 200, body: { received: true } };
      }
      await activatePayment(payment.id, {
        paymentMethod: body.paymentMethod ?? null,
        papiReference: body.paymentReference ?? null,
        fee: toInt(body.fee),
        payerPhone: body.payerPhone ?? null,
        raw: body,
      });
    } else if (body.paymentStatus === "FAILED" && payment.status === "PENDING") {
      // Le lien reste payable : le client peut réessayer, le paiement reste en attente
      await prisma.payment.update({
        where: { id: payment.id },
        data: { failureMessage: body.message ?? "Paiement refusé", raw: stripToken(body), lastCheckedAt: new Date() },
      });
      await prisma.activityLog.create({
        data: { userId: payment.userId, action: "PAYMENT_FAILED", meta: { reference: payment.reference, message: body.message ?? null } },
      });
    }
    return { status: 200, body: { received: true } };
  },

  // Retour sur SuiteFlow après le paiement, ou bouton « Vérifier » : relit le statut chez Papi
  async refresh(userId: string, reference: string) {
    const payment = await prisma.payment.findFirst({ where: { reference, userId } });
    if (!payment) throw new AppError("Paiement introuvable", 404);
    const recentlyChecked = payment.lastCheckedAt && Date.now() - payment.lastCheckedAt.getTime() < 3000;
    if (payment.status === "PENDING" && payment.paymentLink && isPapiConfigured() && !recentlyChecked) {
      await reconcilePayment(payment);
    }
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    invalidateEntitlements(userId);
    return { payment: publicPayment(fresh), subscription: summarize(await getEntitlements(userId)) };
  },

  // Vérification périodique des paiements en attente (notification perdue ou adresse non publique)
  async reconcilePending() {
    const now = Date.now();
    const pending = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        paymentLink: { not: null },
        createdAt: { gt: new Date(now - 48 * HOUR) },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now - 2 * MINUTE) } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    for (const p of pending) {
      // Au-delà d'une heure, un paiement abandonné n'est revérifié que tous les quarts d'heure
      const old = now - p.createdAt.getTime() > HOUR;
      if (old && p.lastCheckedAt && now - p.lastCheckedAt.getTime() < 15 * MINUTE) continue;
      await reconcilePayment(p).catch((e) => console.error(`❌ Vérification du paiement ${p.reference} :`, e?.message ?? e));
    }
    // Liens expirés depuis longtemps et jamais payés : clos
    await prisma.payment.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(now - 48 * HOUR) }, OR: [{ linkExpiresAt: null }, { linkExpiresAt: { lt: new Date(now) } }] },
      data: { status: "EXPIRED", failureMessage: "Lien de paiement expiré sans paiement" },
    });
  },

  // Administrateur : formule posée à la main (Agence, prolongation, geste commercial)
  async adminSetSubscription(
    adminId: string,
    input: { email: string; plan: PlanId; periodEnd: Date | null; limits?: { pages?: number | null; aiReplies?: number | null; liveHours?: number | null }; note?: string },
  ) {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } });
    if (!user) throw new AppError("Aucun compte avec cet e-mail", 404);
    const data = {
      plan: input.plan,
      kind: "MANUAL" as const,
      billingPeriod: null,
      periodEnd: input.periodEnd,
      customLimits: input.limits ? (input.limits as Prisma.InputJsonValue) : Prisma.DbNull,
      note: input.note ?? null,
    };
    await prisma.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SUBSCRIPTION_SET_BY_ADMIN",
        meta: { by: adminId, plan: input.plan, periodEnd: input.periodEnd?.toISOString() ?? null, limits: input.limits ?? null },
      },
    });
    invalidateEntitlements(user.id);
    const deactivated = await enforcePageLimit(user.id);
    return { subscription: summarize(await getEntitlements(user.id)), deactivated };
  },
};
