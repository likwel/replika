import type { BillingPeriod, PlanId, Subscription, SubscriptionKind } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { daysLeft } from "./billing.logic.js";
import { PLANS, type Feature, type Limits } from "./plans.js";
import { MODERATION_SELECT, isBlocked, type Moderation } from "../../utils/accountAccess.js";

// Droits d'un utilisateur selon sa formule : modules accessibles, limites, et abonnement en cours ou non

export type SubStatus = "TRIAL" | "ACTIVE" | "EXPIRED";

export interface Entitlements {
  plan: PlanId;
  planName: string;
  kind: SubscriptionKind | null;
  status: SubStatus;
  active: boolean; // automatisations autorisées (réponses auto, IA, lives, publications programmées)
  billingPeriod: BillingPeriod | null;
  periodEnd: Date | null;
  trialEndsAt: Date | null;
  limits: Limits;
  features: Record<Feature, boolean>; // modules de la formule, consultables même expirée
  liveCreditSeconds: number; // heures de live achetées à l'unité
  replyCredits: number; // réponses automatiques achetées en packs
  teamSeats: number | null; // membres d'équipe permis (0 = pas d'équipe, null = illimité)
  admin: boolean;
  blocked: boolean; // compte suspendu, banni ou supprimé par un administrateur : plus aucune automatisation
}

export const FEATURE_LABELS: Record<Feature, string> = {
  postAiRules: "Les règles IA ciblées par publication",
  leads: "Le suivi des leads",
  marketplace: "Marketplace",
  advancedStats: "Les statistiques avancées",
};

function customLimits(raw: unknown): Partial<Limits> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Limits> = {};
  for (const key of ["pages", "aiReplies", "liveHours"] as const) {
    if (!(key in raw)) continue;
    const v = (raw as Record<string, unknown>)[key];
    out[key] = typeof v === "number" && v >= 0 ? v : null;
  }
  return out;
}

export function computeEntitlements(sub: Subscription | null, role: string, now = new Date(), moderation?: Moderation | null): Entitlements {
  const ent = baseEntitlements(sub, role, now);
  // Compte bloqué par un administrateur : formule conservée (affichage) mais rien ne tourne
  if (moderation && isBlocked(moderation, now)) return { ...ent, active: false, liveCreditSeconds: 0, replyCredits: 0, blocked: true };
  return ent;
}

function baseEntitlements(sub: Subscription | null, role: string, now: Date): Entitlements {
  if (role === "ADMIN") {
    const agency = PLANS.AGENCY;
    return {
      plan: "AGENCY",
      planName: agency.name,
      kind: "MANUAL",
      status: "ACTIVE",
      active: true,
      billingPeriod: null,
      periodEnd: null,
      trialEndsAt: null,
      limits: agency.limits,
      features: agency.features,
      liveCreditSeconds: sub?.liveCreditSeconds ?? 0,
      replyCredits: sub?.replyCredits ?? 0,
      teamSeats: agency.teamSeats,
      admin: true,
      blocked: false,
    };
  }
  // Aucun abonnement : traité comme expiré (on ferme par défaut)
  const plan = PLANS[sub?.plan ?? "STARTER"];
  const running = Boolean(sub) && (sub!.periodEnd === null || sub!.periodEnd > now);
  return {
    plan: plan.id,
    planName: plan.name,
    kind: sub?.kind ?? null,
    status: !running ? "EXPIRED" : sub!.kind === "TRIAL" ? "TRIAL" : "ACTIVE",
    active: running,
    billingPeriod: sub?.billingPeriod ?? null,
    periodEnd: sub?.periodEnd ?? null,
    trialEndsAt: sub?.trialEndsAt ?? null,
    limits: { ...plan.limits, ...customLimits(sub?.customLimits) },
    features: plan.features,
    liveCreditSeconds: sub?.liveCreditSeconds ?? 0,
    replyCredits: sub?.replyCredits ?? 0,
    teamSeats: plan.teamSeats,
    admin: false,
    blocked: false,
  };
}

// Cache court : les moteurs (relève, lives, planification) consultent les droits à chaque passage
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; ent: Entitlements }>();

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ent;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, subscription: true, ...MODERATION_SELECT } });
  if (user && !user.subscription && user.role !== "ADMIN") console.warn(`⚠️ Abonnement manquant pour ${userId} : traité comme expiré`);
  const ent = computeEntitlements(user?.subscription ?? null, user?.role ?? "USER", new Date(), user);
  cache.set(userId, { at: Date.now(), ent });
  return ent;
}

export function invalidateEntitlements(userId: string) {
  cache.delete(userId);
}

// Résumé envoyé au front (/auth/me, /billing)
export function summarize(ent: Entitlements) {
  return {
    plan: ent.plan,
    planName: ent.planName,
    kind: ent.kind,
    status: ent.status,
    active: ent.active,
    billingPeriod: ent.billingPeriod,
    periodEnd: ent.periodEnd,
    trialEndsAt: ent.trialEndsAt,
    daysLeft: daysLeft(ent.periodEnd),
    limits: ent.limits,
    features: ent.features,
    liveCreditSeconds: ent.liveCreditSeconds,
    replyCredits: ent.replyCredits,
    teamSeats: ent.teamSeats,
    admin: ent.admin,
  };
}

export function summarizeSubscription(user: { role: string; subscription: Subscription | null }) {
  return summarize(computeEntitlements(user.subscription, user.role));
}

export function inactiveError(ent: Entitlements): AppError {
  if (ent.blocked) return new AppError("Compte suspendu par l'administrateur : les automatisations sont arrêtées.", 403, "ACCOUNT_SUSPENDED");
  const msg =
    ent.kind === "TRIAL"
      ? "Votre essai gratuit est terminé : choisissez une formule pour réactiver les automatisations."
      : "Votre abonnement a expiré : renouvelez-le pour réactiver les automatisations.";
  return new AppError(msg, 402, "SUBSCRIPTION_INACTIVE");
}

export async function assertActive(userId: string): Promise<Entitlements> {
  const ent = await getEntitlements(userId);
  if (!ent.active) throw inactiveError(ent);
  return ent;
}

export function featureError(feature: Feature): AppError {
  return new AppError(`${FEATURE_LABELS[feature]} : disponible à partir de la formule Pro.`, 402, "PLAN_REQUIRED");
}

export async function assertFeature(userId: string, feature: Feature): Promise<Entitlements> {
  const ent = await getEntitlements(userId);
  if (!ent.features[feature]) throw featureError(feature);
  return ent;
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export function countActivePages(userId: string) {
  return prisma.socialAccount.count({ where: { userId, platform: "FACEBOOK", isActive: true } });
}

export async function pageSlotsLeft(userId: string): Promise<number> {
  const ent = await getEntitlements(userId);
  if (ent.limits.pages === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, ent.limits.pages - (await countActivePages(userId)));
}

export async function assertPageSlot(userId: string) {
  if ((await pageSlotsLeft(userId)) > 0) return;
  const ent = await getEntitlements(userId);
  const n = ent.limits.pages ?? 0;
  throw new AppError(
    `Votre formule ${ent.planName} permet ${n} Page${n > 1 ? "s" : ""} active${n > 1 ? "s" : ""} : désactivez-en une ou passez à une formule supérieure.`,
    402,
    "PAGE_LIMIT",
  );
}

// Pages en trop après un changement de formule : les plus anciennes restent actives,
// les autres sont désactivées avec leurs comptes Instagram liés. Retourne leurs noms.
export async function enforcePageLimit(userId: string): Promise<string[]> {
  invalidateEntitlements(userId);
  const ent = await getEntitlements(userId);
  const limit = ent.limits.pages;
  if (limit === null) return [];
  const active = await prisma.socialAccount.findMany({
    where: { userId, platform: "FACEBOOK", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, externalId: true },
  });
  const excess = active.slice(limit);
  if (!excess.length) return [];
  await prisma.socialAccount.updateMany({ where: { id: { in: excess.map((p) => p.id) } }, data: { isActive: false } });
  await prisma.socialAccount.updateMany({
    where: { userId, platform: "INSTAGRAM", linkedPageId: { in: excess.map((p) => p.externalId) } },
    data: { isActive: false },
  });
  const names = excess.map((p) => p.name);
  await prisma.activityLog.create({
    data: { userId, action: "PAGES_DEACTIVATED_FOR_PLAN", meta: { plan: ent.plan, limit, pages: names } },
  });
  return names;
}
