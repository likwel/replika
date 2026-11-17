import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextSubscription, usageMonth } from "./billing.logic.js";
import { computeEntitlements } from "./entitlements.js";
import { PLANS, priceOf } from "./plans.js";
import { COMPARE_ROWS, PLAN_DEFS } from "../../../../web/src/data/plans.js";

// npx tsx --test src/modules/billing/*.test.ts

const DAY = 86_400_000;
const now = new Date("2026-10-20T10:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * DAY);

test("prix annuels : -15 % arrondi au millier, × 12", () => {
  assert.equal(priceOf("STARTER", "ANNUAL"), 504_000);
  assert.equal(priceOf("PRO", "ANNUAL"), 1_008_000);
  assert.equal(priceOf("BUSINESS", "ANNUAL"), 2_028_000);
  assert.equal(priceOf("PRO", "MONTHLY"), 99_000); // prix promotionnel : c'est lui qui est facturé
  assert.throws(() => priceOf("AGENCY", "MONTHLY"));
});

test("la grille de la page d'accueil concorde avec celle de l'API", () => {
  for (const def of PLAN_DEFS) {
    const api = PLANS[def.id];
    assert.equal(def.base, api.monthly, `${def.id} : prix`);
    assert.deepEqual(def.quota, api.limits, `${def.id} : limites`);
    assert.equal(def.list, api.listMonthly, `${def.id} : prix public barré`);
    if (def.base !== null) assert.ok(api.listMonthly !== null && api.listMonthly > def.base, `${def.id} : le prix public dépasse le prix promotionnel`);
  }
});

test("le tableau comparatif de la page d'accueil concorde avec les droits de l'API", () => {
  PLAN_DEFS.forEach((def, i) => {
    const api = PLANS[def.id];
    for (const row of COMPARE_ROWS) {
      if (row.feature) assert.equal(row.values[i], api.features[row.feature], `${def.id} : ${row.label}`);
      if (row.team) {
        const expected = api.teamSeats === 0 ? "—" : api.teamSeats === null ? "Illimités" : String(api.teamSeats);
        assert.equal(row.values[i], expected, `${def.id} : ${row.label}`);
      }
    }
  });
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
  // Pro mensuel (3 300 Ar/j) avec 20 jours restants → Business mensuel (6 633 Ar/j) : 66 000 / 6 633 = 9 jours
  const next = computeNextSubscription({ plan: "PRO", kind: "PAID", billingPeriod: "MONTHLY", periodEnd: inDays(20) }, { plan: "BUSINESS", period: "MONTHLY" }, now);
  assert.equal(next.extraDays, 9);
  assert.equal(next.periodEnd.getTime(), inDays(39).getTime());
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

test("commission Papi estimée selon le moyen de paiement et le mode", async () => {
  const { estimateFee, feeRate } = await import("./billing.logic.js");
  assert.equal(estimateFee(129_000, "MVOLA", "transit"), 4902); // 3,80 %
  assert.equal(estimateFee(129_000, "BRED", "transit"), 5418); // carte 4,20 %
  assert.equal(estimateFee(49_000, "ORANGE_MONEY", "transit"), 1764); // 3,60 %
  assert.equal(estimateFee(49_000, "MVOLA", "direct"), 588); // 1,20 %
  assert.equal(feeRate(null, "transit"), 3.8);
  assert.equal(feeRate("MVOLA", "transit", 2.5), 2.5);
});

test("numéro de paiement normalisé", async () => {
  const { normalizePhone, formatPhone } = await import("./billing.logic.js");
  assert.equal(normalizePhone("034 12 345 67"), "+261341234567");
  assert.equal(normalizePhone("+261 32 12 345 67"), "+261321234567");
  assert.equal(normalizePhone("0331230001"), "+261331230001");
  assert.equal(normalizePhone("331230001"), "+261331230001");
  assert.equal(normalizePhone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("020 22 123 45"), null); // fixe malgache : pas de Mobile Money
  assert.equal(formatPhone("+261341234567"), "+261 34 12 345 67");
});
