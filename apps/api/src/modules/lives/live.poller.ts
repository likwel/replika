import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient } from "../facebook/graph.client.js";
import { pollSession } from "./live.capture.js";
import { getEntitlements } from "../billing/entitlements.js";
import { accrueLiveTime, liveAllowance, markLiveQuotaHit } from "../billing/usage.js";

// État du direct (EN DIRECT / terminé) relu toutes les minutes environ
const STATUS_EVERY_MS = 60 * 1000;
// Session sans nouveau commentaire depuis 12 h : terminée automatiquement (le robot cesse de la lire)
const IDLE_END_MS = 12 * 60 * 60 * 1000;

// Temps actif ajouté au quota d'heures de live environ toutes les minutes (et à chaque changement d'état)
const ACCRUE_EVERY_MS = 60 * 1000;

// Trou entre deux lectures au-delà duquel le serveur a été arrêté (accident ou volontaire) : les JP publiés entre-temps sont rattrapés
const DOWNTIME_MS = 3 * 60 * 1000;

const lastStatusCheck = new Map<string, number>();

type ActiveSession = Awaited<ReturnType<typeof prisma.liveSession.findMany>>[number];

// Met la session en pause (abonnement expiré, quota atteint) : la capture des JP s'arrête
async function pauseSession(s: ActiveSession, reason: string, action: string) {
  await accrueLiveTime(s, { stop: true });
  const { count } = await prisma.liveSession.updateMany({ where: { id: s.id, status: "ACTIVE" }, data: { status: "PAUSED", syncError: reason } });
  if (count) await prisma.activityLog.create({ data: { userId: s.userId, action, meta: { sessionId: s.id, title: s.title } } });
}

// Heures de live : formule active (quota du mois) ou heures achetées. Retourne false si la session est mise en pause.
async function checkAllowance(s: ActiveSession): Promise<boolean> {
  if (s.activeSince && Date.now() - s.activeSince.getTime() >= ACCRUE_EVERY_MS) await accrueLiveTime(s);
  const allowance = await liveAllowance(s.userId);
  if (allowance.ok) return true;
  if (allowance.reason === "blocked") {
    await pauseSession(s, "Compte suspendu par l'administrateur : capture des commandes arrêtée.", "LIVE_PAUSED_SUBSCRIPTION");
  } else if (allowance.reason === "inactive") {
    await pauseSession(
      s,
      "Abonnement expiré et plus d'heures de live : capture en pause. Achetez des heures ou renouvelez votre formule pour reprendre.",
      "LIVE_PAUSED_SUBSCRIPTION",
    );
  } else {
    const first = await markLiveQuotaHit(s.userId);
    const ent = await getEntitlements(s.userId);
    await pauseSession(
      s,
      `Quota de ${ent.limits.liveHours} h de live atteint ce mois-ci : achetez des heures à l'unité pour continuer.`,
      first ? "LIVE_QUOTA_REACHED" : "LIVE_PAUSED_QUOTA",
    );
  }
  return false;
}

// Le serveur était arrêté : le temps d'arrêt n'est pas du temps de capture, il n'est pas décompté des heures de live
// (sinon une longue coupure épuiserait le quota et mettrait la session en pause au redémarrage)
async function skipDowntime(s: ActiveSession): Promise<number> {
  if (!s.lastPolledAt || !s.activeSince) return 0;
  const gap = Date.now() - s.lastPolledAt.getTime();
  if (gap <= DOWNTIME_MS) return 0;
  await accrueLiveTime(s, { now: new Date(s.lastPolledAt.getTime() + ACCRUE_EVERY_MS) }); // jusqu'à la dernière lecture seulement
  const resumed = new Date();
  await prisma.liveSession.updateMany({ where: { id: s.id }, data: { activeSince: resumed } });
  s.activeSince = resumed;
  return gap;
}

async function tick() {
  const sessions = await prisma.liveSession.findMany({ where: { status: "ACTIVE" }, include: { account: true } });
  await Promise.all(
    sessions.map(async (s) => {
      if (!s.account.isActive) return;
      const downtimeMs = await skipDowntime(s);
      if (!(await checkAllowance(s))) return;
      const result = await pollSession(s).catch(() => null); // erreur enregistrée sur la session (syncError)
      // Rattrapage après une coupure : tracé dans le journal d'activité (ce qui a été relu, repris)
      if (result && downtimeMs > 0) {
        await prisma.activityLog.create({
          data: {
            userId: s.userId,
            action: "LIVE_CATCHUP",
            meta: { sessionId: s.id, title: s.title, downtimeMinutes: Math.round(downtimeMs / 60000), comments: result.fetched, orders: result.orders, recovered: result.recovered, complete: result.complete },
          },
        }).catch(() => {});
        console.log(`🎥 Live « ${s.title} » : rattrapage après ${Math.round(downtimeMs / 60000)} min d'arrêt, ${result.fetched} commentaires relus, ${result.orders} commande(s)`);
      }

      if (s.liveVideoId && Date.now() - (lastStatusCheck.get(s.id) ?? 0) > STATUS_EVERY_MS) {
        lastStatusCheck.set(s.id, Date.now());
        const liveStatus = await graphClient.getLiveVideoStatus(s.liveVideoId, s.account.accessToken).catch(() => null);
        if (liveStatus && liveStatus !== s.liveStatus) await prisma.liveSession.update({ where: { id: s.id }, data: { liveStatus } });
      }

      // Curseur relu après la lecture : un rattrapage vient peut-être de le faire avancer
      const fresh = await prisma.liveSession.findUnique({ where: { id: s.id }, select: { cursor: true } });
      const lastActivity = (fresh?.cursor ?? s.cursor ?? s.createdAt).getTime();
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
    return async () => {};
  }
  let current: Promise<void> | null = null;
  const run = () => {
    if (current) return; // passage précédent pas encore terminé
    current = tick()
      .catch((e) => console.error("❌ Lives :", e))
      .finally(() => {
        current = null;
      });
  };
  const timer = setInterval(run, env.livePollSeconds * 1000);
  run(); // dès le démarrage : les sessions restées actives rattrapent aussitôt les JP publiés pendant l'arrêt
  console.log(`🎥 Lives : commentaires des sessions actives lus toutes les ${env.livePollSeconds} s (rattrapage immédiat au démarrage)`);
  // Arrêt propre : le passage en cours se termine (au plus 20 s) avant la fermeture de la base ; les sessions restent actives
  return async () => {
    clearInterval(timer);
    if (current) await Promise.race([current, new Promise((r) => setTimeout(r, 20_000))]);
  };
}
