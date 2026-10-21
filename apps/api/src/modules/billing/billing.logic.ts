import { randomBytes } from "node:crypto";
import type { BillingPeriod, PlanId, SubscriptionKind } from "@prisma/client";
import { PERIOD_DAYS, priceOf } from "./plans.js";

// Règles de facturation pures (sans base de données) : testées par billing.logic.test.ts

const DAY = 86_400_000;

export interface SubState {
  plan: PlanId;
  kind: SubscriptionKind;
  billingPeriod: BillingPeriod | null;
  periodEnd: Date | null;
}

export interface NextSubscription {
  plan: PlanId;
  kind: "PAID";
  billingPeriod: BillingPeriod;
  periodEnd: Date;
  extraDays: number; // jours convertis depuis la formule précédente
}

// Échéance obtenue en payant `plan` pour `period` :
// - même formule, ou pendant l'essai : la période s'ajoute à l'échéance en cours (rien n'est perdu) ;
// - changement de formule en cours de période payée : la valeur restante devient des jours sur la nouvelle ;
// - abonnement expiré ou posé à la main : la période commence maintenant.
export function computeNextSubscription(
  sub: SubState | null,
  target: { plan: PlanId; period: BillingPeriod },
  now = new Date(),
): NextSubscription {
  const days = PERIOD_DAYS[target.period];
  const end = sub?.periodEnd && sub.periodEnd > now ? sub.periodEnd : null;
  let start = now;
  let extraDays = 0;

  if (sub && end && (sub.kind === "TRIAL" || (sub.kind === "PAID" && sub.plan === target.plan))) {
    start = end;
  } else if (sub && end && sub.kind === "PAID" && sub.billingPeriod) {
    const remaining = Math.floor((end.getTime() - now.getTime()) / DAY);
    const oldDaily = priceOf(sub.plan, sub.billingPeriod) / PERIOD_DAYS[sub.billingPeriod];
    const newDaily = priceOf(target.plan, target.period) / days;
    extraDays = Math.max(0, Math.floor((remaining * oldDaily) / newDaily));
  }

  return {
    plan: target.plan,
    kind: "PAID",
    billingPeriod: target.period,
    periodEnd: new Date(start.getTime() + (days + extraDays) * DAY),
    extraDays,
  };
}

// Mois de consommation (calendaire, heure de Madagascar UTC+3) : "2026-10"
export function usageMonth(date = new Date()): string {
  return new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 7);
}

// Référence marchande unique envoyée à Papi
export function newReference(): string {
  return `SF-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

// Jour calendaire de Madagascar : "2026-10-21"
export function usageDay(date = new Date()): string {
  return new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

// Commissions Papi TTC (papi.mg/pricing, octobre 2026). Mode Transit : Papi encaisse pour vous, frais
// opérateurs compris. Mode Direct : 1,20 %, les frais de l'opérateur ou de la banque étant facturés à part.
export const PAPI_FEE_RATES = {
  transit: { BRED: 4.2, MVOLA: 3.8, ORANGE_MONEY: 3.6, AIRTEL_MONEY: 3.6, default: 3.8 },
  direct: { BRED: 1.2, MVOLA: 1.2, ORANGE_MONEY: 1.2, AIRTEL_MONEY: 1.2, default: 1.2 },
} as const;

export function feeRate(method: string | null | undefined, mode: "transit" | "direct", override: number | null = null): number {
  if (override !== null && Number.isFinite(override)) return override;
  const rates = PAPI_FEE_RATES[mode] as Record<string, number>;
  return rates[method ?? ""] ?? rates.default;
}

export function estimateFee(amount: number, method: string | null | undefined, mode: "transit" | "direct", override: number | null = null): number {
  return Math.round((amount * feeRate(method, mode, override)) / 100);
}

// Numéro de paiement : mobile malgache (034 12 345 67, +261 34 12 345 67) ou international (+33…).
// Retourne le format international, ou null si invalide.
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s().-]/g, "");
  const mg = s.match(/^(?:\+?261|00261|0)?(3[2-9]\d{7})$/);
  if (mg) return `+261${mg[1]}`;
  if (/^(\+|00)[1-9]\d{7,14}$/.test(s)) return s.startsWith("00") ? `+${s.slice(2)}` : s;
  return null;
}

// Affichage : +261 34 12 345 67
export function formatPhone(p: string): string {
  const m = p.match(/^\+261(3\d)(\d{2})(\d{3})(\d{2})$/);
  return m ? `+261 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

export function daysLeft(periodEnd: Date | null, now = new Date()): number | null {
  if (!periodEnd) return null;
  return Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY));
}
