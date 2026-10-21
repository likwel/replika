import { api } from "./api";
import type { PlanId } from "@/data/plans";

export type { PlanId };
export type BillingPeriod = "MONTHLY" | "ANNUAL";
export type SubStatus = "TRIAL" | "ACTIVE" | "EXPIRED";
export type Feature = "postAiRules" | "leads" | "marketplace" | "advancedStats";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface Limits {
  pages: number | null; // null = illimité
  aiReplies: number | null;
  liveHours: number | null;
}

// Formule de l'utilisateur connecté (renvoyée aussi par /auth/me)
export interface SubscriptionSummary {
  plan: PlanId;
  planName: string;
  kind: "TRIAL" | "PAID" | "MANUAL" | null;
  status: SubStatus;
  active: boolean; // automatisations autorisées
  billingPeriod: BillingPeriod | null;
  periodEnd: string | null;
  trialEndsAt: string | null;
  daysLeft: number | null;
  limits: Limits;
  features: Record<Feature, boolean>;
  liveCreditSeconds: number; // heures de live achetées à l'unité (secondes restantes)
  admin: boolean;
}

export interface PublicPlan {
  id: PlanId;
  name: string;
  monthly: number | null;
  annual: number | null; // total payé pour un an
  annualMonthly: number | null;
  limits: Limits;
  features: Record<Feature, boolean>;
  purchasable: boolean;
}

export interface PaymentRow {
  reference: string;
  kind: "SUBSCRIPTION" | "LIVE_HOURS";
  plan: PlanId | null;
  planName: string;
  period: BillingPeriod | null;
  liveHours: number | null;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string | null;
  failureMessage: string | null;
  paymentLink: string | null; // lien encore payable
  linkExpiresAt: string | null;
  paidAt: string | null;
  appliedPeriodEnd: string | null;
  extraDays: number | null;
  createdAt: string;
}

export interface BillingOverview {
  subscription: SubscriptionSummary;
  usage: { month: string; aiReplies: number; liveSeconds: number; liveCreditUsed: number; pages: number };
  liveHourPrice: number; // Ar par heure de Live Manager à l'unité
  paymentPhone: string | null; // dernier numéro de paiement, proposé par défaut
  plans: PublicPlan[];
  payments: PaymentRow[];
  papiConfigured: boolean;
  testMode: boolean;
}

export interface Quote {
  plan: PlanId;
  period: BillingPeriod;
  amount: number;
  periodEnd: string;
  extraDays: number;
  pagesToDeactivate: number;
}

type Res<T> = { status: string; data: T };

export const billingApi = {
  overview: () => api.get<Res<BillingOverview>>("/billing").then((r) => r.data),
  quote: (plan: PlanId, period: BillingPeriod) =>
    api.get<Res<Quote>>(`/billing/quote?plan=${plan}&period=${period}`).then((r) => r.data),
  checkout: (plan: PlanId, period: BillingPeriod, phone: string) =>
    api.post<Res<{ reference: string; paymentLink: string }>>("/billing/checkout", { plan, period, phone }).then((r) => r.data),
  buyLiveHours: (hours: number, phone: string) =>
    api.post<Res<{ reference: string; paymentLink: string }>>("/billing/live-hours", { hours, phone }).then((r) => r.data),
  refresh: (reference: string) =>
    api
      .post<Res<{ payment: PaymentRow; subscription: SubscriptionSummary }>>(`/billing/payments/${encodeURIComponent(reference)}/refresh`)
      .then((r) => r.data),
};

// Codes d'erreur de l'API liés à la formule
export const BILLING_CODES = ["PLAN_REQUIRED", "QUOTA_EXCEEDED", "SUBSCRIPTION_INACTIVE", "PAGE_LIMIT", "LIVE_HOURS_REQUIRED"];

// Heures de live restantes (formule active : quota du mois ; sinon crédit acheté)
export function liveHoursLeft(o: BillingOverview): { quota: number | null; credit: number; canRun: boolean } {
  const s = o.subscription;
  const quota = !s.active ? 0 : s.limits.liveHours === null ? null : Math.max(0, s.limits.liveHours * 3600 - o.usage.liveSeconds);
  const credit = s.liveCreditSeconds;
  return { quota, credit, canRun: quota === null || quota > 0 || credit > 0 };
}

export const fmtHours = (seconds: number) => `${(seconds / 3600).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  MVOLA: "MVola",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
  BRED: "Carte bancaire",
};

// Ce qu'un paiement confirmé a apporté
export function paidText(p: PaymentRow, periodEnd: string | null): string {
  if (p.kind === "LIVE_HOURS") return `${p.liveHours} h de Live Manager ajoutées à votre crédit.`;
  const end = p.appliedPeriodEnd ?? periodEnd;
  const date = end ? new Date(end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
  return `Formule ${p.planName} active${date ? ` jusqu'au ${date}` : ""}.`;
}
