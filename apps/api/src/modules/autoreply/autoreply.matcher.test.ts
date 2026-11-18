import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateRules, firstName, isPlaceholderName, renderReply } from "./autoreply.matcher.js";

// npx tsx --test src/modules/autoreply/autoreply.matcher.test.ts

test("les noms de repli de Meta ne sont pas de vrais noms", () => {
  for (const n of ["", "  ", "Utilisateur", "Utilisateur Facebook", "utilisateur instagram", "Utilisateur Messenger"]) assert.equal(isPlaceholderName(n), true, n);
  for (const n of ["Rasoa Andrianina", "@vanille.fan", "Utilisateurs Pro"]) assert.equal(isPlaceholderName(n), false, n);
});

test("prénom : le premier mot du vrai nom, vide pour un nom de repli", () => {
  assert.equal(firstName("Rasoa Andrianina"), "Rasoa");
  assert.equal(firstName("Utilisateur Facebook"), "");
  assert.equal(firstName(""), "");
});

test("avec un nom : {nom} et {page} sont remplacés", () => {
  assert.equal(renderReply("Bonjour {nom}, merci pour votre intérêt ! Voici nos tarifs : …", { nom: "Rasoa", page: "Ma Page" }), "Bonjour Rasoa, merci pour votre intérêt ! Voici nos tarifs : …");
  assert.equal(renderReply("{prénom} - {page}", { nom: "Rasoa", page: "Ma Page" }), "Rasoa - Ma Page");
});

test("sans nom connu : jamais « Bonjour Utilisateur », la salutation se passe de prénom", () => {
  const r = (t: string) => renderReply(t, { nom: firstName("Utilisateur Facebook"), page: "Ma Page" });
  assert.equal(r("Bonjour {nom}, merci pour votre intérêt ! Voici nos tarifs : …"), "Bonjour, merci pour votre intérêt ! Voici nos tarifs : …");
  assert.equal(r("Merci {nom} ! Le tarif vous attend dans vos messages"), "Merci ! Le tarif vous attend dans vos messages");
  assert.equal(r("{nom}, votre commande est notée"), "Votre commande est notée");
  assert.equal(r("Bonjour {nom} 👋 Écrivez-nous"), "Bonjour 👋 Écrivez-nous");
  assert.equal(r("Un message de {page}"), "Un message de Ma Page");
});

const rule = (id: string, accountIds: string[], extra: Record<string, unknown> = {}) => ({
  id, matchType: "CONTAINS" as const, trigger: "prix", channel: "ALL" as const, accountIds, postId: null, priority: 0, createdAt: new Date(2026, 0, 1), ...extra,
});
const ids = (rs: Array<{ id: string }>) => rs.map((r) => r.id).sort();

test("règle multi-comptes : seuls les comptes listés la déclenchent", () => {
  const rules = [rule("r1", ["a", "b"])];
  assert.deepEqual(ids(candidateRules(rules, { kind: "COMMENT", accountId: "a" })), ["r1"]);
  assert.deepEqual(ids(candidateRules(rules, { kind: "COMMENT", accountId: "b" })), ["r1"]);
  assert.deepEqual(ids(candidateRules(rules, { kind: "COMMENT", accountId: "c" })), []);
});

test("liste vide = tous les comptes", () => {
  assert.deepEqual(ids(candidateRules([rule("r1", [])], { kind: "DIRECT", accountId: "zzz" })), ["r1"]);
});

test("publication ciblée : il faut aussi la bonne publication", () => {
  const rules = [rule("r1", ["a"], { postId: "p1" })];
  assert.deepEqual(ids(candidateRules(rules, { kind: "COMMENT", accountId: "a", postId: "p1" })), ["r1"]);
  assert.deepEqual(ids(candidateRules(rules, { kind: "COMMENT", accountId: "a", postId: "p2" })), []);
  assert.deepEqual(ids(candidateRules(rules, { kind: "COMMENT", accountId: "b", postId: "p1" })), []);
});
