import test from "node:test";
import assert from "node:assert/strict";
import { appliesTo, checkCondition, subjectOf, isCondition, type ConditionContext } from "./pipeline.logic.js";
import { pipelineSchema, stepSchema } from "./pipeline.schema.js";

const rule = { name: "Demande de prix", channel: "COMMENT" as const, matchType: "CONTAINS" as const, trigger: "prix, combien" };
const ctx = (over: Partial<ConditionContext> = {}): ConditionContext => ({
  text: "C'est combien ?",
  kind: "COMMENT",
  leadScore: 80,
  rules: new Map([["r1", rule]]),
  ...over,
});

test("MATCH_RULE : passe quand les mots-clés et le canal correspondent", () => {
  assert.deepEqual(checkCondition({ id: "a", type: "MATCH_RULE", config: { ruleId: "r1" } }, ctx()), { pass: true });
});
test("MATCH_RULE : s'arrête si le message ne contient aucun mot-clé", () => {
  const r = checkCondition({ id: "a", type: "MATCH_RULE", config: { ruleId: "r1" } }, ctx({ text: "Bonjour" }));
  assert.equal(r.pass, false);
});
test("MATCH_RULE : une règle « commentaires » ne vise pas un message privé", () => {
  const r = checkCondition({ id: "a", type: "MATCH_RULE", config: { ruleId: "r1" } }, ctx({ kind: "DIRECT" }));
  assert.equal(r.pass, false);
  assert.match((r as { reason: string }).reason, /canal/);
});
test("MATCH_RULE : règle supprimée = arrêt avec une raison claire", () => {
  const r = checkCondition({ id: "a", type: "MATCH_RULE", config: { ruleId: "zz" } }, ctx());
  assert.equal(r.pass, false);
  assert.match((r as { reason: string }).reason, /n'existe plus/);
});
test("MIN_SCORE : seuil atteint ou non, et lead absent", () => {
  const s = { id: "a", type: "MIN_SCORE" as const, config: { min: 70 } };
  assert.equal(checkCondition(s, ctx({ leadScore: 70 })).pass, true);
  assert.equal(checkCondition(s, ctx({ leadScore: 69 })).pass, false);
  assert.equal(checkCondition(s, ctx({ leadScore: null })).pass, false);
});
test("appliesTo : pipeline actif, bon déclencheur, bon compte (ou tous)", () => {
  const ev = { trigger: "NEW_COMMENT", accountId: "acc1" };
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountId: null }, ev), true);
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountId: "acc1" }, ev), true);
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountId: "acc2" }, ev), false);
  assert.equal(appliesTo({ isActive: false, trigger: "NEW_COMMENT", accountId: null }, ev), false);
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_MESSAGE", accountId: null }, ev), false);
});
test("subjectOf : extrait tronqué sur une ligne", () => {
  assert.equal(subjectOf("Rasoa", "a\n b"), "Rasoa : a b");
  assert.ok(subjectOf("R", "x".repeat(200)).endsWith("…"));
});
test("isCondition : MATCH_RULE et MIN_SCORE sont des conditions, SEND_DM non", () => {
  assert.equal(isCondition("MATCH_RULE"), true);
  assert.equal(isCondition("MIN_SCORE"), true);
  assert.equal(isCondition("SEND_DM"), false);
});
test("schéma : un pipeline sans étape ou avec un message vide est refusé", () => {
  const ok = { name: "P", trigger: "NEW_COMMENT", steps: [{ id: "1", type: "SEND_DM", config: { text: "Bonjour {nom}" } }] };
  assert.equal(pipelineSchema.safeParse(ok).success, true);
  assert.equal(pipelineSchema.safeParse({ ...ok, steps: [] }).success, false);
  assert.equal(stepSchema.safeParse({ id: "1", type: "SEND_DM", config: { text: "  " } }).success, false);
  assert.equal(pipelineSchema.safeParse({ ...ok, steps: Array.from({ length: 13 }, (_, i) => ({ id: String(i), type: "ESCALATE", config: {} })) }).success, false);
});
