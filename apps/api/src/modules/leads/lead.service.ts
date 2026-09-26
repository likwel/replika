import { Prisma, type Lead, type LeadStatus, type SocialAccount, type SocialMessage } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { graphClient, graphErrorMessage } from "../facebook/graph.client.js";
import { LEAD_THRESHOLD, scoreMessage, temperature } from "./lead.scorer.js";

export type LeadSource = "COMMENT" | "DIRECT" | "LIVE";

export interface LeadInput {
  personId?: string | null;
  psid?: string | null; // identifiant de messagerie, quand il est connu
  name: string;
  text: string;
  source: LeadSource;
  aiIntent?: string | null;
  postId?: string | null;
  bonus?: { points: number; label: string }; // ex. JP en live
  value?: number | null;
  at?: Date;
}

const ENGAGEMENT_BONUS = 5; // chaque nouveau message révélateur d'une même personne
const HISTORY_DAYS = 90;
const personKeyOf = (input: Pick<LeadInput, "personId" | "name">) => input.personId ?? `nom:${input.name.trim().toLowerCase()}`;
const isOwn = (acc: SocialAccount, input: Pick<LeadInput, "personId" | "name">) =>
  (input.personId && input.personId === acc.externalId) || (acc.platform === "INSTAGRAM" && `@${input.name.replace(/^@/, "")}` === acc.name);

// Enregistre un signal d'achat : crée le lead au-dessus du seuil, ou enrichit celui de la personne
export async function recordLead(account: SocialAccount, input: LeadInput): Promise<{ lead: Lead | null; score: number }> {
  if (isOwn(account, input) || !input.text.trim()) return { lead: null, score: 0 };
  const scored = scoreMessage(input.text, { direct: input.source === "DIRECT", aiIntent: input.aiIntent });
  const signals = [...scored.signals, ...(input.bonus ? [input.bonus.label] : [])];
  const score = Math.min(100, scored.score + (input.bonus?.points ?? 0));
  const personKey = personKeyOf(input);

  const existing = await prisma.lead.findFirst({
    where: {
      accountId: account.id,
      OR: [{ personKey }, ...(input.psid ? [{ psid: input.psid }, { personKey: input.psid }] : []), ...(input.personId ? [{ psid: input.personId }] : [])],
    },
  });
  if (!existing && score < LEAD_THRESHOLD) return { lead: null, score };
  if (existing && score === 0) return { lead: existing, score }; // simple conversation avec un lead connu

  const at = input.at ?? new Date();
  const common = {
    intent: scored.intent ?? existing?.intent ?? null,
    lastMessage: input.text.slice(0, 500),
    lastSource: input.source,
    lastSeenAt: existing && existing.lastSeenAt > at ? existing.lastSeenAt : at,
    ...(scored.phone ? { phone: scored.phone } : {}),
    ...(scored.email ? { email: scored.email } : {}),
    ...(input.psid ? { psid: input.psid } : {}),
    ...(input.postId ? { postId: input.postId } : {}),
  };

  if (existing) {
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...common,
        score: Math.min(100, Math.max(existing.score, score) + ENGAGEMENT_BONUS),
        signals: [...new Set([...existing.signals, ...signals])],
        messageCount: { increment: 1 },
        ...(input.value && !existing.value ? { value: input.value } : {}),
      },
    });
    return { lead, score };
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        ...common,
        userId: account.userId,
        accountId: account.id,
        personKey,
        personId: input.personId ?? null,
        name: input.name,
        score,
        signals,
        value: input.value ?? null,
        createdAt: at,
      },
    });
    return { lead, score };
  } catch (e) {
    // Même personne enregistrée en parallèle (webhook + relève) : on enrichit la fiche existante
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return recordLead(account, input);
    throw e;
  }
}

// Analyse un commentaire / message reçu (une seule fois : leadScore enregistré sur le message)
export async function detectLeadFromMessage(account: SocialAccount, msg: SocialMessage) {
  if (msg.leadScore !== null) return null;
  const { lead, score } = await recordLead(account, {
    personId: msg.authorId,
    psid: msg.kind === "DIRECT" ? msg.authorId : null,
    name: msg.authorName,
    text: msg.content,
    source: msg.kind === "DIRECT" ? "DIRECT" : "COMMENT",
    aiIntent: msg.intent,
    postId: msg.postId,
    at: msg.createdAt,
  });
  await prisma.socialMessage.update({ where: { id: msg.id }, data: { leadScore: score } });
  return lead;
}

// ============================================================
// Service (routes)
// ============================================================

const TEMPERATURE_RANGE = { hot: { gte: 70 }, warm: { gte: 45, lt: 70 }, cold: { lt: 45 } } as const;
const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

async function findOwned(userId: string, id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, userId }, include: { account: true } });
  if (!lead) throw new AppError("Lead introuvable", 404);
  return lead;
}

const accountRef = { select: { id: true, name: true, platform: true, avatarUrl: true } } as const;

export const leadService = {
  list(userId: string, q: { status?: string[]; temperature?: string; accountId?: string; search?: string; sort?: string }) {
    const range = q.temperature ? TEMPERATURE_RANGE[q.temperature as keyof typeof TEMPERATURE_RANGE] : undefined;
    const search = q.search?.trim();
    return prisma.lead.findMany({
      where: {
        userId,
        ...(q.status?.length ? { status: { in: q.status.filter((s): s is LeadStatus => STATUSES.includes(s as LeadStatus)) } } : {}),
        ...(range ? { score: range } : {}),
        ...(q.accountId ? { accountId: q.accountId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search } },
                { lastMessage: { contains: search, mode: "insensitive" as const } },
                { note: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { account: accountRef },
      orderBy: q.sort === "recent" ? [{ lastSeenAt: "desc" }] : [{ score: "desc" }, { lastSeenAt: "desc" }],
      take: 1000,
    });
  },

  async stats(userId: string) {
    const leads = await prisma.lead.findMany({ where: { userId }, select: { status: true, score: true, value: true, createdAt: true } });
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));
    const closed = byStatus.WON + byStatus.LOST;
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      total: leads.length,
      hot: leads.filter((l) => temperature(l.score) === "hot" && !["WON", "LOST"].includes(l.status)).length,
      toContact: byStatus.NEW,
      byStatus,
      newThisWeek: leads.filter((l) => l.createdAt.getTime() >= weekAgo).length,
      conversion: closed ? Math.round((byStatus.WON / closed) * 100) : null,
      wonValue: leads.filter((l) => l.status === "WON").reduce((n, l) => n + (l.value ?? 0), 0),
    };
  },

  // Fiche : messages et commandes de la personne
  async get(userId: string, id: string) {
    const lead = await findOwned(userId, id);
    const ids = [lead.personId, lead.psid].filter((x): x is string => Boolean(x));
    const [messages, orders] = await Promise.all([
      ids.length
        ? prisma.socialMessage.findMany({
            where: { accountId: lead.accountId, authorId: { in: ids } },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, kind: true, content: true, createdAt: true, status: true, aiReply: true, leadScore: true, postId: true },
          })
        : [],
      prisma.liveOrder.findMany({
        where: {
          session: { accountId: lead.accountId, userId },
          OR: [...(lead.personId ? [{ customerId: lead.personId }] : []), ...(lead.psid ? [{ recipientId: lead.psid }] : []), { customerName: lead.name }],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, code: true, productName: true, quantity: true, unitPrice: true, status: true, createdAt: true, session: { select: { title: true } } },
      }),
    ]);
    const { account, ...rest } = lead;
    return { ...rest, account: { id: account.id, name: account.name, platform: account.platform, avatarUrl: account.avatarUrl }, messages, orders };
  },

  async update(userId: string, id: string, data: Partial<Pick<Lead, "status" | "note" | "value" | "phone" | "email" | "name">>) {
    await findOwned(userId, id);
    return prisma.lead.update({ where: { id }, data, include: { account: accountRef } });
  },

  async remove(userId: string, id: string) {
    await findOwned(userId, id);
    await prisma.lead.delete({ where: { id } });
  },

  // Message privé au lead : dans sa conversation, sinon en réponse privée à son dernier commentaire
  async message(userId: string, id: string, text: string) {
    const lead = await findOwned(userId, id);
    const acc = lead.account;
    let psid = lead.psid;
    try {
      if (psid) {
        await graphClient.sendMessage(psid, text, acc.accessToken);
      } else {
        const comment = lead.personId
          ? await prisma.socialMessage.findFirst({ where: { accountId: acc.id, authorId: lead.personId, kind: { not: "DIRECT" } }, orderBy: { createdAt: "desc" } })
          : null;
        if (!comment) throw new AppError("Aucune conversation ni commentaire pour joindre cette personne", 422);
        const res = await graphClient.sendPrivateReply(comment.externalId, text, acc.accessToken);
        psid = res.recipient_id ?? null;
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      const raw = graphErrorMessage(e);
      const reason = /outside of allowed window/i.test(raw)
        ? "Plus de 24 h sans message de cette personne : Messenger refuse l'envoi."
        : /already|only.*one/i.test(raw)
          ? "Réponse privée déjà envoyée pour ce commentaire : attendez que la personne vous réponde."
          : raw;
      throw new AppError(`Envoi impossible : ${reason}`, 502);
    }
    await prisma.activityLog.create({ data: { userId, action: "LEAD_CONTACTED", meta: { leadId: id } } });
    return prisma.lead.update({
      where: { id },
      data: { psid, ...(lead.status === "NEW" ? { status: "CONTACTED" } : {}) },
      include: { account: accountRef },
    });
  },

  // Analyse des 90 derniers jours : messages jamais notés, et clients des lives sans fiche
  async rescan(userId: string) {
    const since = new Date(Date.now() - HISTORY_DAYS * 86400000);
    const before = await prisma.lead.count({ where: { userId } });
    const messages = await prisma.socialMessage.findMany({
      where: { account: { userId }, leadScore: null, createdAt: { gte: since } },
      include: { account: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
    for (const m of messages) await detectLeadFromMessage(m.account, m);

    const orders = await prisma.liveOrder.findMany({
      where: { session: { userId }, createdAt: { gte: since } },
      include: { session: { include: { account: true } } },
      orderBy: { createdAt: "asc" },
    });
    for (const o of orders) {
      const acc = o.session.account;
      const known = await prisma.lead.findFirst({
        where: { accountId: acc.id, OR: [{ personKey: personKeyOf({ personId: o.customerId, name: o.customerName }) }, ...(o.recipientId ? [{ psid: o.recipientId }] : [])] },
      });
      if (!known) await recordFromLiveOrder(acc, o);
    }
    const after = await prisma.lead.count({ where: { userId } });
    return { analyzed: messages.length + orders.length, created: after - before };
  },
};

// JP d'un live : lead chaud d'office
export function recordFromLiveOrder(
  account: SocialAccount,
  o: { customerId: string | null; recipientId: string | null; customerName: string; comment: string; unitPrice: number | null; quantity: number; createdAt: Date; productName: string | null; code: string | null }
) {
  return recordLead(account, {
    personId: o.customerId,
    psid: o.recipientId,
    name: o.customerName,
    text: o.comment,
    source: "LIVE",
    bonus: { points: 60, label: `JP en live${o.code ? ` (${o.code})` : ""}` },
    value: o.unitPrice !== null ? o.unitPrice * o.quantity : null,
    at: o.createdAt,
  });
}
