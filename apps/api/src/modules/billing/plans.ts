import type { BillingPeriod, PlanId } from "@prisma/client";
import { AppError } from "../../utils/AppError.js";

// Catalogue des formules : source unique des prix, limites et modules.
// La page d'accueil en garde une copie (apps/web/src/data/plans.ts), vérifiée par billing.logic.test.ts.

export type Feature = "postAiRules" | "leads" | "marketplace" | "advancedStats";

export interface Limits {
  pages: number | null; // Pages Facebook actives ; null = illimité
  aiReplies: number | null; // réponses générées par l'IA par mois
  liveHours: number | null; // heures de sessions live par mois
}

export interface PlanDef {
  id: PlanId;
  name: string;
  monthly: number | null; // Ar ; null = sur devis
  limits: Limits;
  features: Record<Feature, boolean>;
  purchasable: boolean; // payable en ligne
}

const PRO_FEATURES: Record<Feature, boolean> = { postAiRules: true, leads: true, marketplace: true, advancedStats: true };

export const PLANS: Record<PlanId, PlanDef> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    monthly: 49_000,
    limits: { pages: 2, aiReplies: 1_000, liveHours: 30 },
    features: { postAiRules: false, leads: false, marketplace: false, advancedStats: false },
    purchasable: true,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    monthly: 129_000,
    limits: { pages: 5, aiReplies: 5_000, liveHours: 90 },
    features: PRO_FEATURES,
    purchasable: true,
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    monthly: 249_000,
    limits: { pages: 15, aiReplies: 15_000, liveHours: 300 },
    features: PRO_FEATURES,
    purchasable: true,
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agence",
    monthly: null,
    limits: { pages: null, aiReplies: null, liveHours: null },
    features: PRO_FEATURES,
    purchasable: false,
  },
};

export const PLAN_ORDER: PlanId[] = ["STARTER", "PRO", "BUSINESS", "AGENCY"];

export const PERIOD_DAYS: Record<BillingPeriod, number> = { MONTHLY: 30, ANNUAL: 365 };
export const ANNUAL_DISCOUNT = 0.15;
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: PlanId = "PRO";

const DAY = 86_400_000;

// Prix mensuel en formule annuelle : -15 %, arrondi au millier
export function annualMonthly(monthly: number): number {
  return Math.round((monthly * (1 - ANNUAL_DISCOUNT)) / 1000) * 1000;
}

export function priceOf(plan: PlanId, period: BillingPeriod): number {
  const def = PLANS[plan];
  if (!def.purchasable || def.monthly === null) throw new AppError("Cette formule est sur devis : contactez-nous.", 400);
  return period === "ANNUAL" ? annualMonthly(def.monthly) * 12 : def.monthly;
}

export function trialSubscription(now = new Date()) {
  const end = new Date(now.getTime() + TRIAL_DAYS * DAY);
  return { plan: TRIAL_PLAN, kind: "TRIAL" as const, periodEnd: end, trialEndsAt: end };
}

// Version publique du catalogue (écran Facturation)
export function publicPlans() {
  return PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    return {
      id: p.id,
      name: p.name,
      monthly: p.monthly,
      annual: p.purchasable && p.monthly !== null ? annualMonthly(p.monthly) * 12 : null,
      annualMonthly: p.monthly !== null ? annualMonthly(p.monthly) : null,
      limits: p.limits,
      features: p.features,
      purchasable: p.purchasable,
    };
  });
}
