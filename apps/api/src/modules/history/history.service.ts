import type { Platform } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import type { HistoryCategory, ListQuery } from "./history.schema.js";

// Catégorie de chaque action : « message » (réponses, commentaires, leads), « connexion » (compte, sécurité,
// Facebook). Les actions absentes de cette liste (programmation, live, préférences…) n'apparaissent que
// dans « Actions », l'onglet qui montre tout sans filtre.
const CATEGORY_OF: Record<string, HistoryCategory> = {
  REGISTER: "connexion",
  LOGIN: "connexion",
  LOGOUT_ALL: "connexion",
  PASSWORD_CHANGED: "connexion",
  PASSWORD_RESET: "connexion",
  EMAIL_CHANGED: "connexion",
  FACEBOOK_CONNECTED: "connexion",
  AUTO_REPLY_SENT: "message",
  AUTO_REPLY_FAILED: "message",
  AI_REPLY_SENT: "message",
  AI_REPLY_FAILED: "message",
  REPLY_SENT: "message",
  COMMENT_POSTED: "message",
  COMMENT_DELETED: "message",
  LEAD_CONTACTED: "message",
};

const ACTIONS_BY_CATEGORY: Record<HistoryCategory, string[]> = {
  message: Object.keys(CATEGORY_OF).filter((a) => CATEGORY_OF[a] === "message"),
  connexion: Object.keys(CATEGORY_OF).filter((a) => CATEGORY_OF[a] === "connexion"),
};

export interface HistoryAccount {
  id: string;
  name: string;
  platform: Platform;
  avatarUrl: string | null;
}

export interface HistoryEntry {
  id: string;
  action: string;
  category: HistoryCategory | null;
  createdAt: Date;
  meta: Record<string, unknown> | null;
  account: HistoryAccount | null;
  // extrait utile : contenu du message, nom du lead, titre du live, texte programmé…
  context: string | null;
}

const asMeta = (m: unknown) => (m && typeof m === "object" ? (m as Record<string, unknown>) : null);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const snippet = (s: string, max = 100) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Enrichit un lot de journaux : résout le compte (Page/Instagram) et un court extrait de contexte,
// à partir des identifiants portés par chaque type d'action (messageId, leadId, sessionId, accountId direct).
async function enrich(rows: Array<{ id: string; action: string; meta: unknown; createdAt: Date }>): Promise<HistoryEntry[]> {
  const metas = new Map(rows.map((r) => [r.id, asMeta(r.meta)]));
  const directAccountIds = new Set<string>();
  const messageIds = new Set<string>();
  const leadIds = new Set<string>();
  const sessionIds = new Set<string>();
  const scheduleIds = new Set<string>();

  for (const r of rows) {
    const m = metas.get(r.id);
    if (!m) continue;
    const accountId = str(m.accountId);
    if (accountId) directAccountIds.add(accountId);
    const messageId = str(m.messageId);
    if (messageId) messageIds.add(messageId);
    const leadId = str(m.leadId);
    if (leadId) leadIds.add(leadId);
    const sessionId = str(m.sessionId);
    if (sessionId) sessionIds.add(sessionId);
    const scheduleId = str(m.scheduleId);
    if (scheduleId) scheduleIds.add(scheduleId);
  }

  const [messages, leads, sessions, schedules] = await Promise.all([
    messageIds.size
      ? prisma.socialMessage.findMany({ where: { id: { in: [...messageIds] } }, select: { id: true, accountId: true, content: true, authorName: true } })
      : [],
    leadIds.size ? prisma.lead.findMany({ where: { id: { in: [...leadIds] } }, select: { id: true, accountId: true, name: true } }) : [],
    sessionIds.size ? prisma.liveSession.findMany({ where: { id: { in: [...sessionIds] } }, select: { id: true, accountId: true, title: true } }) : [],
    scheduleIds.size ? prisma.schedule.findMany({ where: { id: { in: [...scheduleIds] } }, select: { id: true, text: true } }) : [],
  ]);
  const messageById = new Map(messages.map((m) => [m.id, m]));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  for (const m of messages) directAccountIds.add(m.accountId);
  for (const l of leads) directAccountIds.add(l.accountId);
  for (const s of sessions) directAccountIds.add(s.accountId);

  const accounts = directAccountIds.size
    ? await prisma.socialAccount.findMany({ where: { id: { in: [...directAccountIds] } }, select: { id: true, name: true, platform: true, avatarUrl: true } })
    : [];
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return rows.map((r) => {
    const m = metas.get(r.id);
    const messageId = m && str(m.messageId);
    const leadId = m && str(m.leadId);
    const sessionId = m && str(m.sessionId);
    const scheduleId = m && str(m.scheduleId);
    const directAccountId = m && str(m.accountId);

    const message = messageId ? messageById.get(messageId) : undefined;
    const lead = leadId ? leadById.get(leadId) : undefined;
    const session = sessionId ? sessionById.get(sessionId) : undefined;
    const schedule = scheduleId ? scheduleById.get(scheduleId) : undefined;

    const accountId = directAccountId ?? message?.accountId ?? lead?.accountId ?? session?.accountId;
    const account = accountId ? (accountById.get(accountId) ?? null) : null;

    const context = message
      ? snippet(`${message.authorName} : « ${message.content} »`)
      : lead
        ? lead.name
        : session
          ? session.title
          : schedule
            ? snippet(schedule.text)
            : null;

    return {
      id: r.id,
      action: r.action,
      category: CATEGORY_OF[r.action] ?? null,
      createdAt: r.createdAt,
      meta: m ?? null,
      account,
      context,
    };
  });
}

export const historyService = {
  async list(userId: string, q: ListQuery): Promise<{ items: HistoryEntry[]; nextCursor: string | null }> {
    const rows = await prisma.activityLog.findMany({
      where: {
        userId,
        ...(q.category ? { action: { in: ACTIONS_BY_CATEGORY[q.category] } } : {}),
        ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const items = await enrich(page);
    return { items, nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null };
  },

  // Nombre d'entrées par catégorie, pour les compteurs des onglets (sans tout charger)
  async counts(userId: string) {
    const [total, message, connexion] = await Promise.all([
      prisma.activityLog.count({ where: { userId } }),
      prisma.activityLog.count({ where: { userId, action: { in: ACTIONS_BY_CATEGORY.message } } }),
      prisma.activityLog.count({ where: { userId, action: { in: ACTIONS_BY_CATEGORY.connexion } } }),
    ]);
    return { total, message, connexion };
  },
};
