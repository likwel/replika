import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextSubscription, usageMonth } from "./billing.logic.js";
import { computeEntitlements } from "./entitlements.js";
import { PLANS, priceOf } from "./plans.js";
import { PLAN_DEFS } from "../../../../web/src/data/plans.js";

// npx tsx --test src/modules/billing/*.test.ts

const DAY = 86_400_000;
const now = new Date("2026-10-20T10:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * DAY);

test("prix annuels : -15 % arrondi au millier, × 12", () => {
  assert.equal(priceOf("STARTER", "ANNUAL"), 504_000);
  assert.equal(priceOf("PRO", "ANNUAL"), 1_320_000);
  assert.equal(priceOf("BUSINESS", "ANNUAL"), 2_544_000);
  assert.equal(priceOf("PRO", "MONTHLY"), 129_000);
  assert.throws(() => priceOf("AGENCY", "MONTHLY"));
});

test("la grille de la page d'accueil concorde avec celle de l'API", () => {
  for (const def of PLAN_DEFS) {
    const api = PLANS[def.id];
    assert.equal(def.base, api.monthly, `${def.id} : prix`);
    assert.deepEqual(def.quota, api.limits, `${def.id} : limites`);
  }
});

test("renouveler la même formule prolonge l'échéance en cours", () => {
  const next = computeNextSubscription({ plan: "PRO", kind: "PAID", billingPeriod: "MONTHLY", periodEnd: inDays(5) }, { plan: "PRO", period: "MONTHLY" }, now);
  assert.equal(next.periodEnd.getTime(), inDays(35).getTime());
  assert.equal(next.extraDays, 0);
});

test("payer pendant l'essai conserve les jours d'essai restants", () => {
  const next = computeNextSubscription({ plan: "PRO", kind: "TRIAL", billingPeriod: null, periodEnd: inDays(9) }, { plan: "STARTER", period: "MONTHLY" }, now);
  assert.equal(next.plan, "STARTER");
  assert.equal(next.periodEnd.getTime(), inDays(39).getTime());
});

test("changer de formule convertit la valeur restante en jours", () => {
  // Pro mensuel (4 300 Ar/j) avec 20 jours restants → Business mensuel (8 300 Ar/j) : 86 000 / 8 300 = 10 jours
  const next = computeNextSubscription({ plan: "PRO", kind: "PAID", billingPeriod: "MONTHLY", periodEnd: inDays(20) }, { plan: "BUSINESS", period: "MONTHLY" }, now);
  assert.equal(next.extraDays, 10);
  assert.equal(next.periodEnd.getTime(), inDays(40).getTime());
});

test("un abonnement expiré repart de maintenant", () => {
  const next = computeNextSubscription({ plan: "PRO", kind: "PAID", billingPeriod: "MONTHLY", periodEnd: inDays(-3) }, { plan: "PRO", period: "ANNUAL" }, now);
  assert.equal(next.periodEnd.getTime(), inDays(365).getTime());
  assert.equal(computeNextSubscription(null, { plan: "STARTER", period: "MONTHLY" }, now).periodEnd.getTime(), inDays(30).getTime());
});

test("droits : expiration, essai, administrateur, abonnement manquant", () => {
  const base = { id: "s", userId: "u", billingPeriod: null, customLimits: null, note: null, createdAt: now, updatedAt: now, trialEndsAt: null };
  const trial = computeEntitlements({ ...base, plan: "PRO", kind: "TRIAL", periodEnd: inDays(3) }, "USER", now);
  assert.equal(trial.status, "TRIAL");
  assert.equal(trial.features.leads, true);

  const expired = computeEntitlements({ ...base, plan: "STARTER", kind: "PAID", periodEnd: inDays(-1) }, "USER", now);
  assert.equal(expired.active, false);
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.features.leads, false);

  const agency = computeEntitlements({ ...base, plan: "AGENCY", kind: "MANUAL", periodEnd: null, customLimits: { pages: 40 } }, "USER", now);
  assert.equal(agency.active, true);
  assert.equal(agency.limits.pages, 40);
  assert.equal(agency.limits.aiReplies, null);

  assert.equal(computeEntitlements(null, "USER", now).active, false);
  assert.equal(computeEntitlements(null, "ADMIN", now).limits.pages, null);
});

test("mois de consommation en heure de Madagascar", () => {
  assert.equal(usageMonth(new Date("2026-10-31T20:59:00Z")), "2026-10");
  assert.equal(usageMonth(new Date("2026-10-31T21:00:00Z")), "2026-11"); // minuit à Antananarivo
});
