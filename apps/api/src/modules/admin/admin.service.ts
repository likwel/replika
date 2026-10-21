import { Prisma, type PaymentStatus, type PlanId } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { aiProviderName, isAiConfigured } from "../ai/ai.client.js";
import { formatPhone, usageDay, usageMonth } from "../billing/billing.logic.js";
import { feeRates, feeWith, type FeeRates } from "../billing/feeRates.js";
import { computeEntitlements, invalidateEntitlements } from "../billing/entitlements.js";
import { notificationUrl } from "../billing/billing.service.js";
import { workingUserWhere, type Moderation } from "../../utils/accountAccess.js";
import { twoFactorService } from "../auth/twoFactor.service.js";
import { mailStatus } from "../mail/mail.service.js";
import { isPapiConfigured } from "../billing/papi.client.js";
import { PLANS, annualMonthly } from "../billing/plans.js";

// Tableau de bord administrateur : suivi de la plateforme (utilisateurs, encaissements, usage, IA)

const DAY = 86_400_000;
const TZ_OFFSET = "3 hours"; // jours calendaires de Madagascar (UTC+3)

type Status = "TRIAL" | "ACTIVE" | "EXPIRED";

// Série quotidienne complète (jours sans valeur à 0), du plus ancien au plus récent
function fillDays(rows: Array<{ day: string; value: number }>, days: number) {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  const out: Array<{ date: string; value: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() + 3 * 3600_000 - i * DAY).toISOString().slice(0, 10);
    out.push({ date: d, value: byDay.get(d) ?? 0 });
  }
  return out;
}

export type ModerationAction = "suspend" | "unsuspend" | "ban" | "unban" | "delete" | "restore" | "logout" | "reset2fa";
export const MODERATION_ACTIONS: ModerationAction[] = ["suspend", "unsuspend", "ban", "unban", "delete", "restore", "logout", "reset2fa"];
const MODERATION_LOG: Record<ModerationAction, string> = {
  suspend: "ACCOUNT_SUSPENDED",
  unsuspend: "ACCOUNT_REACTIVATED",
  ban: "ACCOUNT_BANNED",
  unban: "ACCOUNT_UNBANNED",
  delete: "ACCOUNT_DELETED",
  restore: "ACCOUNT_RESTORED",
  logout: "SESSIONS_REVOKED",
  reset2fa: "TWO_FACTOR_RESET",
};

export type AccountFilter = "current" | "active" | "suspended" | "banned" | "deleted" | "all";
type AccountState = "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";

// État affiché : la suppression prime, puis le bannissement, puis une suspension encore en cours
function accountState(u: Moderation, now: Date): AccountState {
  if (u.deletedAt) return "DELETED";
  if (u.status === "BANNED") return "BANNED";
  if (u.status === "SUSPENDED" && (!u.suspendedUntil || u.suspendedUntil > now)) return "SUSPENDED";
  return "ACTIVE";
}

function accountWhere(f: AccountFilter, now: Date): Prisma.UserWhereInput {
  switch (f) {
    case "all":
      return {};
    case "deleted":
      return { deletedAt: { not: null } };
    case "banned":
      return { deletedAt: null, status: "BANNED" };
    case "suspended":
      return { deletedAt: null, status: "SUSPENDED", OR: [{ suspendedUntil: null }, { suspendedUntil: { gt: now } }] };
    case "active":
      return { deletedAt: null, ...workingUserWhere(now) };
    default:
      return { deletedAt: null }; // comptes non supprimés
  }
}

export const EXPENSE_CATEGORIES = ["HOSTING", "AI", "MARKETING", "SALARY", "SOFTWARE", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Occurrences d'une dépense dans [since, now] : une fois, ou chaque mois à partir de sa date si elle est mensuelle
function occurrences(e: { date: Date; recurring: boolean }, since: Date, now: Date): number {
  if (!e.recurring) return e.date >= since && e.date <= now ? 1 : 0;
  let n = 0;
  for (let k = 0; k < 600; k++) {
    const d = new Date(e.date);
    d.setMonth(d.getMonth() + k);
    if (d > now) break;
    if (d >= since) n++;
  }
  return n;
}

// Commission d'un paiement : réelle (transmise par Papi), sinon estimée avec les taux par opérateur en vigueur
const feeOf = (rates: FeeRates, p: { amount: number; fee: number | null; feeEstimated: boolean; paymentMethod: string | null }) =>
  p.fee !== null && !p.feeEstimated ? p.fee : feeWith(rates, p.amount, p.paymentMethod);

// Résultat d'une période : brut − commissions Papi − coût IA − dépenses = bénéfice
async function finance(since: Date, now: Date) {
  const [paid, aiDays, expenses, rates] = await Promise.all([
    prisma.payment.findMany({ where: { status: "PAID", paidAt: { gte: since } }, select: { amount: true, fee: true, feeEstimated: true, paymentMethod: true } }),
    prisma.aiDailyUsage.aggregate({ where: { day: { gte: usageDay(since) } }, _sum: { replies: true } }),
    prisma.expense.findMany({ where: { date: { lte: now }, OR: [{ recurring: true }, { date: { gte: since } }] } }),
    feeRates(),
  ]);
  const gross = paid.reduce((n, p) => n + p.amount, 0);
  const fees = paid.reduce((n, p) => n + feeOf(rates, p), 0);
  const feesEstimated = paid.filter((p) => p.fee === null || p.feeEstimated).length;
  const aiReplies = aiDays._sum.replies ?? 0;
  const aiCost = Math.round(aiReplies * env.ai.costPerReply);
  const byCategory: Record<string, number> = {};
  let other = 0;
  for (const e of expenses) {
    const amount = e.amount * occurrences(e, since, now);
    if (!amount) continue;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + amount;
    other += amount;
  }
  const net = gross - fees;
  const profit = net - aiCost - other;
  return {
    gross,
    fees,
    feesEstimated,
    feeRates: rates,
    net,
    aiReplies,
    aiCost,
    expenses: other,
    expensesByCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    profit,
    margin: gross > 0 ? profit / gross : 0,
  };
}

// Mensualité équivalente d'un abonnement payé (revenu mensuel récurrent estimé)
function monthlyValue(plan: PlanId, period: "MONTHLY" | "ANNUAL" | null): number {
  const base = PLANS[plan].monthly;
  if (base === null) return 0;
  return period === "ANNUAL" ? annualMonthly(base) : base;
}

export const adminService = {
  async overview(days: number) {
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY);
    const month = usageMonth(now);

    const [
      usersTotal, usersNew, activeUsers, subs, signupRows, revenueRows,
      paidAll, paidPeriod, paidByKind, paidByPlan, paidByMethod, pending, failedPeriod,
      usage, creditLeft, accounts, aiEnabled, aiLanguages, rules, messages, repliedAuto, aiGenerated,
      liveActive, aiFailures24h, aiQuotaHits, topAi, result,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.activityLog.groupBy({ by: ["userId"], where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
      prisma.subscription.findMany({
        where: { user: { deletedAt: null } },
        select: { plan: true, kind: true, billingPeriod: true, periodEnd: true, customLimits: true, user: { select: { role: true } } },
      }),
      prisma.$queryRaw<Array<{ day: string; value: bigint }>>`
        SELECT to_char(("createdAt" + ${TZ_OFFSET}::interval)::date, 'YYYY-MM-DD') AS day, COUNT(*) AS value
        FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
      prisma.$queryRaw<Array<{ day: string; value: bigint }>>`
        SELECT to_char(("paidAt" + ${TZ_OFFSET}::interval)::date, 'YYYY-MM-DD') AS day, SUM("amount") AS value
        FROM "Payment" WHERE "status" = 'PAID' AND "paidAt" >= ${since} GROUP BY 1`,
      prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      prisma.payment.groupBy({ by: ["kind"], where: { status: "PAID", paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      prisma.payment.groupBy({ by: ["plan"], where: { status: "PAID", kind: "SUBSCRIPTION", paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      prisma.payment.groupBy({ by: ["paymentMethod"], where: { status: "PAID", paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: true }),
      prisma.payment.count({ where: { status: { in: ["FAILED", "EXPIRED"] }, createdAt: { gte: since } } }),
      prisma.usage.aggregate({ where: { month }, _sum: { aiReplies: true, liveSeconds: true, liveCreditUsed: true } }),
      prisma.subscription.aggregate({ _sum: { liveCreditSeconds: true } }),
      prisma.socialAccount.groupBy({ by: ["platform", "isActive"], _count: true }),
      prisma.socialAccount.count({ where: { aiEnabled: true, isActive: true } }),
      prisma.socialAccount.groupBy({ by: ["aiLanguage"], where: { aiEnabled: true }, _count: true }),
      prisma.automationRule.aggregate({ where: { isActive: true }, _count: true }),
      prisma.socialMessage.count({ where: { createdAt: { gte: since } } }),
      prisma.socialMessage.count({ where: { createdAt: { gte: since }, status: "REPLIED" } }),
      prisma.socialMessage.count({ where: { createdAt: { gte: since }, aiGenerated: true } }),
      prisma.liveSession.count({ where: { status: "ACTIVE" } }),
      prisma.activityLog.count({ where: { action: "AI_REPLY_FAILED", createdAt: { gte: new Date(now.getTime() - DAY) } } }),
      prisma.usage.count({ where: { month, aiQuotaHitAt: { not: null } } }),
      prisma.usage.findMany({
        where: { month, aiReplies: { gt: 0 } },
        orderBy: { aiReplies: "desc" },
        take: 5,
        select: { aiReplies: true, liveSeconds: true, user: { select: { id: true, name: true, email: true } } },
      }),
      finance(since, now),
    ]);

    // Abonnements : statut et revenu mensuel récurrent (MRR) des formules payées en cours
    const byStatus: Record<Status, number> = { TRIAL: 0, ACTIVE: 0, EXPIRED: 0 };
    const byPlan: Record<string, number> = {};
    let mrr = 0;
    let paying = 0;
    for (const s of subs) {
      if (s.user.role === "ADMIN") continue;
      const ent = computeEntitlements(s as never, "USER", now);
      byStatus[ent.status]++;
      if (ent.status === "ACTIVE") {
        byPlan[s.plan] = (byPlan[s.plan] ?? 0) + 1;
        if (s.kind === "PAID") {
          paying++;
          mrr += monthlyValue(s.plan, s.billingPeriod);
        }
      }
    }
    const [suspended, banned, deleted] = await Promise.all([
      prisma.user.count({ where: { status: "SUSPENDED", deletedAt: null, OR: [{ suspendedUntil: null }, { suspendedUntil: { gt: now } }] } }),
      prisma.user.count({ where: { status: "BANNED", deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: { not: null } } }),
    ]);
    // Clients (hors administrateurs) ayant déjà payé une formule
    const everPaid = await prisma.payment.groupBy({ by: ["userId"], where: { status: "PAID", kind: "SUBSCRIPTION", user: { role: "USER" } } });

    const count = (platform: string, active?: boolean) =>
      accounts.filter((a) => a.platform === platform && (active === undefined || a.isActive === active)).reduce((n, a) => n + a._count, 0);
    const aiReplies = usage._sum.aiReplies ?? 0;

    return {
      days,
      users: {
        total: usersTotal,
        new: usersNew,
        active7d: activeUsers.length,
        moderation: { suspended, banned, deleted },
        signups: fillDays(signupRows.map((r) => ({ day: r.day, value: Number(r.value) })), days),
      },
      subscriptions: {
        byStatus,
        byPlan,
        paying,
        everPaid: everPaid.length,
        // Comptes ayant payé au moins une fois / comptes inscrits (hors administrateurs)
        conversion: usersTotal > 0 ? everPaid.length / Math.max(1, subs.filter((s) => s.user.role !== "ADMIN").length) : 0,
        mrr,
      },
      finance: result,
      revenue: {
        total: paidAll._sum.amount ?? 0,
        totalCount: paidAll._count,
        period: paidPeriod._sum.amount ?? 0,
        periodCount: paidPeriod._count,
        daily: fillDays(revenueRows.map((r) => ({ day: r.day, value: Number(r.value) })), days),
        byKind: paidByKind.map((k) => ({ kind: k.kind, amount: k._sum.amount ?? 0, count: k._count })),
        byPlan: paidByPlan.filter((p) => p.plan).map((p) => ({ plan: p.plan!, name: PLANS[p.plan!].name, amount: p._sum.amount ?? 0, count: p._count })),
        byMethod: paidByMethod.map((m) => ({ method: m.paymentMethod ?? "INCONNU", amount: m._sum.amount ?? 0, count: m._count })),
        pending: { amount: pending._sum.amount ?? 0, count: pending._count },
        failed: failedPeriod,
      },
      usage: {
        month,
        aiReplies,
        liveSeconds: usage._sum.liveSeconds ?? 0,
        liveCreditUsed: usage._sum.liveCreditUsed ?? 0,
        liveCreditLeft: creditLeft._sum.liveCreditSeconds ?? 0,
        liveActive,
        pages: { active: count("FACEBOOK", true), total: count("FACEBOOK") },
        instagram: { active: count("INSTAGRAM", true), total: count("INSTAGRAM") },
        rulesActive: rules._count,
        messages,
        replied: repliedAuto,
        aiGenerated,
      },
      ai: {
        configured: isAiConfigured(),
        provider: aiProviderName(),
        model: env.ai.model,
        repliesThisMonth: aiReplies,
        costPerReply: env.ai.costPerReply,
        estimatedCost: Math.round(aiReplies * env.ai.costPerReply),
        failures24h: aiFailures24h,
        quotaHits: aiQuotaHits,
        accountsEnabled: aiEnabled,
        languages: aiLanguages.map((l) => ({ language: l.aiLanguage, count: l._count })),
        top: topAi.map((t) => ({ userId: t.user.id, name: t.user.name, email: t.user.email, aiReplies: t.aiReplies, liveSeconds: t.liveSeconds })),
      },
      system: {
        papi: { configured: isPapiConfigured(), testMode: env.papi.testMode, notifications: Boolean(notificationUrl()) },
        liveHourPrice: env.liveHourPrice,
        mail: mailStatus(),
        pollSeconds: env.autoReply.pollSeconds,
        webhookConfigured: Boolean(env.fb.webhookVerifyToken),
        publicApiUrl: env.publicApiUrl,
      },
    };
  },

  async users(q: { search?: string; plan?: PlanId; status?: Status; account?: AccountFilter; page: number; pageSize?: number }) {
    const now = new Date();
    const PAGE = q.pageSize ?? 20;
    const where: Prisma.UserWhereInput = {
      ...accountWhere(q.account ?? "current", now),
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { email: { contains: q.search, mode: "insensitive" } }] }
        : {}),
      ...(q.plan || q.status
        ? {
            subscription: {
              ...(q.plan ? { plan: q.plan } : {}),
              ...(q.status === "TRIAL" ? { kind: "TRIAL", periodEnd: { gt: now } } : {}),
              ...(q.status === "ACTIVE" ? { kind: { not: "TRIAL" }, OR: [{ periodEnd: null }, { periodEnd: { gt: now } }] } : {}),
              ...(q.status === "EXPIRED" ? { periodEnd: { lte: now } } : {}),
            },
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true, name: true, email: true, role: true, createdAt: true, avatarUrl: true, paymentPhone: true,
          status: true, suspendedUntil: true, moderationReason: true, moderatedAt: true, deletedAt: true, twoFactorMethod: true,
          subscription: true,
          _count: { select: { accounts: { where: { platform: "FACEBOOK", isActive: true } } } },
        },
      }),
    ]);
    const ids = users.map((u) => u.id);
    const [paid, usage, lastSeen] = await Promise.all([
      prisma.payment.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "PAID" }, _sum: { amount: true } }),
      prisma.usage.findMany({ where: { userId: { in: ids }, month: usageMonth(now) } }),
      prisma.activityLog.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { createdAt: true } }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: PAGE,
      users: users.map((u) => {
        const ent = computeEntitlements(u.subscription, u.role, now);
        const use = usage.find((x) => x.userId === u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          paymentPhone: u.paymentPhone ? formatPhone(u.paymentPhone) : null,
          account: accountState(u, now),
          suspendedUntil: u.suspendedUntil,
          moderationReason: u.moderationReason,
          moderatedAt: u.moderatedAt,
          twoFactorMethod: u.twoFactorMethod,
          role: u.role,
          createdAt: u.createdAt,
          plan: ent.plan,
          planName: ent.planName,
          kind: u.subscription?.kind ?? null,
          status: ent.status,
          periodEnd: u.subscription?.periodEnd ?? null,
          pages: u._count.accounts,
          pagesLimit: ent.limits.pages,
          aiReplies: use?.aiReplies ?? 0,
          aiLimit: ent.limits.aiReplies,
          liveSeconds: use?.liveSeconds ?? 0,
          liveCreditSeconds: u.subscription?.liveCreditSeconds ?? 0,
          totalPaid: paid.find((p) => p.userId === u.id)?._sum.amount ?? 0,
          lastActivity: lastSeen.find((l) => l.userId === u.id)?._max.createdAt ?? null,
        };
      }),
    };
  },

  async payments(q: { status?: PaymentStatus; page: number; pageSize?: number }) {
    const PAGE = q.pageSize ?? 25;
    const rates = await feeRates();
    const where: Prisma.PaymentWhereInput = q.status ? { status: q.status } : {};
    const [total, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * PAGE,
        take: PAGE,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: PAGE,
      payments: rows.map((p) => ({
        reference: p.reference,
        kind: p.kind,
        planName: p.plan ? PLANS[p.plan].name : null,
        period: p.period,
        liveHours: p.liveHours,
        amount: p.amount,
        fee: p.status === "PAID" ? feeOf(rates, p) : null,
        feeEstimated: p.status === "PAID" && (p.fee === null || p.feeEstimated),
        net: p.status === "PAID" ? p.amount - feeOf(rates, p) : null,
        status: p.status,
        paymentMethod: p.paymentMethod,
        payerPhone: p.payerPhone ? formatPhone(p.payerPhone) : null,
        failureMessage: p.failureMessage,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        user: p.user,
      })),
    };
  },

  async expenses(days: number) {
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY);
    const rows = await prisma.expense.findMany({ orderBy: { date: "desc" } });
    return {
      expenses: rows.map((e) => ({ ...e, inPeriod: e.amount * occurrences(e, since, now), occurrences: occurrences(e, since, now) })),
      total: rows.reduce((n, e) => n + e.amount * occurrences(e, since, now), 0),
    };
  },

  async addExpense(adminId: string, input: { date: Date; category: ExpenseCategory; label: string; amount: number; recurring: boolean; note?: string | null }) {
    return prisma.expense.create({ data: { ...input, note: input.note || null, createdById: adminId } });
  },

  async removeExpense(id: string) {
    const e = await prisma.expense.findUnique({ where: { id } });
    if (!e) throw new AppError("Dépense introuvable", 404);
    await prisma.expense.delete({ where: { id } });
  },

  // Modération d'un compte : rien n'est effacé, chaque action est réversible et tracée
  async moderate(adminId: string, userId: string, input: { action: ModerationAction; reason?: string | null; until?: Date | null }) {
    if (userId === adminId) throw new AppError("Vous ne pouvez pas modérer votre propre compte.", 400);
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } });
    if (!target) throw new AppError("Utilisateur introuvable", 404);
    const { action } = input;
    const reason = input.reason?.trim() || null;
    if (target.role === "ADMIN" && action !== "logout" && action !== "reset2fa") throw new AppError("Un compte administrateur ne peut pas être suspendu, banni ni supprimé.", 403);
    if (["suspend", "ban", "delete"].includes(action) && !reason) throw new AppError("Indiquez le motif : il est montré à la personne et conservé dans l'historique.", 422);
    if (action === "suspend" && input.until && input.until <= new Date()) throw new AppError("La fin de suspension doit être dans le futur.", 422);

    const now = new Date();
    const revoke = { tokenVersion: { increment: 1 } }; // sessions ouvertes fermées tout de suite
    const data: Prisma.UserUpdateInput = {
      suspend: { status: "SUSPENDED" as const, suspendedUntil: input.until ?? null, moderationReason: reason, moderatedAt: now, ...revoke },
      unsuspend: { status: "ACTIVE" as const, suspendedUntil: null, moderationReason: null, moderatedAt: now },
      ban: { status: "BANNED" as const, suspendedUntil: null, moderationReason: reason, moderatedAt: now, ...revoke },
      unban: { status: "ACTIVE" as const, moderationReason: null, moderatedAt: now },
      delete: { deletedAt: now, moderationReason: reason, moderatedAt: now, ...revoke },
      restore: { deletedAt: null, moderatedAt: now },
      logout: revoke,
      reset2fa: revoke, // téléphone ou boîte mail perdus : la personne se reconnecte avec son seul mot de passe
    }[action];
    if (action === "reset2fa") await twoFactorService.adminReset(userId);
    await prisma.user.update({ where: { id: userId }, data });
    await prisma.activityLog.create({
      data: { userId, action: MODERATION_LOG[action], meta: { by: adminId, reason, until: input.until?.toISOString() ?? null } },
    });
    invalidateEntitlements(userId);
    return { ok: true };
  },

  // Heures de live offertes (geste commercial, compensation)
  async addLiveHours(adminId: string, userId: string, hours: number) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new AppError("Utilisateur sans abonnement", 404);
    await prisma.subscription.update({ where: { userId }, data: { liveCreditSeconds: { increment: hours * 3600 } } });
    await prisma.activityLog.create({ data: { userId, action: "LIVE_HOURS_GIFTED", meta: { by: adminId, hours } } });
    invalidateEntitlements(userId);
    return { liveCreditSeconds: sub.liveCreditSeconds + hours * 3600 };
  },
};
