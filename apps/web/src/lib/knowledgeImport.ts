import { fileToCsvText } from "@/components/live/live";

// Import de connaissances pour l'assistant IA : un fichier (.txt, .csv, .xlsx) ou un Google Sheet devient du texte lisible.
// Un tableur est mis en phrases courtes « Colonne : valeur » : c'est ce qui aide le plus le modèle à répondre juste.

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 400;

// Texte CSV → lignes de cellules (guillemets, séparateur détecté : tabulation, « ; » ou « , »)
export function parseCells(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const sample = clean.split(/\r?\n/).slice(0, 5).join("\n");
  const sep = sample.includes("\t") ? "\t" : (sample.match(/;/g)?.length ?? 0) >= (sample.match(/,/g)?.length ?? 0) && sample.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((v) => v.trim())).filter((r) => r.some(Boolean));
}

// Tableau → texte : en-têtes + une ligne par enregistrement (« Produit : Robe · Prix : 25 000 Ar »)
export function tableToText(rows: string[][]): { text: string; rows: number; cut: boolean } {
  if (rows.length === 0) return { text: "", rows: 0, cut: false };
  const width = Math.max(...rows.map((r) => r.length));
  // Une seule colonne : chaque cellule est déjà une ligne de texte
  if (width < 2) return { text: rows.map((r) => r[0]).join("\n"), rows: rows.length, cut: false };
  const [head, ...body] = rows;
  const cut = body.length > MAX_ROWS;
  const lines = body.slice(0, MAX_ROWS).map((r) =>
    head
      .map((h, i) => (r[i] ? (h ? `${h} : ${r[i]}` : r[i]) : ""))
      .filter(Boolean)
      .join(" · "),
  );
  return { text: lines.filter(Boolean).join("\n"), rows: lines.filter(Boolean).length, cut };
}

export const csvToKnowledge = (csv: string) => tableToText(parseCells(csv));

export interface ImportedText {
  text: string;
  rows: number;
  cut: boolean; // lignes ignorées au-delà de la limite
}

// Fichier du navigateur → texte : .txt/.md tels quels, .csv et .xlsx lus comme un tableur
export async function fileToKnowledge(file: File): Promise<ImportedText> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Fichier trop volumineux (2 Mo maximum).");
  if (ext === "txt" || ext === "md") {
    const text = (await file.text()).replace(/^﻿/, "").trim();
    return { text, rows: text ? text.split(/\r?\n/).filter(Boolean).length : 0, cut: false };
  }
  if (ext === "csv") return csvToKnowledge(await file.text());
  if (ext === "xlsx") return csvToKnowledge(await fileToCsvText(file));
  if (ext === "xls") throw new Error("Le format .xls (ancien Excel) n'est pas lu : enregistrez le fichier en .xlsx ou en .csv.");
  throw new Error("Format non pris en charge : choisissez un fichier .txt, .csv ou .xlsx.");
}
