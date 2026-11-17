import { test } from "node:test";
import assert from "node:assert/strict";
import { revenueBySource } from "./finance.logic.js";

// npx tsx --test src/modules/admin/finance.logic.test.ts

const paid = [
  { kind: "SUBSCRIPTION" as const, amount: 129_000 },
  { kind: "SUBSCRIPTION" as const, amount: 49_000 },
  { kind: "REPLY_CREDITS" as const, amount: 9_900 },
  { kind: "LIVE_HOURS" as const, amount: 15_000 },
];
const fee = (p: { amount: number }) => Math.round(p.amount * 0.02);

test("chaque source a son brut, ses commissions et son net", () => {
  const r = revenueBySource(paid, fee);
  assert.deepEqual(r.SUBSCRIPTION, { gross: 178_000, fees: 3_560, net: 174_440, count: 2 });
  assert.deepEqual(r.REPLY_CREDITS, { gross: 9_900, fees: 198, net: 9_702, count: 1 });
  assert.deepEqual(r.LIVE_HOURS, { gross: 15_000, fees: 300, net: 14_700, count: 1 });
});

test("la somme des sources est exactement le total encaissé : rien n'est oublié ni compté deux fois", () => {
  const r = revenueBySource(paid, fee);
  const sum = (k: "gross" | "fees" | "net") => r.SUBSCRIPTION[k] + r.REPLY_CREDITS[k] + r.LIVE_HOURS[k];
  assert.equal(sum("gross"), paid.reduce((n, p) => n + p.amount, 0));
  assert.equal(sum("fees"), paid.reduce((n, p) => n + fee(p), 0));
  assert.equal(sum("net"), sum("gross") - sum("fees"));
});

test("aucun paiement : trois sources à zéro", () => {
  const r = revenueBySource([], fee);
  assert.deepEqual(Object.values(r).map((t) => t.gross), [0, 0, 0]);
});
