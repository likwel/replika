import type { LiveSession, SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { graphClient, isNetworkError } from "../facebook/graph.client.js";
import { handleIncoming } from "../autoreply/autoreply.engine.js";
import { explain } from "./live.service.js";

const COMMENT_OVERLAP_MS = 15 * 1000;

// Lecture des nouveaux commentaires d'une session (robot et bouton « Actualiser »).
// Chaque commentaire passe par le moteur : les JP vont à la session, les autres (prix, questions…)
// reçoivent les réponses automatiques habituelles. Renvoie le nombre de commandes créées.
export async function pollSession(session: LiveSession & { account: SocialAccount }) {
  const acc = session.account;
  if (acc.platform !== "FACEBOOK" && acc.platform !== "INSTAGRAM") return 0;
  let comments;
  try {
    comments = await graphClient.getLatestComments(session.objectId, acc.platform, acc.accessToken);
  } catch (e) {
    if (!isNetworkError(e)) {
      await prisma.liveSession.update({ where: { id: session.id }, data: { syncError: explain(e), lastPolledAt: new Date() } });
    }
    throw e;
  }
  const since = session.cursor ? session.cursor.getTime() - COMMENT_OVERLAP_MS : null;
  const fresh = comments.filter((c) => since === null || c.createdAt.getTime() >= since).sort((a, b) => +a.createdAt - +b.createdAt);
  const before = await prisma.liveOrder.count({ where: { sessionId: session.id } });
  for (const c of fresh) {
    await handleIncoming(acc, {
      kind: "COMMENT",
      externalId: c.id,
      authorId: c.authorId,
      authorName: c.authorName,
      content: c.text,
      postId: session.postId ?? session.objectId,
      createdAt: c.createdAt,
    }).catch((e) => console.error(`❌ Live, commentaire ${c.id} :`, e));
  }
  const latest = fresh.at(-1)?.createdAt;
  await prisma.liveSession.update({
    where: { id: session.id },
    data: {
      lastPolledAt: new Date(),
      syncError: null,
      ...(latest && (!session.cursor || latest > session.cursor) ? { cursor: latest } : {}),
    },
  });
  return (await prisma.liveOrder.count({ where: { sessionId: session.id } })) - before;
}
