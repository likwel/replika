import type { SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient, graphErrorMessage, isNetworkError } from "../facebook/graph.client.js";
import { handleIncoming, type IncomingEvent } from "./autoreply.engine.js";

// Chevauchement entre deux passages : Meta indexe parfois avec retard (les doublons sont écartés par l'index unique)
const OVERLAP_MS = 60 * 1000;
// Au-delà, on ne rattrape pas (serveur arrêté longtemps) : Messenger refuse de toute façon après 24 h
const MAX_CATCH_UP_MS = 24 * 60 * 60 * 1000;

const inFlight = new Set<string>();

const after = (iso: string, since: Date) => new Date(iso) > since;

// Filet de sécurité en plus du contrôle par id : le compte Instagram est nommé "@username"
const isOwnInstagram = (acc: SocialAccount, username?: string) =>
  Boolean(username) && `@${username}` === acc.name;

// Autorisations indispensables pour lire les messages et y répondre.
// Vérifiées de façon proactive : sinon l'erreur n'apparaît qu'à l'arrivée d'un nouveau commentaire.
const REQUIRED_SCOPES: Record<"FACEBOOK" | "INSTAGRAM", Array<[scope: string, label: string]>> = {
  FACEBOOK: [
    ["pages_read_user_content", "lire les commentaires"],
    ["pages_manage_engagement", "répondre aux commentaires"],
    ["pages_messaging", "messages privés"],
  ],
  INSTAGRAM: [
    ["instagram_manage_comments", "commentaires Instagram"],
    ["instagram_manage_messages", "messages Instagram"],
  ],
};
const PERMISSION_CHECK_MS = 60 * 60 * 1000;

const PAGE_NOT_AUTHORIZED =
  "Page non autorisée : elle n'a pas été cochée lors de la dernière connexion Facebook. Reconnectez Facebook et sélectionnez-la.";
const permissionCache = new Map<string, { at: number; token: string; missing: string[] }>();

async function missingPermissions(acc: SocialAccount): Promise<string[]> {
  if (acc.platform === "TIKTOK") return [];
  const cached = permissionCache.get(acc.id);
  // Un nouveau jeton (reconnexion) invalide le cache
  if (cached && cached.token === acc.accessToken && Date.now() - cached.at < PERMISSION_CHECK_MS) {
    return cached.missing;
  }
  try {
    const scopes = await graphClient.getTokenScopes(acc.accessToken);
    const missing = REQUIRED_SCOPES[acc.platform].filter(([s]) => !scopes.includes(s)).map(([, label]) => label);
    permissionCache.set(acc.id, { at: Date.now(), token: acc.accessToken, missing });
    return missing;
  } catch {
    return cached?.missing ?? []; // vérification impossible (réseau) : on ne bloque rien
  }
}

// Chaque source lève une erreur si l'API Graph refuse (permission manquante, jeton expiré…)
async function facebookComments(acc: SocialAccount, since: Date): Promise<IncomingEvent[]> {
  const events: IncomingEvent[] = [];
  const posts = await graphClient.getRecentPostIds(acc.externalId, acc.accessToken);
  for (const post of posts.filter((p) => after(p.updated_time, since))) {
    const comments = await graphClient.getRecentComments(post.id, acc.accessToken);
    for (const c of comments.filter((c) => after(c.created_time, since))) {
      events.push({
        kind: "COMMENT",
        externalId: c.id,
        authorId: c.from?.id,
        authorName: c.from?.name ?? "Utilisateur Facebook",
        content: c.message ?? "",
        postId: post.id,
        createdAt: new Date(c.created_time),
      });
    }
  }
  return events;
}

async function instagramComments(acc: SocialAccount, since: Date): Promise<IncomingEvent[]> {
  const events: IncomingEvent[] = [];
  const media = await graphClient.getInstagramMedia(acc.externalId, acc.accessToken);
  for (const m of media) {
    const comments = await graphClient.getInstagramComments(m.id, acc.accessToken);
    for (const c of comments.filter((c) => after(c.timestamp, since))) {
      if (isOwnInstagram(acc, c.from?.username ?? c.username)) continue;
      events.push({
        kind: "COMMENT",
        externalId: c.id,
        authorId: c.from?.id,
        authorName: c.from?.username ?? c.username ?? "Utilisateur Instagram",
        content: c.text ?? "",
        postId: m.id,
        createdAt: new Date(c.timestamp),
      });
    }
  }
  return events;
}

async function directMessages(acc: SocialAccount, since: Date): Promise<IncomingEvent[]> {
  const isIg = acc.platform === "INSTAGRAM";
  const conversations = await graphClient.getConversations(acc.accessToken, isIg ? "instagram" : undefined);
  const events: IncomingEvent[] = [];
  for (const conv of conversations.filter((c) => after(c.updated_time, since))) {
    for (const m of (conv.messages?.data ?? []).filter((m) => after(m.created_time, since))) {
      if (isIg && isOwnInstagram(acc, m.from?.username)) continue;
      events.push({
        kind: "DIRECT",
        externalId: m.id,
        authorId: m.from?.id,
        authorName:
          (isIg ? m.from?.username : undefined) ?? m.from?.name ??
          (isIg ? "Utilisateur Instagram" : "Utilisateur Messenger"),
        content: m.message ?? "",
        createdAt: new Date(m.created_time),
      });
    }
  }
  return events;
}

// Deux sources par compte, chacune avec son curseur : si l'une échoue (ex. Messenger non autorisé),
// l'autre continue, et la source en échec reprendra là où elle s'était arrêtée une fois réparée.
const SOURCES = [
  {
    label: "Commentaires",
    cursor: "lastSyncedAt",
    fetch: (acc: SocialAccount, since: Date) =>
      acc.platform === "INSTAGRAM" ? instagramComments(acc, since) : facebookComments(acc, since),
  },
  { label: "Messages privés", cursor: "dmSyncedAt", fetch: directMessages },
] as const;

// Synchronise un compte. Au premier passage, pose seulement les curseurs :
// on ne répond jamais à l'historique existant.
async function syncAccount(acc: SocialAccount): Promise<{ processed: number; initialized: boolean }> {
  if (inFlight.has(acc.id)) return { processed: 0, initialized: false };
  inFlight.add(acc.id);
  try {
    const tickStart = new Date();
    if (!acc.lastSyncedAt) {
      await prisma.socialAccount.update({
        where: { id: acc.id },
        data: { lastSyncedAt: tickStart, dmSyncedAt: tickStart },
      });
      return { processed: 0, initialized: true };
    }

    const events: IncomingEvent[] = [];
    const errors: string[] = [];
    let networkIssue = false;
    const cursors: Partial<Record<"lastSyncedAt" | "dmSyncedAt", Date>> = {};

    const missing = await missingPermissions(acc);
    if (missing.length) errors.push(`Autorisations manquantes : ${missing.join(", ")}`);

    for (const source of SOURCES) {
      const current = acc[source.cursor] ?? acc.lastSyncedAt;
      const since = new Date(Math.max(+current, +tickStart - MAX_CATCH_UP_MS));
      try {
        events.push(...(await source.fetch(acc, since)));
        // Le curseur ne recule jamais, même si l'intervalle est plus court que le chevauchement
        cursors[source.cursor] = new Date(Math.max(+current, +tickStart - OVERLAP_MS));
      } catch (e) {
        // Échec : le curseur reste en place (ancré s'il n'existait pas) pour tout rattraper une fois réparé
        if (!acc[source.cursor]) cursors[source.cursor] = current;
        if (isNetworkError(e)) {
          networkIssue = true;
          console.warn(`⚠️ Relève ${acc.name} (${source.label}) : ${graphErrorMessage(e)}, nouvel essai au prochain passage`);
        } else {
          errors.push(`${source.label} : ${graphErrorMessage(e).replace(/\s+/g, " ").trim()}`);
        }
      }
    }

    events.sort((a, b) => +(a.createdAt ?? 0) - +(b.createdAt ?? 0));
    let processed = 0;
    for (const ev of events) {
      try {
        if (await handleIncoming(acc, ev)) processed++;
      } catch (e) {
        console.error(`❌ Traitement ${ev.externalId} :`, e);
      }
    }

    // Coupure réseau seule : état inconnu, on garde le diagnostic précédent plutôt que de l'effacer
    // Page décochée lors de la dernière connexion Facebook : cause unique, inutile de lister le reste
    const pageNotAuthorized = errors.some((e) => /impersonat/i.test(e));
    const syncError = pageNotAuthorized
      ? PAGE_NOT_AUTHORIZED
      : errors.length
        ? errors.join(" · ")
        : networkIssue
          ? acc.syncError
          : null;
    if (syncError && syncError !== acc.syncError) console.error(`⚠️ Relève ${acc.name} — ${syncError}`);
    await prisma.socialAccount.update({ where: { id: acc.id }, data: { ...cursors, syncError } });
    return { processed, initialized: false };
  } finally {
    inFlight.delete(acc.id);
  }
}

// Synchronise tous les comptes actifs (ou ceux d'un utilisateur)
export async function pollAccounts(userId?: string) {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      isActive: true,
      platform: { in: ["FACEBOOK", "INSTAGRAM"] },
      ...(userId ? { userId } : {}),
    },
  });

  let processed = 0;
  let initialized = 0;
  for (const acc of accounts) {
    try {
      const r = await syncAccount(acc);
      processed += r.processed;
      if (r.initialized) initialized++;
    } catch (e) {
      console.error(`❌ Synchronisation ${acc.name} :`, graphErrorMessage(e));
    }
  }
  return { accounts: accounts.length, processed, initialized };
}

export function startAutoReplyPoller(): () => void {
  const seconds = env.autoReply.pollSeconds;
  if (!seconds || seconds <= 0) {
    console.log("ℹ️  Polling des réponses auto désactivé (webhooks uniquement)");
    return () => {};
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await pollAccounts();
      if (r.processed) console.log(`🤖 Réponses auto : ${r.processed} nouveau(x) message(s) traité(s)`);
    } catch (e) {
      console.error("❌ Polling réponses auto :", e);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, seconds * 1000);
  void tick();
  console.log(`🤖 Polling des réponses auto toutes les ${seconds}s`);
  return () => clearInterval(timer);
}
