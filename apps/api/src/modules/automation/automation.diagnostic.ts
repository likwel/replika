import type { AutomationRule, SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient, graphErrorMessage } from "../facebook/graph.client.js";
import { aiProviderName, isAiConfigured } from "../ai/ai.client.js";
import { isPublicAddress } from "../uploads/upload.service.js";

// Vérifie, compte par compte, tout ce qui conditionne une réponse automatique réelle
export type CheckAction = "reconnect" | "activate" | "create_rule" | "enable_ai" | "resume";

export interface Check {
  id: "active" | "authorized" | "permissions" | "sync" | "comments" | "direct";
  ok: boolean;
  warn?: boolean; // fonctionne, mais seulement en partie (ex. suggestions à valider)
  label: string;
  detail: string;
  action?: CheckAction;
}

const SCOPES = {
  FACEBOOK: { read: "pages_read_user_content", reply: "pages_manage_engagement", direct: "pages_messaging" },
  INSTAGRAM: { read: "instagram_manage_comments", reply: "instagram_manage_comments", direct: "instagram_manage_messages" },
} as const;

const ago = (d: Date) => {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  return s < 90 ? `il y a ${s} s` : s < 5400 ? `il y a ${Math.round(s / 60)} min` : `il y a ${Math.round(s / 3600)} h`;
};

const appliesTo = (r: AutomationRule, acc: SocialAccount, channel: "COMMENT" | "DIRECT") =>
  r.isActive && (!r.accountId || r.accountId === acc.id) && (r.channel === "ALL" || r.channel === channel);

// Qui répond sur ce canal : règles (envoi auto ou suggestion) et assistant IA
function coverage(acc: SocialAccount, rules: AutomationRule[], channel: "COMMENT" | "DIRECT", aiReady: boolean): Check {
  const id = channel === "COMMENT" ? "comments" : "direct";
  const what = channel === "COMMENT" ? "commentaires" : "messages privés";
  const matching = rules.filter((r) => appliesTo(r, acc, channel));
  const auto = matching.filter((r) => r.autoSend);
  const ai = aiReady && acc.aiEnabled && (acc.aiChannel === "ALL" || acc.aiChannel === channel);
  const catchAll = auto.some((r) => r.matchType === "ANY") || (ai && acc.aiAutoSend);

  if (!matching.length && !ai) {
    return { id, ok: false, label: `Réponse aux ${what}`, detail: `Aucune règle ni assistant IA ne s'applique à ce compte : les ${what} restent sans réponse.`, action: "create_rule" };
  }
  if (!auto.length && !(ai && acc.aiAutoSend)) {
    return {
      id,
      ok: true,
      warn: true,
      label: `Réponse aux ${what}`,
      detail: "Réponses préparées mais pas envoyées : validez-les dans Gestion → À traiter, ou activez « Envoi automatique ».",
    };
  }
  const who = [...auto.map((r) => `« ${r.name} »`), ...(ai && acc.aiAutoSend ? ["assistant IA"] : [])].join(", ");
  return {
    id,
    ok: true,
    warn: !catchAll,
    label: `Réponse aux ${what}`,
    detail: catchAll ? `Envoi automatique : ${who}.` : `Envoi automatique pour les mots-clés de ${who} ; les autres ${what} attendent dans Gestion → À traiter.`,
  };
}

export async function diagnose(userId: string) {
  const [user, accounts, rules] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { autoReplyEnabled: true } }),
    prisma.socialAccount.findMany({ where: { userId, platform: { in: ["FACEBOOK", "INSTAGRAM"] } }, orderBy: { createdAt: "asc" } }),
    prisma.automationRule.findMany({ where: { userId }, include: { account: { select: { id: true, name: true, isActive: true, syncError: true } } } }),
  ]);
  const aiReady = isAiConfigured();
  const pollSeconds = env.autoReply.pollSeconds;
  const webhooks = isPublicAddress(env.publicApiUrl) && Boolean(env.fb.webhookVerifyToken);

  const results = await Promise.all(
    accounts.map(async (acc) => {
      const platform = acc.platform as "FACEBOOK" | "INSTAGRAM";
      const checks: Check[] = [];
      checks.push(
        acc.isActive
          ? { id: "active", ok: true, label: "Compte actif", detail: "Activé dans ReplyKA." }
          : { id: "active", ok: false, label: "Compte actif", detail: "Désactivé dans Connexions : rien n'est relevé ni envoyé.", action: "activate" }
      );

      let scopes: string[] | null = null;
      let tokenError: string | null = null;
      try {
        const info = await graphClient.getTokenInfo(acc.accessToken);
        if (info.isValid) scopes = info.scopes;
        else tokenError = "Facebook a retiré l'accès (Page décochée lors de la dernière connexion, ou mot de passe changé).";
      } catch (e) {
        tokenError = `Vérification impossible : ${graphErrorMessage(e)}`;
      }
      const notAuthorized = /non autoris/i.test(acc.syncError ?? "");
      checks.push(
        !tokenError && !notAuthorized
          ? { id: "authorized", ok: true, label: "Accès autorisé par Facebook", detail: "Jeton valide." }
          : { id: "authorized", ok: false, label: "Accès autorisé par Facebook", detail: tokenError ?? acc.syncError!, action: "reconnect" }
      );

      const need = SCOPES[platform];
      const missing = scopes
        ? [
            !scopes.includes(need.read) && "lire les commentaires",
            !scopes.includes(need.reply) && "répondre aux commentaires",
            !scopes.includes(need.direct) && "messages privés",
          ].filter(Boolean)
        : [];
      if (scopes) {
        checks.push(
          missing.length
            ? { id: "permissions", ok: false, label: "Autorisations", detail: `Manquantes : ${missing.join(", ")}.`, action: "reconnect" }
            : { id: "permissions", ok: true, label: "Autorisations", detail: "Lecture et réponse (commentaires et messages) accordées." }
        );
      }

      const last = acc.lastSyncedAt;
      const late = !last || Date.now() - last.getTime() > Math.max(3 * pollSeconds, 180) * 1000;
      const syncProblem = acc.syncError && !notAuthorized ? acc.syncError : null;
      const denied = Boolean(tokenError) || notAuthorized;
      checks.push(
        denied
          ? { id: "sync", ok: false, label: "Relève des nouveaux messages", detail: "Impossible tant que Facebook n'a pas rétabli l'accès à ce compte." }
          : syncProblem
          ? { id: "sync", ok: false, label: "Relève des nouveaux messages", detail: syncProblem, action: "reconnect" }
          : pollSeconds <= 0 && !webhooks
            ? { id: "sync", ok: false, label: "Relève des nouveaux messages", detail: "Relève désactivée (AUTOREPLY_POLL_SECONDS=0) et webhooks inaccessibles." }
            : late && !webhooks
              ? { id: "sync", ok: false, warn: true, label: "Relève des nouveaux messages", detail: last ? `Dernière relève ${ago(last)} : le serveur est-il démarré ?` : "Jamais relevé : cliquez sur Synchroniser." }
              : {
                  id: "sync",
                  ok: true,
                  label: "Relève des nouveaux messages",
                  detail: webhooks ? "Webhooks Meta (instantané) + relève de secours." : `Toutes les ${pollSeconds} s${last ? ` · dernière ${ago(last)}` : ""}.`,
                }
      );

      checks.push(coverage(acc, rules, "COMMENT", aiReady), coverage(acc, rules, "DIRECT", aiReady));

      const blocking = checks.filter((c) => !c.ok && ["active", "authorized", "permissions", "sync"].includes(c.id) && !c.warn);
      const status = blocking.length ? "blocked" : checks.some((c) => !c.ok || c.warn) ? "warning" : "ok";
      return { id: acc.id, name: acc.name, platform: acc.platform, avatarUrl: acc.avatarUrl, status, checks };
    })
  );

  // Règles qui ne peuvent pas fonctionner : leur unique compte est inutilisable
  const brokenRules = rules
    .filter((r) => r.isActive && r.account && (!r.account.isActive || /non autoris/i.test(r.account.syncError ?? "")))
    .map((r) => ({ id: r.id, name: r.name, account: r.account!.name }));

  return {
    autoReplyEnabled: user?.autoReplyEnabled ?? false,
    ai: { configured: aiReady, provider: aiProviderName() },
    sync: { mode: webhooks ? "webhook" : "polling", pollSeconds },
    rules: { total: rules.length, active: rules.filter((r) => r.isActive).length, autoSend: rules.filter((r) => r.isActive && r.autoSend).length },
    brokenRules,
    accounts: results,
  };
}
