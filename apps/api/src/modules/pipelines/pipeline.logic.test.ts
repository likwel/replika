import test from "node:test";
import assert from "node:assert/strict";
import { appliesTo, checkCondition, subjectOf, isCondition, withinHours, type ConditionContext } from "./pipeline.logic.js";
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
test("appliesTo : pipeline actif, bon déclencheur, et un des comptes visés (ou tous)", () => {
  const ev = { trigger: "NEW_COMMENT", accountId: "acc1" };
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountIds: [] }, ev), true); // liste vide : tous les comptes
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountIds: ["acc1"] }, ev), true);
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountIds: ["acc2", "acc1"] }, ev), true); // plusieurs Pages
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_COMMENT", accountIds: ["acc2", "acc3"] }, ev), false);
  assert.equal(appliesTo({ isActive: false, trigger: "NEW_COMMENT", accountIds: [] }, ev), false);
  assert.equal(appliesTo({ isActive: true, trigger: "NEW_MESSAGE", accountIds: [] }, ev), false);
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
  assert.deepEqual(pipelineSchema.parse(ok).accountIds, []); // par défaut : tous les comptes
  assert.deepEqual(pipelineSchema.parse({ ...ok, accountIds: ["a", "b"] }).accountIds, ["a", "b"]);
  assert.equal(pipelineSchema.safeParse({ ...ok, steps: [] }).success, false);
  assert.equal(stepSchema.safeParse({ id: "1", type: "SEND_DM", config: { text: "  " } }).success, false);
  assert.equal(pipelineSchema.safeParse({ ...ok, steps: Array.from({ length: 13 }, (_, i) => ({ id: String(i), type: "ESCALATE", config: {} })) }).success, false);
});

const lead = { status: "NEW", intent: "prix", phone: null as string | null, email: null as string | null };
const step = <T extends object>(type: string, config: T) => ({ id: "x", type, config }) as never;

test("KEYWORD : contient l'un des mots, ou exactement", () => {
  assert.equal(checkCondition(step("KEYWORD", { keywords: "prix, combien", mode: "CONTAINS" }), ctx()).pass, true);
  assert.equal(checkCondition(step("KEYWORD", { keywords: "livraison", mode: "CONTAINS" }), ctx()).pass, false);
  assert.equal(checkCondition(step("KEYWORD", { keywords: "c'est combien", mode: "EXACT" }), ctx()).pass, true);
  assert.equal(checkCondition(step("KEYWORD", { keywords: "combien", mode: "EXACT" }), ctx()).pass, false);
});
test("CHANNEL et PLATFORM", () => {
  assert.equal(checkCondition(step("CHANNEL", { kind: "COMMENT" }), ctx()).pass, true);
  assert.equal(checkCondition(step("CHANNEL", { kind: "DIRECT" }), ctx()).pass, false);
  assert.equal(checkCondition(step("PLATFORM", { platform: "INSTAGRAM" }), ctx({ platform: "INSTAGRAM" })).pass, true);
  assert.equal(checkCondition(step("PLATFORM", { platform: "INSTAGRAM" }), ctx({ platform: "FACEBOOK" })).pass, false);
});
test("LEAD_STATUS, LEAD_INTENT, LEAD_CONTACT : exigent un lead", () => {
  assert.equal(checkCondition(step("LEAD_STATUS", { statuses: ["NEW", "CONTACTED"] }), ctx({ lead })).pass, true);
  assert.equal(checkCondition(step("LEAD_STATUS", { statuses: ["WON"] }), ctx({ lead })).pass, false);
  assert.equal(checkCondition(step("LEAD_STATUS", { statuses: ["NEW"] }), ctx({ lead: null })).pass, false);
  assert.equal(checkCondition(step("LEAD_INTENT", { intents: ["prix", "commande"] }), ctx({ lead })).pass, true);
  assert.equal(checkCondition(step("LEAD_INTENT", { intents: ["reclamation"] }), ctx({ lead })).pass, false);
  assert.equal(checkCondition(step("LEAD_INTENT", { intents: ["prix"] }), ctx({ lead: { ...lead, intent: null } })).pass, false);
  assert.equal(checkCondition(step("LEAD_CONTACT", {}), ctx({ lead })).pass, false);
  assert.equal(checkCondition(step("LEAD_CONTACT", {}), ctx({ lead: { ...lead, phone: "034 00 000 00" } })).pass, true);
  assert.equal(checkCondition(step("LEAD_CONTACT", {}), ctx({ lead: null })).pass, false);
});
test("withinHours : heure de Madagascar (UTC+3), plage passant minuit", () => {
  const at = (utc: string) => new Date(`2026-01-15T${utc}:00Z`);
  assert.equal(withinHours(at("05:30"), "08:00", "18:00"), true); // 08:30 à Tana
  assert.equal(withinHours(at("04:59"), "08:00", "18:00"), false); // 07:59
  assert.equal(withinHours(at("15:00"), "08:00", "18:00"), false); // 18:00 pile : fermé
  assert.equal(withinHours(at("20:00"), "22:00", "06:00"), true); // 23:00, plage de nuit
  assert.equal(withinHours(at("02:59"), "22:00", "06:00"), true); // 05:59, encore la nuit
  assert.equal(withinHours(at("03:00"), "22:00", "06:00"), false); // 06:00 pile : la plage de nuit est finie
});
test("BUSINESS_HOURS : dedans / dehors", () => {
  const open = ctx({ now: new Date("2026-01-15T09:00:00Z") }); // 12:00 à Tana
  assert.equal(checkCondition(step("BUSINESS_HOURS", { mode: "INSIDE", from: "08:00", to: "18:00" }), open).pass, true);
  assert.equal(checkCondition(step("BUSINESS_HOURS", { mode: "OUTSIDE", from: "08:00", to: "18:00" }), open).pass, false);
  const night = ctx({ now: new Date("2026-01-15T21:00:00Z") }); // 00:00 à Tana
  assert.equal(checkCondition(step("BUSINESS_HOURS", { mode: "OUTSIDE", from: "08:00", to: "18:00" }), night).pass, true);
});
test("isCondition : les nouvelles conditions et actions sont bien classées", () => {
  for (const t of ["KEYWORD", "CHANNEL", "PLATFORM", "LEAD_STATUS", "LEAD_INTENT", "LEAD_CONTACT", "BUSINESS_HOURS"] as const) assert.equal(isCondition(t), true, t);
  for (const t of ["SEND_PUBLIC_REPLY", "SET_LEAD_NOTE", "SET_LEAD_VALUE", "IGNORE_MESSAGE", "EMAIL_OWNER", "WEBHOOK"] as const) assert.equal(isCondition(t), false, t);
});
test("schéma : validations des nouvelles étapes", () => {
  const ok = (type: string, config: object) => stepSchema.safeParse({ id: "1", type, config }).success;
  assert.equal(ok("KEYWORD", { keywords: "prix" }), true); // mode par défaut
  assert.equal(ok("KEYWORD", { keywords: " " }), false);
  assert.equal(ok("LEAD_STATUS", { statuses: [] }), false);
  assert.equal(ok("LEAD_INTENT", { intents: ["spam"] }), false);
  assert.equal(ok("BUSINESS_HOURS", { mode: "INSIDE", from: "08:00", to: "18:00" }), true);
  assert.equal(ok("BUSINESS_HOURS", { mode: "INSIDE", from: "8h", to: "18:00" }), false);
  assert.equal(ok("SET_LEAD_VALUE", { value: -1 }), false);
  assert.equal(ok("WEBHOOK", { url: "https://hooks.example.com/abc" }), true);
  assert.equal(ok("WEBHOOK", { url: "http://hooks.example.com/abc" }), false);
  assert.equal(ok("WEBHOOK", { url: "pas une adresse" }), false);
  assert.equal(ok("EMAIL_OWNER", { text: "" }), false);
  assert.equal(ok("IGNORE_MESSAGE", {}), true);
});
