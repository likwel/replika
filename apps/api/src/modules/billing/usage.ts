import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { usageDay, usageMonth } from "./billing.logic.js";
import { getEntitlements, inactiveError, invalidateEntitlements } from "./entitlements.js";

// Consommation mensuelle : réponses IA et heures de live

async function ensureUsage(userId: string, month: string) {
  try {
    await prisma.usage.upsert({ where: { userId_month: { userId, month } }, create: { userId, month }, update: {} });
  } catch (e) {
    // Création simultanée de la même ligne : elle existe, c'est ce qu'on voulait
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
}

export function getUsage(userId: string, month = usageMonth()) {
  return prisma.usage.findUnique({ where: { userId_month: { userId, month } } });
}

// ─── Réponses IA ─────────────────────────────────────────────────────────────

// Réponse IA décomptée : sur le quota du mois de la formule, ou sur les crédits achetés
export interface AiCharge {
  month: string;
  source: "quota" | "credit";
}

// Décompte une réponse IA : quota du mois d'abord, puis crédits de réponses achetés.
// Refuse si les deux sont épuisés (ou l'abonnement terminé sans crédit). Le résultat est à passer
// à refundAiReply si le modèle échoue.
export async function consumeAiReply(userId: string): Promise<AiCharge> {
  const ent = await getEntitlements(userId);
  if (ent.blocked) throw inactiveError(ent);
  const month = usageMonth();
  await ensureUsage(userId, month);
  const limit = ent.limits.aiReplies;
  if (ent.active) {
    if (limit === null) {
      await prisma.usage.update({ where: { userId_month: { userId, month } }, data: { aiReplies: { increment: 1 } } });
      await countAiDay(1);
      return { month, source: "quota" };
    }
    // Une seule requête conditionnelle : deux réponses simultanées ne peuvent pas dépasser le quota
    const { count } = await prisma.usage.updateMany({
      where: { userId, month, aiReplies: { lt: limit } },
      data: { aiReplies: { increment: 1 } },
    });
    if (count) {
      await countAiDay(1);
      return { month, source: "quota" };
    }
    const first = await prisma.usage.updateMany({ where: { userId, month, aiQuotaHitAt: null }, data: { aiQuotaHitAt: new Date() } });
    if (first.count) await prisma.activityLog.create({ data: { userId, action: "AI_QUOTA_REACHED", meta: { month, limit } } });
  }
  if (await consumeReplyCredit(userId, month)) {
    await countAiDay(1);
    return { month, source: "credit" };
  }
  throw creditsError(ent, limit);
}

// Plus rien pour répondre : message adapté (abonnement terminé, ou quota du mois atteint)
function creditsError(ent: Awaited<ReturnType<typeof getEntitlements>>, limit: number | null): AppError {
  if (!ent.active) {
    const what = ent.kind === "TRIAL" ? "Votre essai gratuit est terminé" : "Votre abonnement a expiré";
    return new AppError(`${what} : rechargez des crédits de réponses ou renouvelez votre formule.`, 402, "REPLY_CREDITS_REQUIRED");
  }
  return new AppError(
    `Quota de ${(limit ?? 0).toLocaleString("fr-FR")} réponses IA du mois atteint : le message reste dans « À traiter ». Rechargez des crédits de réponses ou passez à une formule supérieure.`,
    402,
    "QUOTA_EXCEEDED",
  );
}

// Retire un crédit de réponse (requête conditionnelle : jamais en dessous de zéro)
export async function consumeReplyCredit(userId: string, month = usageMonth()): Promise<boolean> {
  const { count } = await prisma.subscription.updateMany({ where: { userId, replyCredits: { gt: 0 } }, data: { replyCredits: { decrement: 1 } } });
  if (!count) return false;
  invalidateEntitlements(userId); // le solde sert à décider si les réponses automatiques continuent
  await ensureUsage(userId, month);
  await prisma.usage.update({ where: { userId_month: { userId, month } }, data: { replyCreditUsed: { increment: 1 } } });
  return true;
}

// Compteur quotidien de la plateforme (coût IA d'une période, tableau de bord administrateur)
async function countAiDay(delta: 1 | -1) {
  const day = usageDay();
  await prisma.aiDailyUsage
    .upsert({ where: { day }, create: { day, replies: Math.max(0, delta) }, update: { replies: { increment: delta } } })
    .catch(() => {}); // une statistique ne bloque jamais une réponse
}

// Le modèle n'a pas répondu : la réponse n'est pas décomptée (quota ou crédit rendu)
export async function refundAiReply(userId: string, charge: AiCharge) {
  const { month } = charge;
  if (charge.source === "credit") {
    await returnReplyCredit(userId, month);
  } else {
    await prisma.usage
      .updateMany({ where: { userId, month, aiReplies: { gt: 0 } }, data: { aiReplies: { decrement: 1 } } })
      .catch(() => {});
  }
  await countAiDay(-1);
}

// Rend un crédit retiré pour une réponse finalement non produite ou non envoyée
export async function returnReplyCredit(userId: string, month: string) {
  await prisma.subscription.updateMany({ where: { userId }, data: { replyCredits: { increment: 1 } } }).catch(() => {});
  await prisma.usage
    .updateMany({ where: { userId, month, replyCreditUsed: { gt: 0 } }, data: { replyCreditUsed: { decrement: 1 } } })
    .catch(() => {});
  invalidateEntitlements(userId);
}

// ─── Heures de live ──────────────────────────────────────────────────────────

// Une session sans direct en cours n'est décomptée que jusqu'à 30 min après son dernier commentaire :
// une session oubliée (fermée automatiquement après 12 h) ne consomme pas le quota.
const IDLE_BILLING_MS = 30 * 60_000;

export interface LiveMeter {
  id: string;
  userId: string;
  activeSince: Date | null;
  liveStatus: string | null;
  cursor: Date | null;
  createdAt: Date;
}

// Ajoute le temps actif écoulé depuis activeSince au quota du mois.
// stop : la session quitte l'état ACTIVE (activeSince remis à null) ; sinon le décompte repart de maintenant.
export async function accrueLiveTime(s: LiveMeter, opts: { stop?: boolean; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const from = s.activeSince;
  if (!from) return 0;
  let end = now.getTime();
  if (s.liveStatus !== "LIVE") {
    const lastActivity = (s.cursor ?? s.createdAt).getTime();
    end = Math.min(end, lastActivity + IDLE_BILLING_MS);
  }
  const seconds = Math.max(0, Math.round((end - from.getTime()) / 1000));
  // Verrou optimiste : la même tranche n'est jamais décomptée deux fois (poller et action simultanés)
  const { count } = await prisma.liveSession.updateMany({
    where: { id: s.id, activeSince: from },
    data: { activeSince: opts.stop ? null : now },
  });
  if (count !== 1) return 0;
  s.activeSince = opts.stop ? null : now; // l'objet reste utilisable pour un décompte suivant
  if (seconds === 0) return 0;

  // Le quota mensuel de la formule passe en premier, puis les heures achetées à l'unité
  const ent = await getEntitlements(s.userId);
  const month = usageMonth(from);
  await ensureUsage(s.userId, month);
  let fromQuota = 0;
  if (ent.active) {
    const limit = ent.limits.liveHours;
    const used = (await getUsage(s.userId, month))?.liveSeconds ?? 0;
    fromQuota = limit === null ? seconds : Math.max(0, Math.min(seconds, limit * 3600 - used));
  }
  const taken = await consumeLiveCredit(s.userId, seconds - fromQuota);
  // Sans crédit, le dépassement reste visible dans la consommation du mois (la session est mise en pause)
  const toUsage = fromQuota + (ent.active ? seconds - fromQuota - taken : 0);
  await prisma.usage.update({
    where: { userId_month: { userId: s.userId, month } },
    data: { liveSeconds: { increment: toUsage }, liveCreditUsed: { increment: taken } },
  });
  return seconds;
}

// Retire jusqu'à `seconds` du crédit d'heures achetées ; retourne ce qui a été retiré
async function consumeLiveCredit(userId: string, seconds: number): Promise<number> {
  if (seconds <= 0) return 0;
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { liveCreditSeconds: true } });
  const take = Math.min(seconds, sub?.liveCreditSeconds ?? 0);
  if (take <= 0) return 0;
  const { count } = await prisma.subscription.updateMany({
    where: { userId, liveCreditSeconds: { gte: take } },
    data: { liveCreditSeconds: { decrement: take } },
  });
  if (count) invalidateEntitlements(userId);
  return count ? take : 0;
}

export async function liveCredit(userId: string): Promise<number> {
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { liveCreditSeconds: true } });
  return sub?.liveCreditSeconds ?? 0;
}

// Live Manager utilisable : formule active avec des heures restantes ce mois-ci, ou heures achetées
export async function liveAllowance(userId: string): Promise<{ ok: true } | { ok: false; reason: "inactive" | "quota" | "blocked"; error: AppError }> {
  const ent = await getEntitlements(userId);
  if (ent.blocked) return { ok: false, reason: "blocked", error: inactiveError(ent) };
  if (ent.active) {
    const limit = ent.limits.liveHours;
    if (limit === null) return { ok: true };
    const used = (await getUsage(userId))?.liveSeconds ?? 0;
    if (used < limit * 3600) return { ok: true };
  }
  if ((await liveCredit(userId)) > 0) return { ok: true };
  if (!ent.active) {
    const what = ent.kind === "TRIAL" ? "Votre essai gratuit est terminé" : "Votre abonnement a expiré";
    return {
      ok: false,
      reason: "inactive",
      error: new AppError(`${what} : achetez des heures de Live Manager à l'unité ou renouvelez votre formule.`, 402, "LIVE_HOURS_REQUIRED"),
    };
  }
  return {
    ok: false,
    reason: "quota",
    error: new AppError(
      `Quota de ${ent.limits.liveHours} h de live atteint ce mois-ci : achetez des heures à l'unité ou passez à une formule supérieure.`,
      402,
      "LIVE_HOURS_REQUIRED",
    ),
  };
}

export async function assertCanRunLive(userId: string) {
  const a = await liveAllowance(userId);
  if (!a.ok) throw a.error;
}

// Premier dépassement du mois : journalisé une seule fois
export async function markLiveQuotaHit(userId: string): Promise<boolean> {
  const month = usageMonth();
  const { count } = await prisma.usage.updateMany({ where: { userId, month, liveQuotaHitAt: null }, data: { liveQuotaHitAt: new Date() } });
  return count > 0;
}
