import { test } from "node:test";
import assert from "node:assert/strict";
import { firstName, isPlaceholderName, renderReply } from "./autoreply.matcher.js";

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
