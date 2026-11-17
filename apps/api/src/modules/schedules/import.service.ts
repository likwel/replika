import type { Prisma, ScheduleSource } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { deleteUpload, localUploadName, saveImage, sniffImageType } from "../uploads/upload.service.js";
import { getEntitlements } from "../billing/entitlements.js";
import { scheduleService } from "./schedule.service.js";
import { fetchImage, fetchSheetText, type FetchDeps } from "./import.fetch.js";
import { buildRows, parseCsv, toDirectMediaUrl, toSheetCsvUrl, templateRows, COLUMNS, MAX_IMPORT_ROWS, type AccountRef, type ColumnMap, type ImportRow } from "./import.logic.js";
import type { CommitInput, PreviewInput } from "./import.schema.js";

// Import de publications depuis un tableur : lecture, aperçu ligne par ligne, création des programmations
// (médias téléchargés depuis leurs liens), et relève automatique des sources enregistrées.

type Source = PreviewInput["source"];

export interface RowResult {
  line: number;
  state: "created" | "duplicate" | "error" | "skipped" | "past";
  message?: string;
  scheduleId?: string;
}

export interface Summary { created: number; duplicates: number; errors: number; skipped: number; past: number }

const emptySummary = (): Summary => ({ created: 0, duplicates: 0, errors: 0, skipped: 0, past: 0 });

async function accountsOf(userId: string): Promise<AccountRef[]> {
  const rows = await prisma.socialAccount.findMany({
    where: { userId, platform: { in: ["FACEBOOK", "INSTAGRAM"] } },
    select: { id: true, name: true, platform: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return rows as AccountRef[];
}

async function loadTable(source: Source, deps?: FetchDeps): Promise<{ table: string[][]; sheetUrl: string | null }> {
  if (source.url) {
    let csvUrl: string;
    try {
      csvUrl = toSheetCsvUrl(source.url).url;
    } catch (e) {
      throw new AppError((e as Error).message, 422);
    }
    return { table: parseCsv(await fetchSheetText(csvUrl, deps), true), sheetUrl: source.url };
  }
  return { table: parseCsv(source.csv ?? "", true), sheetUrl: null };
}

function describeColumns(columns: ColumnMap) {
  return {
    found: COLUMNS.filter((c) => columns.index[c.key] !== undefined).map((c) => c.key),
    missing: columns.missing,
    unknown: columns.unknown,
  };
}

const sum = (rows: ImportRow[]) => rows.length;

// Doublon : déjà importée (empreinte de la source) ou programmation identique (même texte, même instant, même compte)
async function isDuplicate(userId: string, row: ImportRow, sourceId: string | null): Promise<boolean> {
  if (sourceId && (await prisma.scheduleSourceRow.findUnique({ where: { sourceId_rowKey: { sourceId, rowKey: row.key } } }))) return true;
  const twin = await prisma.schedule.findFirst({
    where: { userId, kind: "POST", text: row.text, scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null, targets: { some: { accountId: { in: row.accountIds } } } },
    select: { id: true },
  });
  return Boolean(twin);
}

// Télécharge chaque média une seule fois (plusieurs lignes peuvent partager une image) et le range dans les envois du serveur
async function prefetchMedia(rows: ImportRow[], deps?: FetchDeps) {
  const urls = [...new Set(rows.filter((r) => r.state === "ok" && r.mediaUrl).map((r) => r.mediaUrl!))];
  const out = new Map<string, { url: string } | { error: string }>();
  const queue = [...urls];
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      try {
        const body = await fetchImage(toDirectMediaUrl(u), deps);
        const type = sniffImageType(body);
        if (!type) throw new AppError("Le fichier n'est pas une image JPG, PNG ou WebP", 422);
        out.set(u, { url: (await saveImage(body, type)).url });
      } catch (e) {
        out.set(u, { error: e instanceof AppError ? e.message : "Image illisible" });
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

async function createRows(userId: string, rows: ImportRow[], opts: { asDraft: boolean; sourceId: string | null }, deps?: FetchDeps) {
  const media = await prefetchMedia(rows, deps);
  const results: RowResult[] = [];
  const summary = emptySummary();
  for (const row of rows) {
    const done = (r: RowResult) => {
      results.push(r);
      if (r.state === "created") summary.created++;
      else if (r.state === "duplicate") summary.duplicates++;
      else if (r.state === "error") summary.errors++;
      else if (r.state === "past") summary.past++;
      else summary.skipped++;
    };
    if (row.state === "skipped") {
      done({ line: row.line, state: "skipped" });
      continue;
    }
    if (row.state === "past") {
      done({ line: row.line, state: "past", message: row.warnings.at(-1) });
      continue;
    }
    if (row.state === "error") {
      done({ line: row.line, state: "error", message: row.errors.join(" · ") });
      continue;
    }
    if (await isDuplicate(userId, row, opts.sourceId)) {
      if (opts.sourceId) await prisma.scheduleSourceRow.upsert({ where: { sourceId_rowKey: { sourceId: opts.sourceId, rowKey: row.key } }, create: { sourceId: opts.sourceId, rowKey: row.key }, update: {} });
      done({ line: row.line, state: "duplicate", message: "Déjà importée" });
      continue;
    }

    let imageUrl: string | null = null;
    if (row.mediaUrl) {
      const m = media.get(row.mediaUrl);
      if (!m || "error" in m) {
        done({ line: row.line, state: "error", message: `Média : ${m && "error" in m ? m.error : "introuvable"}` });
        continue;
      }
      imageUrl = m.url;
    }
    try {
      const draft = opts.asDraft || row.draft;
      const { schedule } = await scheduleService.create(userId, {
        kind: "POST",
        text: row.text,
        imageUrl,
        link: row.link,
        scheduledAt: row.scheduledAt,
        status: draft ? "DRAFT" : "SCHEDULED",
        targets: row.accountIds.map((accountId) => ({ accountId })),
      });
      if (opts.sourceId) await prisma.scheduleSourceRow.create({ data: { sourceId: opts.sourceId, rowKey: row.key, scheduleId: schedule.id } });
      done({ line: row.line, state: "created", scheduleId: schedule.id });
    } catch (e) {
      const name = localUploadName(imageUrl);
      if (name && !(await prisma.schedule.count({ where: { imageUrl: { endsWith: `/uploads/${name}` } } }))) await deleteUpload(name);
      done({ line: row.line, state: "error", message: e instanceof AppError ? e.message : "Création impossible" });
    }
  }
  return { results, summary };
}

export const importService = {
  // Tableur modèle (en-têtes + exemples) avec les noms de vos comptes ; le navigateur en fait un CSV ou un copier-coller pour Google Sheets
  async template(userId: string) {
    const names = (await accountsOf(userId)).filter((a) => a.isActive).map((a) => a.name);
    return { rows: templateRows(names), columns: COLUMNS.map(({ key, label, required, hint }) => ({ key, label, required, hint })) };
  },

  async preview(userId: string, input: PreviewInput, deps?: FetchDeps) {
    const [{ table }, accounts] = await Promise.all([loadTable(input.source, deps), accountsOf(userId)]);
    if (table.length < 2 && !(table[0] && buildRows(table, { accounts, defaultAccountIds: [] }).columns.missing.length)) {
      throw new AppError("Le tableur ne contient aucune ligne de publication sous les en-têtes", 422);
    }
    const { columns, rows, truncated } = buildRows(table, { accounts, defaultAccountIds: input.accountIds, asDraft: input.asDraft });
    // Doublons déjà en base : signalés dès l'aperçu
    for (const row of rows) {
      if (row.state === "ok" && (await isDuplicate(userId, row, null))) {
        row.state = "skipped";
        row.warnings.push("Déjà programmée à l'identique : ligne ignorée");
      }
    }
    return {
      columns: describeColumns(columns),
      rows,
      truncated,
      limit: MAX_IMPORT_ROWS,
      counts: { ok: rows.filter((r) => r.state === "ok").length, error: rows.filter((r) => r.state === "error").length, ignored: rows.filter((r) => r.state === "skipped" || r.state === "past").length, total: sum(rows) },
    };
  },

  async commit(userId: string, input: CommitInput, deps?: FetchDeps) {
    if (input.save && !input.source.url) throw new AppError("Seul un lien de tableur peut être gardé et relu automatiquement", 422);
    const [{ table }, accounts] = await Promise.all([loadTable(input.source, deps), accountsOf(userId)]);
    const built = buildRows(table, { accounts, defaultAccountIds: input.accountIds, asDraft: input.asDraft });
    if (built.columns.missing.length) throw new AppError("Colonnes obligatoires absentes : Date et Texte", 422);

    let source: ScheduleSource | null = null;
    if (input.save) {
      source = await prisma.scheduleSource.create({
        data: { userId, name: input.save.name, url: input.source.url!, accountIds: input.accountIds, asDraft: input.asDraft, autoSync: input.save.autoSync, intervalMinutes: input.save.intervalMinutes },
      });
    }
    const { results, summary } = await createRows(userId, built.rows, { asDraft: input.asDraft, sourceId: source?.id ?? null }, deps);
    if (source) {
      source = await prisma.scheduleSource.update({
        where: { id: source.id },
        data: { lastSyncAt: new Date(), lastStatus: "OK", lastMessage: summaryText(summary), importedCount: summary.created },
      });
    }
    await prisma.activityLog.create({ data: { userId, action: "SCHEDULE_IMPORTED", meta: { ...summary, sourceId: source?.id ?? null } as Prisma.InputJsonValue } });
    return { results, summary, source };
  },

  listSources: (userId: string) => prisma.scheduleSource.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),

  async updateSource(userId: string, id: string, patch: Partial<Pick<ScheduleSource, "name" | "autoSync" | "intervalMinutes" | "asDraft" | "accountIds">>) {
    await owned(userId, id);
    return prisma.scheduleSource.update({ where: { id }, data: patch });
  },

  async removeSource(userId: string, id: string) {
    await owned(userId, id);
    await prisma.scheduleSource.delete({ where: { id } }); // les programmations déjà créées restent
  },

  // Relève d'une source : lit le tableur, importe les lignes nouvelles, note le résultat
  async sync(userId: string, id: string, deps?: FetchDeps) {
    const source = await owned(userId, id);
    try {
      const [{ table }, accounts] = await Promise.all([loadTable({ url: source.url }, deps), accountsOf(userId)]);
      const built = buildRows(table, { accounts, defaultAccountIds: source.accountIds, asDraft: source.asDraft });
      if (built.columns.missing.length) throw new AppError("Colonnes obligatoires absentes : Date et Texte", 422);
      // Seules les lignes nouvelles comptent : les erreurs déjà vues à la relève précédente ne sont pas rejouées en boucle
      const { results, summary } = await createRows(userId, built.rows, { asDraft: source.asDraft, sourceId: source.id });
      const failed = results.find((r) => r.state === "error");
      await prisma.scheduleSource.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastStatus: summary.errors ? "ERROR" : "OK",
          lastMessage: summaryText(summary) + (failed ? ` — ligne ${failed.line} : ${failed.message}` : ""),
          importedCount: { increment: summary.created },
        },
      });
      if (summary.created) await prisma.activityLog.create({ data: { userId, action: "SCHEDULE_SOURCE_SYNCED", meta: { sourceId: id, ...summary } as Prisma.InputJsonValue } });
      return { results, summary };
    } catch (e) {
      const message = e instanceof AppError ? e.message : "Relève impossible";
      await prisma.scheduleSource.update({ where: { id }, data: { lastSyncAt: new Date(), lastStatus: "ERROR", lastMessage: message } });
      throw e;
    }
  },
};

async function owned(userId: string, id: string) {
  const s = await prisma.scheduleSource.findFirst({ where: { id, userId } });
  if (!s) throw new AppError("Source introuvable", 404);
  return s;
}

export function summaryText(s: Summary): string {
  const parts = [
    s.created && `${s.created} programmée${s.created > 1 ? "s" : ""}`,
    s.duplicates && `${s.duplicates} déjà importée${s.duplicates > 1 ? "s" : ""}`,
    s.past && `${s.past} date${s.past > 1 ? "s" : ""} passée${s.past > 1 ? "s" : ""}`,
    s.skipped && `${s.skipped} ignorée${s.skipped > 1 ? "s" : ""}`,
    s.errors && `${s.errors} en erreur`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Rien de nouveau";
}

let running = false;

// Relève des sources dont l'intervalle est écoulé (appelée par le robot de planification)
export async function runDueSources() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const sources = await prisma.scheduleSource.findMany({ where: { autoSync: true }, orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } }, take: 100 });
    for (const s of sources) {
      if (s.lastSyncAt && now - s.lastSyncAt.getTime() < s.intervalMinutes * 60_000) continue;
      const ent = await getEntitlements(s.userId);
      if (!ent.active) {
        await prisma.scheduleSource.update({ where: { id: s.id }, data: { lastSyncAt: new Date(), lastStatus: "ERROR", lastMessage: "Abonnement terminé : relève suspendue jusqu'au renouvellement" } });
        continue;
      }
      await importService.sync(s.userId, s.id).catch((e) => console.error(`❌ Source d'import ${s.id} :`, e instanceof Error ? e.message : e));
    }
  } finally {
    running = false;
  }
}
