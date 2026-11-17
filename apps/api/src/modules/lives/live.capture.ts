import type { LiveSession, SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { graphClient, isNetworkError } from "../facebook/graph.client.js";
import { handleIncoming } from "../autoreply/autoreply.engine.js";
import { explain, recoverSession } from "./live.service.js";

const COMMENT_OVERLAP_MS = 15 * 1000;

// Lecture des nouveaux commentaires d'une session (robot et bouton « Actualiser »).
// Chaque commentaire passe par le moteur : les JP vont à la session, les autres (prix, questions…)
// reçoivent les réponses automatiques habituelles. Renvoie le nombre de commandes créées.
export interface PollResult {
  orders: number; // commandes JP créées par ce passage
  fetched: number; // commentaires relus
  complete: boolean; // false : plafond de lecture atteint (très gros rattrapage), le reste sera repris au passage suivant
  recovered: { orders: number; messages: number; replies: number };
}

// Reprise des commentaires non-JP restés sans traitement (arrêt entre l'enregistrement du commentaire et sa réponse)
const RECOVER_REPLIES_EVERY_MS = 5 * 60 * 1000;
const RECOVER_REPLIES_WINDOW_MS = 3 * 60 * 60 * 1000;
const lastReplyRecovery = new Map<string, number>();

async function recoverUnansweredComments(session: LiveSession & { account: SocialAccount }): Promise<number> {
  const last = lastReplyRecovery.get(session.id) ?? 0;
  if (Date.now() - last < RECOVER_REPLIES_EVERY_MS) return 0;
  lastReplyRecovery.set(session.id, Date.now());
  const acc = session.account;
  const comments = await prisma.liveComment.findMany({
    where: {
      sessionId: session.id,
      isJp: false,
      createdAt: { gt: new Date(Math.max(Date.now() - RECOVER_REPLIES_WINDOW_MS, session.createdAt.getTime())), lt: new Date(Date.now() - 90_000) },
      text: { not: "" },
      NOT: { authorId: acc.externalId },
    },
    select: { externalId: true, authorId: true, authorName: true, text: true, createdAt: true },
  });
  if (!comments.length) return 0;
  const seen = new Set(
    (await prisma.socialMessage.findMany({ where: { accountId: acc.id, externalId: { in: comments.map((c) => c.externalId) } }, select: { externalId: true } })).map((m) => m.externalId)
  );
  let n = 0;
  for (const c of comments.filter((c) => !seen.has(c.externalId))) {
    await handleIncoming(acc, { kind: "COMMENT", externalId: c.externalId, authorId: c.authorId ?? undefined, authorName: c.authorName, content: c.text, postId: session.postId ?? session.objectId, createdAt: c.createdAt, recovery: true })
      .then(() => n++)
      .catch((e) => console.error(`❌ Reprise du commentaire ${c.externalId} :`, e));
  }
  return n;
}

// Lecture des nouveaux commentaires d'une session (robot et bouton « Actualiser »).
// Chaque commentaire passe par le moteur : les JP vont à la session, les autres (prix, questions…)
// reçoivent les réponses de la session. La lecture remonte page par page jusqu'au dernier commentaire déjà traité :
// après un arrêt du serveur, une pause ou un pic de commentaires, aucun JP n'est perdu.
export async function pollSession(session: LiveSession & { account: SocialAccount }): Promise<PollResult> {
  const acc = session.account;
  const none: PollResult = { orders: 0, fetched: 0, complete: true, recovered: { orders: 0, messages: 0, replies: 0 } };
  if (acc.platform !== "FACEBOOK" && acc.platform !== "INSTAGRAM") return none;
  const since = session.cursor ? session.cursor.getTime() - COMMENT_OVERLAP_MS : null;
  let read;
  try {
    read = await graphClient.getCommentsSince(session.objectId, acc.platform, acc.accessToken, since);
  } catch (e) {
    if (!isNetworkError(e)) {
      await prisma.liveSession.update({ where: { id: session.id }, data: { syncError: explain(e), lastPolledAt: new Date() } });
    }
    throw e;
  }
  const fresh = read.items.filter((c) => since === null || c.createdAt.getTime() >= since).sort((a, b) => +a.createdAt - +b.createdAt);
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
      // Lecture plafonnée : le décalage est signalé sur la session (le curseur avance quand même pour ne pas tout relire sans fin)
      syncError: read.complete ? null : "Très gros volume de commentaires depuis la dernière lecture : certains plus anciens n'ont pas pu être relus. Vérifiez le tableau des JP.",
      ...(latest && (!session.cursor || latest > session.cursor) ? { cursor: latest } : {}),
    },
  });
  const recoveredJp = await recoverSession(session).catch((e) => {
    console.error(`❌ Reprise de la session ${session.id} :`, e);
    return { orders: 0, messages: 0 };
  });
  const replies = await recoverUnansweredComments(session).catch(() => 0);
  return {
    orders: (await prisma.liveOrder.count({ where: { sessionId: session.id } })) - before,
    fetched: fresh.length,
    complete: read.complete,
    recovered: { ...recoveredJp, replies },
  };
}
