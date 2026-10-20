import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient } from "../facebook/graph.client.js";
import { pollSession } from "./live.capture.js";
import { getEntitlements } from "../billing/entitlements.js";
import { accrueLiveTime, liveQuotaReached, markLiveQuotaHit } from "../billing/usage.js";

// État du direct (EN DIRECT / terminé) relu toutes les minutes environ
const STATUS_EVERY_MS = 60 * 1000;
// Session sans nouveau commentaire depuis 12 h : terminée automatiquement (le robot cesse de la lire)
const IDLE_END_MS = 12 * 60 * 60 * 1000;

// Temps actif ajouté au quota d'heures de live environ toutes les minutes (et à chaque changement d'état)
const ACCRUE_EVERY_MS = 60 * 1000;

const lastStatusCheck = new Map<string, number>();

type ActiveSession = Awaited<ReturnType<typeof prisma.liveSession.findMany>>[number];

// Met la session en pause (abonnement expiré, quota atteint) : la capture des JP s'arrête
async function pauseSession(s: ActiveSession, reason: string, action: string) {
  await accrueLiveTime(s, { stop: true });
  const { count } = await prisma.liveSession.updateMany({ where: { id: s.id, status: "ACTIVE" }, data: { status: "PAUSED", syncError: reason } });
  if (count) await prisma.activityLog.create({ data: { userId: s.userId, action, meta: { sessionId: s.id, title: s.title } } });
}

// Abonnement et quota d'heures : retourne false si la session a été mise en pause
async function checkAllowance(s: ActiveSession): Promise<boolean> {
  const ent = await getEntitlements(s.userId);
  if (!ent.active) {
    await pauseSession(s, "Abonnement expiré : capture des commandes en pause. Renouvelez votre formule pour reprendre.", "LIVE_PAUSED_SUBSCRIPTION");
    return false;
  }
  if (s.activeSince && Date.now() - s.activeSince.getTime() >= ACCRUE_EVERY_MS) await accrueLiveTime(s);
  if (await liveQuotaReached(s.userId)) {
    const first = await markLiveQuotaHit(s.userId);
    await pauseSession(
      s,
      `Quota de ${ent.limits.liveHours} h de live atteint ce mois-ci : passez à une formule supérieure pour continuer.`,
      first ? "LIVE_QUOTA_REACHED" : "LIVE_PAUSED_QUOTA",
    );
    return false;
  }
  return true;
}

async function tick() {
  const sessions = await prisma.liveSession.findMany({ where: { status: "ACTIVE" }, include: { account: true } });
  await Promise.all(
    sessions.map(async (s) => {
      if (!s.account.isActive) return;
      if (!(await checkAllowance(s))) return;
      await pollSession(s).catch(() => {}); // erreur enregistrée sur la session (syncError)

      if (s.liveVideoId && Date.now() - (lastStatusCheck.get(s.id) ?? 0) > STATUS_EVERY_MS) {
        lastStatusCheck.set(s.id, Date.now());
        const liveStatus = await graphClient.getLiveVideoStatus(s.liveVideoId, s.account.accessToken).catch(() => null);
        if (liveStatus && liveStatus !== s.liveStatus) await prisma.liveSession.update({ where: { id: s.id }, data: { liveStatus } });
      }

      const lastActivity = (s.cursor ?? s.createdAt).getTime();
      if (s.liveStatus !== "LIVE" && Date.now() - lastActivity > IDLE_END_MS) {
        await accrueLiveTime(s, { stop: true });
        await prisma.liveSession.update({ where: { id: s.id }, data: { status: "ENDED", endedAt: new Date() } });
      }
    })
  );
}

export function startLivePoller() {
  if (env.livePollSeconds <= 0) {
    console.log("🎥 Lives : lecture des commentaires désactivée (LIVE_POLL_SECONDS=0)");
    return () => {};
  }
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return; // passage précédent pas encore terminé
    busy = true;
    try {
      await tick();
    } catch (e) {
      console.error("❌ Lives :", e);
    } finally {
      busy = false;
    }
  }, env.livePollSeconds * 1000);
  console.log(`🎥 Lives : commentaires des sessions actives lus toutes les ${env.livePollSeconds} s`);
  return () => clearInterval(timer);
}
