import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItems, mappingProblems, parsePrice, parseStock, suggestMapping, toTable } from "./list.logic.js";

// npx tsx --test src/modules/lives/list.logic.test.ts

test("correspondance proposée : synonymes, accents, une colonne pour un seul champ", () => {
  assert.deepEqual(suggestMapping(["Réf", "Désignation", "Prix de vente", "Qté", "Couleur"]), { code: "Réf", name: "Désignation", price: "Prix de vente", stock: "Qté" });
  assert.deepEqual(suggestMapping(["Produit", "Tarif"]), { code: null, name: "Produit", price: "Tarif", stock: null });
  // « Nom » ne sert pas deux fois : Code reste vide
  assert.equal(suggestMapping(["Nom", "Article"]).code, null);
});

test("prix : espaces, Ar, séparateurs de milliers ou décimales, illisible", () => {
  for (const [raw, want] of [["25000", 25000], ["25 000", 25000], ["25 000 Ar", 25000], ["25.000", 25000], ["25,000", 25000], ["1.250.000", 1250000], ["25000,50", 25001], ["25000.5", 25001], ["12Ar", 12], ["", null]] as const) {
    assert.equal(parsePrice(raw), want, raw);
  }
  assert.equal(parsePrice("gratuit"), undefined);
  assert.equal(parsePrice("-5"), undefined);
});

test("stock : vide ou illimité = null, entier, illisible", () => {
  assert.equal(parseStock(""), null);
  assert.equal(parseStock("∞"), null);
  assert.equal(parseStock("Illimité"), null);
  assert.equal(parseStock("12"), 12);
  assert.equal(parseStock("2,5"), undefined);
  assert.equal(parseStock("-1"), undefined);
});

const csv = "Réf;Désignation;Prix;Qté;Notes\nA3;Robe fleurie;25 000 Ar;2;x\nA4;Sac raphia;15.000;;\n;;;;\nA5;;10000;1;\nB1;Chapeau;gratuit;abc;\na3;Robe fleurie v2;27000;1;\nTROP-LONG-CODE-DE-PLUS-DE-VINGT;X;1;1;";

test("tableur → articles : mapping choisi, lignes vides sautées, erreurs et avertissements par ligne", () => {
  const table = toTable(csv);
  const mapping = { code: "Réf", name: "Désignation", price: "Prix", stock: "Qté" };
  const { items, issues, skipped } = buildItems(table, mapping);
  assert.deepEqual(items.map((i) => [i.code, i.name, i.price, i.stock]), [["A4", "Sac raphia", 15000, null], ["B1", "Chapeau", null, null], ["a3", "Robe fleurie v2", 27000, 1]]);
  assert.equal(skipped, 2); // A5 sans nom, code trop long
  const text = issues.map((i) => `${i.line}:${i.level}:${i.message}`).join("\n");
  assert.match(text, /5:error:Nom de l'article manquant/);
  assert.match(text, /6:warning:Prix illisible « gratuit »/);
  assert.match(text, /6:warning:Stock illisible « abc »/);
  assert.match(text, /7:warning:Le code « a3 » est déjà dans la liste/);
  assert.match(text, /8:error:Code trop long/);
});

test("l'utilisateur choisit les colonnes : ordre libre, colonnes inutiles ignorées, prix et stock facultatifs", () => {
  const table = toTable("Photo,Libellé,N°,Divers\nx,Robe,12,y\nx,Sac,13,z");
  const { items } = buildItems(table, { code: "N°", name: "Libellé", price: null, stock: null });
  assert.deepEqual(items, [{ code: "12", name: "Robe", price: null, stock: null }, { code: "13", name: "Sac", price: null, stock: null }]);
});

test("correspondance invalide : champ obligatoire absent, colonne inconnue, colonne utilisée deux fois", () => {
  const h = ["Code", "Nom", "Prix"];
  assert.deepEqual(mappingProblems(h, { code: null, name: "Nom", price: null, stock: null }), ["Choisissez la colonne du champ « Code »"]);
  assert.match(mappingProblems(h, { code: "Code", name: "Nom", price: "Tarif", stock: null })[0], /introuvable/);
  assert.match(mappingProblems(h, { code: "Code", name: "Code", price: null, stock: null })[0], /deux champs/);
  assert.equal(buildItems(toTable("Code,Nom\n1,A"), { code: null, name: "Nom", price: null, stock: null }).items.length, 0);
});

test("une colonne renommée majuscules/accents est retrouvée à l'actualisation", () => {
  const t = toTable("CODE,NOM,PRIX\n1,Robe,100");
  assert.equal(buildItems(t, { code: "Code", name: "Nom", price: "Prix", stock: null }).items[0].price, 100);
});
