import { test } from "node:test";
import assert from "node:assert/strict";
import { costOf, nextAlertLevel, percentUsed, usageFromResponse } from "./ai.usage.logic.js";

// npx tsx --test src/modules/ai/ai.usage.logic.test.ts

const prices = { inputPerM: 2, outputPerM: 10, cachedPerM: 0.5 };

test("coût : entrée, cache à tarif réduit et sortie", () => {
  assert.equal(costOf({ inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0 }, prices), 2);
  assert.equal(costOf({ inputTokens: 1_000_000, outputTokens: 100_000, cachedTokens: 400_000, reasoningTokens: 0 }, prices), 0.6 * 2 + 0.4 * 0.5 + 0.1 * 10);
  // sans tarif de cache, le cache est facturé comme l'entrée ; le cache ne dépasse jamais l'entrée
  assert.equal(costOf({ inputTokens: 1000, outputTokens: 0, cachedTokens: 5000, reasoningTokens: 0 }, { ...prices, cachedPerM: null }), 0.002);
});

test("part de la limite : la plus avancée du budget et des tokens", () => {
  const t = { inputTokens: 600_000, outputTokens: 200_000, costUsd: 4 };
  assert.equal(percentUsed(t, { monthlyBudgetUsd: 10, monthlyTokenLimit: null }), 40);
  assert.equal(percentUsed(t, { monthlyBudgetUsd: null, monthlyTokenLimit: 1_000_000 }), 80);
  assert.equal(percentUsed(t, { monthlyBudgetUsd: 10, monthlyTokenLimit: 1_000_000 }), 80);
  assert.equal(percentUsed(t, { monthlyBudgetUsd: null, monthlyTokenLimit: null }), null);
});

test("alertes : 80 % puis 100 %, chacune une seule fois par mois", () => {
  assert.equal(nextAlertLevel(50, 80, 0), null);
  assert.equal(nextAlertLevel(80, 80, 0), 80);
  assert.equal(nextAlertLevel(85, 80, 80), null); // déjà prévenu à 80 %
  assert.equal(nextAlertLevel(100, 80, 80), 100);
  assert.equal(nextAlertLevel(130, 80, 100), null);
  assert.equal(nextAlertLevel(95, 80, 0), 80);
  assert.equal(nextAlertLevel(null, 80, 0), null);
  assert.equal(nextAlertLevel(120, 80, 0), 100); // plusieurs seuils franchis d'un coup : le plus haut
});

test("usage lu dans la réponse du fournisseur (OpenAI et variantes)", () => {
  assert.deepEqual(
    usageFromResponse({ usage: { prompt_tokens: 120, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 100 }, completion_tokens_details: { reasoning_tokens: 12 } } }),
    { inputTokens: 120, outputTokens: 40, cachedTokens: 100, reasoningTokens: 12 },
  );
  assert.deepEqual(usageFromResponse({ usage: { input_tokens: 5, output_tokens: 7 } }), { inputTokens: 5, outputTokens: 7, cachedTokens: 0, reasoningTokens: 0 });
  assert.equal(usageFromResponse({}), null);
  assert.equal(usageFromResponse({ usage: {} }), null);
});
