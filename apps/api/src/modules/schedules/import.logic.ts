import crypto from "node:crypto";
import { TEXT_LIMITS } from "./schedule.schema.js";

// Import de publications depuis un tableur (Google Sheets, CSV) : logique pure, sans réseau ni base.
// Tout ce qui touche au réseau est dans import.fetch.ts, aux comptes et aux programmations dans import.service.ts.

export const MAX_IMPORT_ROWS = 200;
export const MAX_SHEET_BYTES = 5 * 1024 * 1024;
const TZ_OFFSET_HOURS = 3; // Madagascar (UTC+3, pas d'heure d'été)
const DEFAULT_HOUR = 9;

// ─── Colonnes reconnues ──────────────────────────────────────────────────────

export type ColumnKey = "date" | "heure" | "texte" | "compte" | "media" | "lien" | "statut";

export const COLUMNS: Array<{ key: ColumnKey; label: string; required: boolean; hint: string; aliases: string[] }> = [
  { key: "date", label: "Date", required: true, hint: "Jour de publication : 20/11/2026 ou 2026-11-20 (jour avant mois). L'heure peut y figurer aussi.", aliases: ["date", "jour", "date de publication", "date publication", "publish date", "day", "date et heure", "date heure"] },
  { key: "heure", label: "Heure", required: false, hint: "14:30 ou 14h30, heure de Madagascar. Vide : 09:00.", aliases: ["heure", "time", "horaire", "heure de publication", "heure publication", "hour"] },
  { key: "texte", label: "Texte", required: true, hint: "Le texte de la publication (légende).", aliases: ["texte", "legende", "message", "contenu", "caption", "text", "publication", "description", "post", "texte de la publication"] },
  { key: "compte", label: "Compte", required: false, hint: "Nom de la Page ou du compte ; plusieurs séparés par une virgule ; « Facebook », « Instagram » ou « Tous ». Vide : comptes choisis à l'import.", aliases: ["compte", "comptes", "page", "pages", "account", "accounts", "destination", "destinations", "cible", "canal", "reseau", "plateforme"] },
  { key: "media", label: "Lien du média", required: false, hint: "Lien d'une image JPG, PNG ou WebP (Google Drive partagé, Dropbox, lien direct). Obligatoire pour Instagram.", aliases: ["media", "image", "photo", "lien media", "lien image", "lien photo", "url image", "url media", "image url", "visuel", "lien du media", "lien de l image", "lien visuel"] },
  { key: "lien", label: "Lien partagé", required: false, hint: "Lien à partager avec la publication Facebook (facultatif).", aliases: ["lien", "link", "url", "lien partage", "lien a partager", "lien de la publication"] },
  { key: "statut", label: "Statut", required: false, hint: "Vide ou « programmer » : programmée. « brouillon » : enregistrée en brouillon. « non » ou « ignorer » : ligne sautée.", aliases: ["statut", "status", "etat", "action", "programmer"] },
];

// Insensible à la casse, aux accents et à la ponctuation : « Légende » = « legende », « Lien du média » = « lien du media »
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ─── Adresses : tableur et médias ────────────────────────────────────────────

const SHEET_ID = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/(?:e\/)?([\w-]+)/i;

// Lien Google Sheets (partage, édition, publié) → adresse d'export CSV ; autre lien : tel quel (CSV en ligne)
export function toSheetCsvUrl(input: string): { url: string; kind: "sheet" | "csv" } {
  const raw = input.trim();
  if (!/^https?:\/\/\S+$/i.test(raw)) throw new Error("Collez l'adresse (https://…) du tableur.");
  const m = raw.match(SHEET_ID);
  if (!m) return { url: raw, kind: "csv" };
  // Feuille « publiée sur le Web » : /d/e/<id>/pubhtml → /d/e/<id>/pub?output=csv
  if (/\/spreadsheets\/d\/e\//i.test(raw)) {
    const base = raw.replace(/\/pub(html)?(\?.*)?$/i, "").replace(/\/+$/, "");
    const gid = raw.match(/[?&#]gid=(\d+)/)?.[1];
    return { url: `${base}/pub?output=csv${gid ? `&gid=${gid}` : ""}`, kind: "sheet" };
  }
  const gid = raw.match(/[?&#]gid=(\d+)/)?.[1];
  return { url: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`, kind: "sheet" };
}

// Lien de partage Google Drive / Dropbox → lien de téléchargement direct ; autre lien : tel quel
export function toDirectMediaUrl(link: string): string {
  const raw = link.trim();
  const drive = raw.match(/^https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/i);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  if (/^https?:\/\/drive\.google\.com\/drive\/folders\//i.test(raw)) throw new Error("Lien de dossier Drive : collez le lien d'un fichier image.");
  if (/^https?:\/\/(www\.)?dropbox\.com\//i.test(raw)) {
    const u = new URL(raw);
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return u.toString();
  }
  return raw;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

// Délimiteur le plus fréquent dans la première ligne (hors guillemets) : « , » (Google Sheets), « ; » (Excel FR) ou tabulation (copier-coller)
function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"]) {
    let n = 0;
    let quoted = false;
    for (const ch of first) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) n++;
    }
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

// Analyse CSV (RFC 4180) : guillemets, guillemets doublés et retours à la ligne dans une cellule
// keepBlank : garde les lignes vides pour que le numéro de ligne reste celui du tableur (aperçu et erreurs)
export function parseCsv(input: string, keepBlank = false): string[][] {
  const text = input.replace(/^﻿/, "");
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return keepBlank ? rows : rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ColumnMap {
  index: Partial<Record<ColumnKey, number>>;
  missing: ColumnKey[]; // colonnes obligatoires absentes
  unknown: string[]; // en-têtes ignorés
}

export function mapColumns(headers: string[]): ColumnMap {
  const index: ColumnMap["index"] = {};
  const unknown: string[] = [];
  headers.forEach((h, i) => {
    const f = fold(h);
    if (!f) return;
    const col = COLUMNS.find((c) => c.aliases.some((a) => fold(a) === f));
    if (col && index[col.key] === undefined) index[col.key] = i;
    else unknown.push(h.trim());
  });
  const missing = COLUMNS.filter((c) => c.required && index[c.key] === undefined).map((c) => c.key);
  return { index, missing, unknown };
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, fevrier: 2, fevr: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7,
  aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12,
};

interface Ymd { y: number; m: number; d: number }

function validYmd(y: number, m: number, d: number): Ymd | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}

// Jour avant mois (usage malgache) : 20/11/2026, 20-11-26, 2026-11-20, 20 novembre 2026
export function parseDay(raw: string, now: Date): Ymd | null {
  const s = fold(raw);
  let m = s.match(/^(\d{4}) (\d{1,2}) (\d{1,2})$/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2}) (\d{1,2}) (\d{2,4})$/);
  if (m) return validYmd(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/);
  if (m && MONTHS[m[2]]) return validYmd(m[3] ? +m[3] : localYear(now), MONTHS[m[2]], +m[1]);
  return null;
}

const localYear = (now: Date) => new Date(now.getTime() + TZ_OFFSET_HOURS * 3600e3).getUTCFullYear();

// 14:30, 14h30, 14h, 2:30 pm
export function parseTime(raw: string): { h: number; min: number } | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d{1,2})(?:[:h](\d{2})?)?(?::\d{2})?(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return h < 24 && min < 60 ? { h, min } : null;
}

// Date + heure saisies à l'heure de Madagascar → instant UTC. Une date et une heure peuvent aussi tenir dans la même cellule.
export function parseDateTime(dateCell: string, timeCell: string, now = new Date()): { at: Date; defaultedTime: boolean } | { error: string } {
  const dateText = dateCell.trim();
  if (!dateText) return { error: "Date manquante" };
  let dayPart = dateText;
  let timePart = timeCell.trim();
  const joined = dateText.match(/^(.*?)(?:[ T]+|\s*à\s*)(\d{1,2}(?:[:h]\d{0,2})?(?::\d{2})?\s*(?:am|pm)?)$/i);
  if (joined && parseDay(joined[1], now)) {
    dayPart = joined[1];
    if (!timePart) timePart = joined[2];
  }
  const day = parseDay(dayPart, now);
  if (!day) return { error: `Date illisible : « ${dateText} » (écrivez 20/11/2026)` };
  const t = timePart ? parseTime(timePart) : { h: DEFAULT_HOUR, min: 0 };
  if (!t) return { error: `Heure illisible : « ${timePart} » (écrivez 14:30)` };
  return { at: new Date(Date.UTC(day.y, day.m - 1, day.d, t.h - TZ_OFFSET_HOURS, t.min)), defaultedTime: !timePart };
}

// ─── Lignes ──────────────────────────────────────────────────────────────────

export interface AccountRef { id: string; name: string; platform: "FACEBOOK" | "INSTAGRAM"; isActive: boolean }

export type RowState = "ok" | "error" | "skipped" | "past";

export interface ImportRow {
  line: number; // numéro de ligne dans le tableur (en-têtes = 1)
  state: RowState;
  errors: string[];
  warnings: string[];
  text: string;
  scheduledAt: string | null; // ISO UTC
  accountIds: string[];
  accountNames: string[];
  mediaUrl: string | null; // lien d'origine
  link: string | null;
  draft: boolean; // colonne Statut : brouillon
  key: string; // empreinte : une même ligne n'est jamais importée deux fois
}

const cell = (row: string[], i: number | undefined) => (i === undefined ? "" : (row[i] ?? "").trim());
const SKIP = new Set(["non", "no", "ignorer", "ignore", "skip", "annule", "annulee", "x", "0", "faux", "false", "publie", "publiee", "envoye", "envoyee", "fait", "done"]);
const DRAFT = new Set(["brouillon", "draft"]);
const NAME_SEP = /[,;|\n]+/;

// Comptes visés par une cellule : noms exacts (sans accent ni casse), « facebook » / « instagram » / « tous »
export function resolveAccounts(spec: string, accounts: AccountRef[]): { ids: string[]; errors: string[] } {
  const active = accounts.filter((a) => a.isActive);
  const found = new Set<string>();
  const errors: string[] = [];
  for (const part of spec.split(NAME_SEP).map((p) => p.trim()).filter(Boolean)) {
    const f = fold(part);
    if (["tous", "tout", "all", "toutes"].includes(f)) active.forEach((a) => found.add(a.id));
    else if (f === "facebook" || f === "fb") active.filter((a) => a.platform === "FACEBOOK").forEach((a) => found.add(a.id));
    else if (f === "instagram" || f === "insta" || f === "ig") active.filter((a) => a.platform === "INSTAGRAM").forEach((a) => found.add(a.id));
    else {
      const hit = accounts.find((a) => fold(a.name.replace(/^@/, "")) === f.replace(/^@/, ""));
      if (!hit) errors.push(`Compte « ${part} » introuvable`);
      else if (!hit.isActive) errors.push(`${hit.name} est désactivé`);
      else found.add(hit.id);
    }
  }
  return { ids: [...found], errors };
}

export const rowKey = (iso: string, text: string, accountIds: string[]) =>
  crypto.createHash("sha1").update(`${iso}|${text.trim()}|${[...accountIds].sort().join(",")}`).digest("hex").slice(0, 24);

const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

export interface BuildContext {
  accounts: AccountRef[];
  defaultAccountIds: string[];
  now?: Date;
  asDraft?: boolean; // tout enregistrer en brouillon : les dates passées ne bloquent pas
}

// Transforme le tableau en lignes validées (sans réseau) ; les erreurs sont par ligne, jamais bloquantes pour les autres
export function buildRows(table: string[][], ctx: BuildContext): { columns: ColumnMap; rows: ImportRow[]; truncated: boolean } {
  const now = ctx.now ?? new Date();
  const columns = mapColumns(table[0] ?? []);
  if (columns.missing.length) return { columns, rows: [], truncated: false };
  const body = table.slice(1);
  const truncated = body.length > MAX_IMPORT_ROWS;
  const byId = new Map(ctx.accounts.map((a) => [a.id, a]));

  const blank = (r: string[]) => r.every((c) => c.trim() === "");
  const buildRow = (r: string[], line: number): ImportRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const text = cell(r, columns.index.texte);
    const status = fold(cell(r, columns.index.statut));
    const mediaUrl = cell(r, columns.index.media) || null;
    const link = cell(r, columns.index.lien) || null;
    const base = { line, text, mediaUrl, link, draft: DRAFT.has(status) };

    if (SKIP.has(status)) return { ...base, state: "skipped", errors: [], warnings: [], scheduledAt: null, accountIds: [], accountNames: [], key: "" };

    if (!text) errors.push("Texte vide");
    else if (text.length > TEXT_LIMITS.POST) errors.push(`Texte trop long (${TEXT_LIMITS.POST} caractères maximum)`);

    const when = parseDateTime(cell(r, columns.index.date), cell(r, columns.index.heure), now);
    let scheduledAt: string | null = null;
    if ("error" in when) errors.push(when.error);
    else {
      scheduledAt = when.at.toISOString();
      if (when.defaultedTime) warnings.push(`Heure absente : ${String(DEFAULT_HOUR).padStart(2, "0")}:00`);
    }

    const spec = cell(r, columns.index.compte);
    let ids = ctx.defaultAccountIds;
    if (spec) {
      const res = resolveAccounts(spec, ctx.accounts);
      errors.push(...res.errors);
      ids = res.ids;
    }
    if (!errors.length && ids.length === 0) errors.push(spec ? "Aucun compte actif ne correspond" : "Aucun compte : renseignez la colonne Compte ou choisissez les comptes à l'import");
    const accounts = ids.map((id) => byId.get(id)).filter((a): a is AccountRef => Boolean(a));

    if (mediaUrl) {
      if (!isUrl(mediaUrl)) errors.push("Lien du média invalide (il doit commencer par https://)");
      else
        try {
          toDirectMediaUrl(mediaUrl);
        } catch (e) {
          errors.push((e as Error).message);
        }
    }
    if (link && !isUrl(link)) errors.push("Lien partagé invalide (il doit commencer par https://)");
    if (!mediaUrl && accounts.some((a) => a.platform === "INSTAGRAM")) errors.push("Instagram exige une image : ajoutez le lien du média");
    if (text && accounts.some((a) => a.platform === "INSTAGRAM") && text.length > TEXT_LIMITS.INSTAGRAM_CAPTION) {
      errors.push(`Légende Instagram trop longue (${TEXT_LIMITS.INSTAGRAM_CAPTION} caractères maximum)`);
    }

    const draft = base.draft || Boolean(ctx.asDraft);
    const past = scheduledAt !== null && new Date(scheduledAt).getTime() < now.getTime() - 60_000;
    const state: RowState = errors.length ? "error" : past && !draft ? "past" : "ok";
    if (state === "past") warnings.push("Date déjà passée : ligne ignorée (mettez une date à venir, ou importez en brouillons)");

    return {
      ...base,
      state,
      errors,
      warnings,
      scheduledAt,
      accountIds: accounts.map((a) => a.id),
      accountNames: accounts.map((a) => a.name),
      key: scheduledAt ? rowKey(scheduledAt, text, accounts.map((a) => a.id)) : "",
    };
  };
  const rows = body.slice(0, MAX_IMPORT_ROWS).flatMap((r, i): ImportRow[] => (blank(r) ? [] : [buildRow(r, i + 2)]));
  return { columns, rows, truncated };
}

// ─── Modèle téléchargeable ───────────────────────────────────────────────────

const csvCell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const ddmmyyyy = (d: Date) => {
  const l = new Date(d.getTime() + TZ_OFFSET_HOURS * 3600e3);
  return `${String(l.getUTCDate()).padStart(2, "0")}/${String(l.getUTCMonth() + 1).padStart(2, "0")}/${l.getUTCFullYear()}`;
};

// Tableur modèle : en-têtes + 3 lignes d'exemple datées des jours à venir, avec les vrais noms de comptes quand on les connaît
export function templateRows(accountNames: string[], now = new Date()): string[][] {
  const acc = accountNames.length ? accountNames : ["Nom de votre Page"];
  const day = (n: number) => ddmmyyyy(new Date(now.getTime() + n * 86_400_000));
  return [
    COLUMNS.map((c) => c.label),
    [day(1), "09:00", "Nouvelle collection disponible dès aujourd'hui ! 🛍️ Commandez en message privé.", acc[0], "https://exemple.com/photos/collection.jpg", "", ""],
    [day(2), "18:30", "Promo du week-end : -20 % sur tout le catalogue.", acc.slice(0, 2).join(", "), "https://drive.google.com/file/d/IDENTIFIANT_DU_FICHIER/view", "https://exemple.com/promo", ""],
    [day(3), "12:00", "Brouillon à relire avant de programmer.", acc[0], "", "", "brouillon"],
  ];
}

export const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
