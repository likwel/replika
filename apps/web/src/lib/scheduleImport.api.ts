import { api } from "./api";

// Import de publications depuis un tableur (Google Sheets, CSV) : voir apps/api/src/modules/schedules/import.*.ts

type Res<T> = { status: string; data: T };

export type ColumnKey = "date" | "heure" | "texte" | "compte" | "media" | "lien" | "statut";
export type RowState = "ok" | "error" | "skipped" | "past";

export interface ImportRow {
  line: number;
  state: RowState;
  errors: string[];
  warnings: string[];
  text: string;
  scheduledAt: string | null;
  accountIds: string[];
  accountNames: string[];
  mediaUrl: string | null;
  link: string | null;
  draft: boolean;
}

export interface ImportPreview {
  columns: { found: ColumnKey[]; missing: ColumnKey[]; unknown: string[] };
  rows: ImportRow[];
  truncated: boolean;
  limit: number;
  counts: { ok: number; error: number; ignored: number; total: number };
}

export interface RowResult {
  line: number;
  state: "created" | "duplicate" | "error" | "skipped" | "past";
  message?: string;
  scheduleId?: string;
}

export interface ImportSummary { created: number; duplicates: number; errors: number; skipped: number; past: number }

export interface ScheduleSource {
  id: string;
  name: string;
  url: string;
  accountIds: string[];
  asDraft: boolean;
  autoSync: boolean;
  intervalMinutes: number;
  lastSyncAt: string | null;
  lastStatus: "OK" | "ERROR" | null;
  lastMessage: string | null;
  importedCount: number;
  createdAt: string;
}

export interface ImportTemplate {
  rows: string[][];
  columns: Array<{ key: ColumnKey; label: string; required: boolean; hint: string }>;
}

export interface ImportRequest {
  source: { url?: string; csv?: string };
  accountIds: string[];
  asDraft: boolean;
}

export const scheduleImportApi = {
  template: () => api.get<Res<ImportTemplate>>("/schedules/import/template").then((r) => r.data),
  preview: (body: ImportRequest) => api.post<Res<ImportPreview>>("/schedules/import/preview", body).then((r) => r.data),
  commit: (body: ImportRequest & { save?: { name: string; autoSync: boolean; intervalMinutes: number } }) =>
    api.post<Res<{ results: RowResult[]; summary: ImportSummary; source: ScheduleSource | null }>>("/schedules/import/commit", body).then((r) => r.data),
  sources: () => api.get<Res<ScheduleSource[]>>("/schedules/sources").then((r) => r.data),
  updateSource: (id: string, patch: Partial<Pick<ScheduleSource, "name" | "autoSync" | "intervalMinutes" | "asDraft" | "accountIds">>) =>
    api.patch<Res<ScheduleSource>>(`/schedules/sources/${id}`, patch).then((r) => r.data),
  removeSource: (id: string) => api.delete<void>(`/schedules/sources/${id}`),
  syncSource: (id: string) => api.post<Res<{ results: RowResult[]; summary: ImportSummary }>>(`/schedules/sources/${id}/sync`).then((r) => r.data),
};

// Modèle : CSV à télécharger (séparateur « ; » et BOM pour Excel) et texte à coller dans Google Sheets (tabulations)
const csvCell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const templateCsv = (rows: string[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
export const templateTsv = (rows: string[][]) => rows.map((r) => r.map((c) => c.replace(/[\t\n]+/g, " ")).join("\t")).join("\n");

export const INTERVALS: Array<{ value: number; label: string }> = [
  { value: 15, label: "Toutes les 15 min" },
  { value: 60, label: "Toutes les heures" },
  { value: 360, label: "Toutes les 6 heures" },
  { value: 1440, label: "Une fois par jour" },
];
