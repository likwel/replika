import { fold, parseCsv } from "../schedules/import.logic.js";

// Listes d'articles pour les lives : lecture d'un tableur, correspondance des colonnes choisie par l'utilisateur,
// articles prêts à joindre à une session. Logique pure : le réseau est dans list.service.ts.

export const MAX_LIST_ROWS = 500;
export const MAX_CELLS = 40_000; // taille du tableur gardé en base

export type FieldKey = "code" | "name" | "price" | "stock";

export const FIELDS: Array<{ key: FieldKey; label: string; required: boolean; hint: string; aliases: string[] }> = [
  { key: "code", label: "Code", required: true, hint: "Le code que vous annoncez à l'antenne (ex. A3, 12) : le client écrit « jp A3 ».", aliases: ["code", "ref", "reference", "n", "no", "numero", "num", "jp", "id", "sku", "code article", "code produit"] },
  { key: "name", label: "Article", required: true, hint: "Le nom repris dans les messages envoyés au client.", aliases: ["article", "nom", "produit", "designation", "libelle", "name", "titre", "description", "nom article", "nom produit", "nom de l article"] },
  { key: "price", label: "Prix (Ar)", required: false, hint: "Prix en ariary : 25000, 25 000 ou « 25 000 Ar ».", aliases: ["prix", "prix ar", "prix unitaire", "price", "montant", "tarif", "pu", "prix de vente", "prix mga"] },
  { key: "stock", label: "Stock", required: false, hint: "Quantité disponible ; vide ou « ∞ » : illimité (liste d'attente quand il est épuisé).", aliases: ["stock", "quantite", "qte", "qty", "disponible", "dispo", "inventaire", "quantite disponible"] },
];

export type Mapping = Record<FieldKey, string | null>; // champ → en-tête de la colonne

export interface Table { headers: string[]; rows: string[][] }

// Première ligne = en-têtes ; lignes vides ignorées ; tableur gardé borné
export function toTable(text: string): Table {
  const all = parseCsv(text, true); // lignes vides gardées : les numéros de ligne restent ceux du tableur
  const headers = (all[0] ?? []).map((h) => h.trim());
  const width = headers.length;
  return { headers, rows: all.slice(1, MAX_LIST_ROWS + 1).map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim())) };
}

export const tooBig = (t: Table) => t.rows.length * Math.max(1, t.headers.length) > MAX_CELLS;

// Correspondance proposée d'après les en-têtes (modifiable par l'utilisateur) ; une colonne ne sert qu'à un champ
export function suggestMapping(headers: string[]): Mapping {
  const used = new Set<number>();
  const pick = (aliases: string[]): string | null => {
    const i = headers.findIndex((h, idx) => !used.has(idx) && h.trim() && aliases.some((a) => fold(a) === fold(h)));
    if (i < 0) return null;
    used.add(i);
    return headers[i];
  };
  return { code: pick(FIELDS[0].aliases), name: pick(FIELDS[1].aliases), price: pick(FIELDS[2].aliases), stock: pick(FIELDS[3].aliases) };
}

// Index de la colonne d'un champ (comparaison sans casse ni accent : une colonne renommée « Prix » → « prix » se retrouve)
const indexOf = (headers: string[], name: string | null) => (name ? headers.findIndex((h) => fold(h) === fold(name) && h.trim() !== "") : -1);

export function mappingProblems(headers: string[], mapping: Mapping): string[] {
  const problems: string[] = [];
  for (const f of FIELDS) {
    if (mapping[f.key] && indexOf(headers, mapping[f.key]) < 0) problems.push(`Colonne « ${mapping[f.key]} » introuvable (${f.label})`);
    if (f.required && !mapping[f.key]) problems.push(`Choisissez la colonne du champ « ${f.label} »`);
  }
  const chosen = FIELDS.map((f) => mapping[f.key]).filter(Boolean).map((c) => fold(c!));
  if (new Set(chosen).size < chosen.length) problems.push("Une même colonne ne peut pas servir à deux champs");
  return problems;
}

// 25000 · 25 000 · « 25 000 Ar » · 25.000 · 25,000 · 25000,00 → 25000 ; illisible → undefined ; vide → null
export function parsePrice(raw: string): number | null | undefined {
  const s = raw.toLowerCase().replace(/[\s  ]/g, "").replace(/(ariary|mga|ar)$/g, "");
  if (!s) return null;
  if (!/^\d[\d.,]*$/.test(s)) return undefined;
  const sep = s.match(/[.,](\d+)$/);
  // Un séparateur suivi de 3 chiffres est un séparateur de milliers (25.000), sinon des décimales (25000,50)
  const n = sep && sep[1].length !== 3 ? Math.round(Number(s.slice(0, -sep[0].length).replace(/[.,]/g, "") + "." + sep[1])) : Number(s.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

// Stock : vide, « ∞ », « illimité » → null (illimité) ; nombre entier sinon ; illisible → undefined
export function parseStock(raw: string): number | null | undefined {
  const word = fold(raw.replace(/∞/g, " inf "));
  if (!word || ["inf", "illimite", "illimitee", "oui", "infini", "unlimited"].includes(word)) return null;
  const n = Number(raw.replace(/[\s\u00a0\u202f]/g, ""));
  return /^\d+$/.test(raw.replace(/[\s\u00a0\u202f]/g, "")) && Number.isInteger(n) ? n : undefined;
}

export interface Item { code: string; name: string; price: number | null; stock: number | null }
export interface Issue { line: number; level: "error" | "warning"; message: string }

// Applique la correspondance : articles valides + problèmes ligne par ligne (la ligne 1 du tableur = en-têtes)
export function buildItems(table: Table, mapping: Mapping): { items: Item[]; issues: Issue[]; skipped: number } {
  const blocking = mappingProblems(table.headers, mapping);
  if (blocking.length) return { items: [], issues: blocking.map((message) => ({ line: 1, level: "error" as const, message })), skipped: 0 };
  const ix = { code: indexOf(table.headers, mapping.code), name: indexOf(table.headers, mapping.name), price: indexOf(table.headers, mapping.price), stock: indexOf(table.headers, mapping.stock) };
  const byCode = new Map<string, Item>();
  const issues: Issue[] = [];
  let skipped = 0;
  table.rows.forEach((r, i) => {
    const line = i + 2;
    const code = (r[ix.code] ?? "").trim();
    const name = (r[ix.name] ?? "").trim();
    if (!code && !name) return; // ligne vide ou séparatrice
    if (!code || !name) {
      skipped++;
      return void issues.push({ line, level: "error", message: !code ? "Code manquant" : "Nom de l'article manquant" });
    }
    if (code.length > 20) {
      skipped++;
      return void issues.push({ line, level: "error", message: `Code trop long (20 caractères maximum) : « ${code.slice(0, 24)} »` });
    }
    let price: number | null = null;
    if (ix.price >= 0) {
      const p = parsePrice(r[ix.price] ?? "");
      if (p === undefined) issues.push({ line, level: "warning", message: `Prix illisible « ${r[ix.price]} » : article importé sans prix` });
      else price = p;
    }
    let stock: number | null = null;
    if (ix.stock >= 0) {
      const s = parseStock(r[ix.stock] ?? "");
      if (s === undefined) issues.push({ line, level: "warning", message: `Stock illisible « ${r[ix.stock]} » : article importé en stock illimité` });
      else stock = s;
    }
    const key = code.toLowerCase();
    if (byCode.has(key)) issues.push({ line, level: "warning", message: `Le code « ${code} » est déjà dans la liste : la dernière ligne l'emporte` });
    byCode.delete(key); // la dernière ligne l'emporte, en fin de liste
    byCode.set(key, { code, name: name.slice(0, 120), price: price !== null ? Math.min(price, 1_000_000_000) : null, stock: stock !== null ? Math.min(stock, 100_000) : null });
  });
  return { items: [...byCode.values()], issues, skipped };
}
