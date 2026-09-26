import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient } from "../facebook/graph.client.js";
import { pollSession } from "./live.capture.js";

// État du direct (EN DIRECT / terminé) relu toutes les minutes environ
const STATUS_EVERY_MS = 60 * 1000;
// Session sans nouveau commentaire depuis 12 h : terminée automatiquement (le robot cesse de la lire)
const IDLE_END_MS = 12 * 60 * 60 * 1000;

const lastStatusCheck = new Map<string, number>();

async function tick() {
  const sessions = await prisma.liveSession.findMany({ where: { status: "ACTIVE" }, include: { account: true } });
  await Promise.all(
    sessions.map(async (s) => {
      if (!s.account.isActive) return;
      await pollSession(s).catch(() => {}); // erreur enregistrée sur la session (syncError)

      if (s.liveVideoId && Date.now() - (lastStatusCheck.get(s.id) ?? 0) > STATUS_EVERY_MS) {
        lastStatusCheck.set(s.id, Date.now());
        const liveStatus = await graphClient.getLiveVideoStatus(s.liveVideoId, s.account.accessToken).catch(() => null);
        if (liveStatus && liveStatus !== s.liveStatus) await prisma.liveSession.update({ where: { id: s.id }, data: { liveStatus } });
      }

      const lastActivity = (s.cursor ?? s.createdAt).getTime();
      if (s.liveStatus !== "LIVE" && Date.now() - lastActivity > IDLE_END_MS) {
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
