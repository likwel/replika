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

export function daysLeft(periodEnd: Date | null, now = new Date()): number | null {
  if (!periodEnd) return null;
  return Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY));
}
