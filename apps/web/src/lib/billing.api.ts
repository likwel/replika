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
  plan: PlanId;
  planName: string;
  period: BillingPeriod;
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
  usage: { month: string; aiReplies: number; liveSeconds: number; pages: number };
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
  checkout: (plan: PlanId, period: BillingPeriod) =>
    api.post<Res<{ reference: string; paymentLink: string }>>("/billing/checkout", { plan, period }).then((r) => r.data),
  refresh: (reference: string) =>
    api
      .post<Res<{ payment: PaymentRow; subscription: SubscriptionSummary }>>(`/billing/payments/${encodeURIComponent(reference)}/refresh`)
      .then((r) => r.data),
};

// Codes d'erreur de l'API liés à la formule
export const BILLING_CODES = ["PLAN_REQUIRED", "QUOTA_EXCEEDED", "SUBSCRIPTION_INACTIVE", "PAGE_LIMIT"];

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  MVOLA: "MVola",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
  BRED: "Carte bancaire",
};
