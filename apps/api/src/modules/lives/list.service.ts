import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { fetchSheetText, type FetchDeps } from "../schedules/import.fetch.js";
import { toSheetCsvUrl } from "../schedules/import.logic.js";
import { buildItems, FIELDS, mappingProblems, suggestMapping, tooBig, toTable, type Item, type Mapping, type Table } from "./list.logic.js";

// Listes d'articles pour les lives : lues dans un tableur (Google Sheets, CSV), mises en correspondance colonne par colonne
// puis jointes à une session au démarrage (les articles deviennent le catalogue du live).

type Source = { url?: string; csv?: string };

async function readTable(source: Source, deps?: FetchDeps): Promise<{ table: Table; sheetUrl: string | null }> {
  let table: Table;
  if (source.url) {
    let csvUrl: string;
    try {
      csvUrl = toSheetCsvUrl(source.url).url;
    } catch (e) {
      throw new AppError((e as Error).message, 422);
    }
    table = toTable(await fetchSheetText(csvUrl, deps));
  } else table = toTable(source.csv ?? "");
  if (table.headers.filter(Boolean).length === 0) throw new AppError("Le tableur est vide : la première ligne doit contenir les noms des colonnes", 422);
  if (table.rows.length === 0) throw new AppError("Le tableur ne contient aucun article sous les en-têtes", 422);
  if (tooBig(table)) throw new AppError("Tableur trop volumineux : gardez les colonnes utiles (500 lignes maximum)", 413);
  return { table, sheetUrl: source.url ?? null };
}

const summaryOf = (items: Item[], skipped: number, issues: { level: string }[]) => ({
  count: items.length,
  skipped,
  warnings: issues.filter((i) => i.level === "warning").length,
});

const owned = async (userId: string, id: string) => {
  const l = await prisma.liveProductList.findFirst({ where: { id, userId } });
  if (!l) throw new AppError("Liste introuvable", 404);
  return l;
};

const asMapping = (v: Prisma.JsonValue): Mapping => v as unknown as Mapping;
const meta = { id: true, name: true, sourceUrl: true, mapping: true, headers: true, itemCount: true, lastSyncAt: true, lastStatus: true, lastMessage: true, createdAt: true, updatedAt: true } as const;

export const listService = {
  // Étape « colonnes » : en-têtes lus, aperçu des premières lignes et correspondance proposée
  async read(source: Source, deps?: FetchDeps) {
    const { table } = await readTable(source, deps);
    return { headers: table.headers, sample: table.rows.slice(0, 5), rowCount: table.rows.length, suggested: suggestMapping(table.headers), fields: FIELDS.map(({ key, label, required, hint }) => ({ key, label, required, hint })) };
  },

  async preview(source: Source, mapping: Mapping, deps?: FetchDeps) {
    const { table } = await readTable(source, deps);
    const { items, issues, skipped } = buildItems(table, mapping);
    return { items, issues, ...summaryOf(items, skipped, issues) };
  },

  async create(userId: string, input: { name: string; source: Source; mapping: Mapping }, deps?: FetchDeps) {
    const { table, sheetUrl } = await readTable(input.source, deps);
    const problems = mappingProblems(table.headers, input.mapping);
    if (problems.length) throw new AppError(problems[0], 422);
    const { items, issues, skipped } = buildItems(table, input.mapping);
    if (items.length === 0) throw new AppError(issues.find((i) => i.level === "error")?.message ?? "Aucun article valide dans ce tableur", 422);
    const list = await prisma.liveProductList.create({
      data: {
        userId, name: input.name, sourceUrl: sheetUrl, mapping: input.mapping as Prisma.InputJsonValue, headers: table.headers,
        rows: table.rows as Prisma.InputJsonValue, items: items as unknown as Prisma.InputJsonValue, itemCount: items.length,
        lastSyncAt: new Date(), lastStatus: "OK", lastMessage: `${items.length} article${items.length > 1 ? "s" : ""}${skipped ? `, ${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""}` : ""}`,
      },
      select: meta,
    });
    return { list, issues };
  },

  list: (userId: string) => prisma.liveProductList.findMany({ where: { userId }, select: meta, orderBy: { updatedAt: "desc" } }),

  async get(userId: string, id: string) {
    const l = await owned(userId, id);
    return { ...l, rows: undefined };
  },

  // Corrige le nom ou la correspondance des colonnes, sans relire le tableur (celui qui a été lu est gardé)
  async update(userId: string, id: string, patch: { name?: string; mapping?: Mapping }) {
    const l = await owned(userId, id);
    const data: Prisma.LiveProductListUpdateInput = {};
    if (patch.name) data.name = patch.name;
    let issues: unknown[] = [];
    if (patch.mapping) {
      const table = { headers: l.headers, rows: l.rows as unknown as string[][] };
      const problems = mappingProblems(table.headers, patch.mapping);
      if (problems.length) throw new AppError(problems[0], 422);
      const built = buildItems(table, patch.mapping);
      if (built.items.length === 0) throw new AppError("Aucun article valide avec cette correspondance", 422);
      issues = built.issues;
      Object.assign(data, { mapping: patch.mapping as Prisma.InputJsonValue, items: built.items as unknown as Prisma.InputJsonValue, itemCount: built.items.length });
    }
    const list = await prisma.liveProductList.update({ where: { id }, data, select: meta });
    return { list, issues };
  },

  // Relit le tableur (lien) avec la correspondance déjà choisie : prix et stock à jour avant le live
  async refresh(userId: string, id: string, deps?: FetchDeps) {
    const l = await owned(userId, id);
    if (!l.sourceUrl) throw new AppError("Cette liste vient d'un fichier : importez-le de nouveau pour la mettre à jour", 422);
    try {
      const { table } = await readTable({ url: l.sourceUrl }, deps);
      const mapping = asMapping(l.mapping);
      const problems = mappingProblems(table.headers, mapping);
      if (problems.length) throw new AppError(`${problems[0]} : une colonne a été renommée ou supprimée dans le tableur`, 422);
      const { items, issues, skipped } = buildItems(table, mapping);
      if (items.length === 0) throw new AppError("Plus aucun article valide dans le tableur", 422);
      const list = await prisma.liveProductList.update({
        where: { id },
        data: {
          headers: table.headers, rows: table.rows as Prisma.InputJsonValue, items: items as unknown as Prisma.InputJsonValue, itemCount: items.length,
          lastSyncAt: new Date(), lastStatus: "OK", lastMessage: `${items.length} article${items.length > 1 ? "s" : ""} à jour${skipped ? `, ${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""}` : ""}`,
        },
        select: meta,
      });
      return { list, items, issues };
    } catch (e) {
      // L'ancienne version reste utilisable ; l'erreur est notée sur la liste
      await prisma.liveProductList.update({ where: { id }, data: { lastSyncAt: new Date(), lastStatus: "ERROR", lastMessage: e instanceof AppError ? e.message : "Lecture impossible" } });
      throw e;
    }
  },

  // Articles à joindre à une session : tableur relu d'abord si c'est un lien ; sinon (ou si la lecture échoue) la dernière version gardée
  async items(userId: string, id: string, refresh: boolean, deps?: FetchDeps) {
    const l = await owned(userId, id);
    if (refresh && l.sourceUrl) {
      try {
        const r = await listService.refresh(userId, id, deps);
        return { items: r.items, refreshed: true, warning: null as string | null };
      } catch (e) {
        return { items: l.items as unknown as Item[], refreshed: false, warning: `Tableur non relu (${e instanceof AppError ? e.message : "erreur"}) : dernière version enregistrée utilisée.` };
      }
    }
    return { items: l.items as unknown as Item[], refreshed: false, warning: null as string | null };
  },

  async remove(userId: string, id: string) {
    await owned(userId, id);
    await prisma.liveProductList.delete({ where: { id } });
  },
};
