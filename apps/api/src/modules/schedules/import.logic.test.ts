import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRows, mapColumns, parseCsv, parseDateTime, resolveAccounts, templateRows, toCsv, toDirectMediaUrl, toSheetCsvUrl, type AccountRef } from "./import.logic.js";

// npx tsx --test src/modules/schedules/import.logic.test.ts

const now = new Date("2026-11-18T06:00:00Z"); // 09:00 à Madagascar
const accounts: AccountRef[] = [
  { id: "fb1", name: "Boutique Tana Mode", platform: "FACEBOOK", isActive: true },
  { id: "ig1", name: "@vanille.co", platform: "INSTAGRAM", isActive: true },
  { id: "fb2", name: "Ancienne Page", platform: "FACEBOOK", isActive: false },
];

test("liens Google Sheets : partage, onglet (gid) et feuille publiée", () => {
  assert.equal(toSheetCsvUrl("https://docs.google.com/spreadsheets/d/AbC-123_x/edit#gid=0").url, "https://docs.google.com/spreadsheets/d/AbC-123_x/export?format=csv&gid=0");
  assert.equal(toSheetCsvUrl("https://docs.google.com/spreadsheets/d/AbC-123_x/edit?usp=sharing").url, "https://docs.google.com/spreadsheets/d/AbC-123_x/export?format=csv");
  assert.equal(toSheetCsvUrl("https://docs.google.com/spreadsheets/d/e/2PACX-1v/pubhtml?gid=55").url, "https://docs.google.com/spreadsheets/d/e/2PACX-1v/pub?output=csv&gid=55");
  assert.equal(toSheetCsvUrl("https://exemple.com/posts.csv").kind, "csv");
  assert.throws(() => toSheetCsvUrl("pas un lien"));
});

test("liens de médias : Drive et Dropbox deviennent des téléchargements directs", () => {
  assert.equal(toDirectMediaUrl("https://drive.google.com/file/d/1AbC_d-E/view?usp=sharing"), "https://drive.google.com/uc?export=download&id=1AbC_d-E");
  assert.equal(toDirectMediaUrl("https://drive.google.com/open?id=1AbC"), "https://drive.google.com/uc?export=download&id=1AbC");
  assert.equal(toDirectMediaUrl("https://www.dropbox.com/s/xyz/photo.jpg?dl=0"), "https://www.dropbox.com/s/xyz/photo.jpg?raw=1");
  assert.equal(toDirectMediaUrl("https://cdn.exemple.com/a.png"), "https://cdn.exemple.com/a.png");
  assert.throws(() => toDirectMediaUrl("https://drive.google.com/drive/folders/abc"), /dossier/);
});

test("CSV : guillemets, virgules et retours à la ligne dans une cellule, délimiteur détecté", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","il dit ""salut""\nsuite"\n'), [["a", "b"], ["x, y", 'il dit "salut"\nsuite']]);
  assert.deepEqual(parseCsv("﻿Date;Texte\r\n20/11/2026;Bonjour\r\n\r\n"), [["Date", "Texte"], ["20/11/2026", "Bonjour"]]);
  assert.deepEqual(parseCsv("Date\tTexte\n1\t2"), [["Date", "Texte"], ["1", "2"]]);
});

test("colonnes reconnues malgré accents, casse et synonymes", () => {
  const m = mapColumns(["DATE", "Heure de publication", "Légende", "Page", "Lien du média", "Lien partagé", "Statut", "Notes"]);
  assert.deepEqual(m.index, { date: 0, heure: 1, texte: 2, compte: 3, media: 4, lien: 5, statut: 6 });
  assert.deepEqual(m.missing, []);
  assert.deepEqual(m.unknown, ["Notes"]);
  assert.deepEqual(mapColumns(["Date", "Image"]).missing, ["texte"]);
});

test("dates : jour avant mois, heure à Madagascar, date et heure dans la même cellule", () => {
  const at = (d: string, h = "") => {
    const r = parseDateTime(d, h, now);
    return "at" in r ? r.at.toISOString() : r.error;
  };
  assert.equal(at("20/11/2026", "14:30"), "2026-11-20T11:30:00.000Z");
  assert.equal(at("2026-11-20", "14h30"), "2026-11-20T11:30:00.000Z");
  assert.equal(at("20 novembre 2026", "9h"), "2026-11-20T06:00:00.000Z");
  assert.equal(at("20/11/2026 18:45"), "2026-11-20T15:45:00.000Z");
  assert.equal(at("5/12/26", "2:15 pm"), "2026-12-05T11:15:00.000Z");
  assert.equal(at("20/11/2026"), "2026-11-20T06:00:00.000Z"); // 09:00 par défaut
  assert.match(at("31/02/2026"), /illisible/);
  assert.match(at("", ""), /manquante/);
  assert.match(at("20/11/2026", "25:00"), /Heure illisible/);
});

test("comptes : noms exacts, plateformes, « tous », inconnus et désactivés signalés", () => {
  assert.deepEqual(resolveAccounts("boutique tana mode", accounts), { ids: ["fb1"], errors: [] });
  assert.deepEqual(resolveAccounts("Vanille.co", accounts).ids, ["ig1"]);
  assert.deepEqual(resolveAccounts("Facebook", accounts).ids, ["fb1"]); // la Page désactivée est exclue
  assert.deepEqual(resolveAccounts("Tous", accounts).ids.sort(), ["fb1", "ig1"]);
  assert.deepEqual(resolveAccounts("Inconnue", accounts).errors, ["Compte « Inconnue » introuvable"]);
  assert.deepEqual(resolveAccounts("Ancienne Page", accounts).errors, ["Ancienne Page est désactivé"]);
});

const table = (...rows: string[][]) => [["Date", "Heure", "Texte", "Compte", "Lien du média", "Lien partagé", "Statut"], ...rows];

test("lignes : valides, en erreur, passées, ignorées et brouillons", () => {
  const { rows } = buildRows(
    table(
      ["20/11/2026", "10:00", "Promo", "Boutique Tana Mode", "https://x.com/a.jpg", "", ""], // ok
      ["20/11/2026", "10:00", "Promo IG", "Vanille.co", "", "", ""], // Instagram sans image
      ["01/11/2026", "10:00", "Trop tard", "Boutique Tana Mode", "", "", ""], // passée
      ["21/11/2026", "", "Autre", "Boutique Tana Mode", "", "", "non"], // ignorée
      ["22/11/2026", "08:00", "À relire", "", "", "", "brouillon"], // brouillon, comptes par défaut
      ["22/11/2026", "08:00", "", "Boutique Tana Mode", "", "", ""], // texte vide
      ["22/11/2026", "08:00", "Lien KO", "Boutique Tana Mode", "ftp://x", "", ""],
    ),
    { accounts, defaultAccountIds: ["fb1"], now },
  );
  assert.deepEqual(rows.map((r) => r.state), ["ok", "error", "past", "skipped", "ok", "error", "error"]);
  assert.match(rows[1].errors[0], /Instagram exige une image/);
  assert.equal(rows[4].draft, true);
  assert.deepEqual(rows[4].accountIds, ["fb1"]);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[0].scheduledAt, "2026-11-20T07:00:00.000Z");
});

test("importer en brouillons accepte les dates passées ; l'empreinte ne dépend que de la date, du texte et des comptes", () => {
  const row = ["01/11/2026", "10:00", "Ancien", "Boutique Tana Mode", "", "", ""];
  assert.equal(buildRows(table(row), { accounts, defaultAccountIds: [], now, asDraft: true }).rows[0].state, "ok");
  const a = buildRows(table(row), { accounts, defaultAccountIds: [], now }).rows[0].key;
  const b = buildRows(table([...row.slice(0, 4), "https://x.com/autre.jpg", "", ""]), { accounts, defaultAccountIds: [], now }).rows[0].key;
  assert.equal(a, b);
  assert.notEqual(a, buildRows(table(["02/11/2026", ...row.slice(1)]), { accounts, defaultAccountIds: [], now }).rows[0].key);
});

test("colonne obligatoire absente : aucune ligne n'est lue", () => {
  const r = buildRows([["Date", "Image"], ["20/11/2026", "x"]], { accounts, defaultAccountIds: [], now });
  assert.deepEqual(r.columns.missing, ["texte"]);
  assert.equal(r.rows.length, 0);
});

test("le modèle téléchargeable est lisible par l'import lui-même", () => {
  const rows = templateRows(["Boutique Tana Mode", "@vanille.co"], now);
  const { rows: parsed, columns } = buildRows(parseCsv(toCsv(rows)), { accounts, defaultAccountIds: [], now });
  assert.deepEqual(columns.missing, []);
  assert.deepEqual(parsed.map((r) => r.state), ["ok", "ok", "ok"]);
  assert.equal(parsed[2].draft, true);
  assert.deepEqual(parsed[1].accountIds.sort(), ["fb1", "ig1"]);
});

test("les lignes vides gardent leur place : le numéro de ligne affiché est celui du tableur", () => {
  const t = parseCsv("Date,Texte,Compte\n20/11/2026,Un,Boutique Tana Mode\n,,\n21/11/2026,,Boutique Tana Mode", true);
  const { rows } = buildRows(t, { accounts, defaultAccountIds: [], now });
  assert.deepEqual(rows.map((r) => [r.line, r.state]), [[2, "ok"], [4, "error"]]); // la ligne vide 3 est sautée sans bruit
});
