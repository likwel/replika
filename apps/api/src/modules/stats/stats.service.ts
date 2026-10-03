import { prisma } from "../../config/prisma.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7; // fenêtre fixe de la Vue globale et des Rapports (l'Engagement a son propre sélecteur)

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

// Variation en % entre deux périodes ; null = pas de comparaison possible (rien sur la période précédente)
function trend(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export const statsService = {
  // Vue globale : totaux des 7 derniers jours, variation vs les 7 jours précédents, taux de réponse
  async overview(userId: string) {
    const since = daysAgo(WINDOW_DAYS);
    const prevSince = daysAgo(WINDOW_DAYS * 2);
    const scope = { account: { userId } } as const;
    const commentKinds = ["COMMENT", "LIVE_COMMENT"] as const;

    const [
      comments, commentsPrev,
      messages, messagesPrev,
      leads, leadsPrev,
      aiReplies, aiRepliesPrev,
      auto, manual, pending,
    ] = await Promise.all([
      prisma.socialMessage.count({ where: { ...scope, kind: { in: [...commentKinds] }, createdAt: { gte: since } } }),
      prisma.socialMessage.count({ where: { ...scope, kind: { in: [...commentKinds] }, createdAt: { gte: prevSince, lt: since } } }),
      prisma.socialMessage.count({ where: { ...scope, kind: "DIRECT", createdAt: { gte: since } } }),
      prisma.socialMessage.count({ where: { ...scope, kind: "DIRECT", createdAt: { gte: prevSince, lt: since } } }),
      prisma.lead.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.lead.count({ where: { userId, createdAt: { gte: prevSince, lt: since } } }),
      prisma.socialMessage.count({ where: { ...scope, aiGenerated: true, createdAt: { gte: since } } }),
      prisma.socialMessage.count({ where: { ...scope, aiGenerated: true, createdAt: { gte: prevSince, lt: since } } }),
      prisma.socialMessage.count({ where: { ...scope, status: "REPLIED", createdAt: { gte: since }, OR: [{ aiGenerated: true }, { ruleId: { not: null } }] } }),
      prisma.socialMessage.count({ where: { ...scope, status: "REPLIED", createdAt: { gte: since }, aiGenerated: false, ruleId: null } }),
      prisma.socialMessage.count({ where: { ...scope, status: { in: ["PENDING", "ESCALATED"] }, createdAt: { gte: since } } }),
    ]);

    return {
      windowDays: WINDOW_DAYS,
      totals: { comments, messages, leads, aiReplies },
      trends: {
        comments: trend(comments, commentsPrev),
        messages: trend(messages, messagesPrev),
        leads: trend(leads, leadsPrev),
        aiReplies: trend(aiReplies, aiRepliesPrev),
      },
      responseRate: { auto, manual, pending, total: auto + manual + pending },
    };
  },

  // Engagement : volume quotidien par plateforme, sur la période choisie
  async engagement(userId: string, days: number) {
    const end = startOfDay(new Date());
    end.setDate(end.getDate() + 1); // borne haute exclusive = demain minuit
    const start = new Date(end.getTime() - days * DAY_MS);

    const rows = await prisma.socialMessage.findMany({
      where: { account: { userId }, createdAt: { gte: start, lt: end } },
      select: { createdAt: true, account: { select: { platform: true } } },
    });

    const buckets = new Map<string, { FACEBOOK: number; INSTAGRAM: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      buckets.set(d.toISOString().slice(0, 10), { FACEBOOK: 0, INSTAGRAM: 0 });
    }
    for (const r of rows) {
      const key = startOfDay(r.createdAt).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b && (r.account.platform === "FACEBOOK" || r.account.platform === "INSTAGRAM")) b[r.account.platform]++;
    }
    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  },

  // Rapports : performance par compte sur les 7 derniers jours
  async accounts(userId: string) {
    const since = daysAgo(WINDOW_DAYS);
    const accounts = await prisma.socialAccount.findMany({
      where: { userId, platform: { in: ["FACEBOOK", "INSTAGRAM"] } },
      select: { id: true, name: true, platform: true, avatarUrl: true },
      orderBy: { createdAt: "asc" },
    });
    if (!accounts.length) return [];
    const accountIds = accounts.map((a) => a.id);

    const [byKind, leadCounts] = await Promise.all([
      prisma.socialMessage.groupBy({ by: ["accountId", "kind"], where: { accountId: { in: accountIds }, createdAt: { gte: since } }, _count: true }),
      prisma.lead.groupBy({ by: ["accountId"], where: { accountId: { in: accountIds }, createdAt: { gte: since } }, _count: true }),
    ]);
    const leadByAccount = new Map(leadCounts.map((l) => [l.accountId, l._count]));

    return accounts.map((a) => {
      const rows = byKind.filter((r) => r.accountId === a.id);
      const comments = rows.filter((r) => r.kind === "COMMENT" || r.kind === "LIVE_COMMENT").reduce((n, r) => n + r._count, 0);
      const messages = rows.find((r) => r.kind === "DIRECT")?._count ?? 0;
      return { ...a, comments, messages, leads: leadByAccount.get(a.id) ?? 0 };
    });
  },

  // Rapports : règles les plus déclenchées (total depuis leur création, pas seulement la fenêtre récente)
  rules: (userId: string) =>
    prisma.automationRule.findMany({
      where: { userId, hitCount: { gt: 0 } },
      select: {
        id: true,
        name: true,
        channel: true,
        autoSend: true,
        hitCount: true,
        lastTriggeredAt: true,
        account: { select: { name: true } },
      },
      orderBy: { hitCount: "desc" },
      take: 10,
    }),
};
