import type { SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { graphClient, graphErrorMessage, isNetworkError } from "../facebook/graph.client.js";

// Fonctions de ReplyKA et autorisations Facebook dont elles dépendent
const FEATURES: Record<"FACEBOOK" | "INSTAGRAM", Array<{ label: string; scopes: string[] }>> = {
  FACEBOOK: [
    { label: "Lire les commentaires", scopes: ["pages_read_user_content"] },
    { label: "Répondre aux commentaires", scopes: ["pages_manage_engagement"] },
    { label: "Messages privés (Messenger)", scopes: ["pages_messaging"] },
    { label: "Publier et programmer", scopes: ["pages_manage_posts"] },
    { label: "Lives et statistiques", scopes: ["pages_read_engagement"] },
  ],
  INSTAGRAM: [
    { label: "Commentaires Instagram", scopes: ["instagram_manage_comments"] },
    { label: "Messages Instagram", scopes: ["instagram_manage_messages"] },
    { label: "Publier sur Instagram", scopes: ["instagram_content_publish"] },
  ],
};

export type CheckStatus = "ok" | "missing" | "not_authorized" | "expired" | "error";

export interface AccountCheck {
  status: CheckStatus;
  message: string;
  features: Array<{ label: string; ok: boolean }>;
  checkedAt: string;
}

// Vérifie le jeton du compte, son accès à la Page et les autorisations de chaque fonction
export async function checkAccount(acc: SocialAccount): Promise<AccountCheck> {
  const checkedAt = new Date().toISOString();
  if (acc.platform === "TIKTOK") return { status: "ok", message: "Aucune vérification pour TikTok.", features: [], checkedAt };

  const result = (status: CheckStatus, message: string, features: AccountCheck["features"] = []) => ({ status, message, features, checkedAt });

  let info: Awaited<ReturnType<typeof graphClient.getTokenInfo>>;
  try {
    info = await graphClient.getTokenInfo(acc.accessToken);
  } catch (e) {
    return result("error", `Vérification impossible pour le moment : ${graphErrorMessage(e)}`);
  }
  if (!info.isValid) {
    const message = "Connexion expirée ou révoquée : reconnectez Facebook.";
    await prisma.socialAccount.update({ where: { id: acc.id }, data: { syncError: message } });
    return result("expired", info.error ? `${message} (${info.error})` : message);
  }

  try {
    await graphClient.getAccountBasic(acc.externalId, acc.accessToken);
  } catch (e) {
    if (isNetworkError(e)) return result("error", "Facebook ne répond pas : réessayez dans un instant.");
    const raw = graphErrorMessage(e);
    const message =
      acc.platform === "INSTAGRAM"
        ? "Compte non autorisé : reconnectez Facebook en cochant sa Page."
        : "Page non autorisée : reconnectez Facebook en cochant cette Page.";
    await prisma.socialAccount.update({ where: { id: acc.id }, data: { syncError: message } });
    return result("not_authorized", /impersonat|permission|access/i.test(raw) ? message : `${message} (${raw})`);
  }

  const features = FEATURES[acc.platform].map((f) => ({ label: f.label, ok: f.scopes.every((s) => info.scopes.includes(s)) }));
  const missing = features.filter((f) => !f.ok);
  if (missing.length) {
    return result(
      "missing",
      `Autorisations manquantes : ${missing.map((f) => f.label.toLowerCase()).join(", ")}. Reconnectez Facebook et laissez toutes les autorisations cochées.`,
      features
    );
  }
  // Tout fonctionne : une ancienne erreur de relève n'a plus lieu d'être affichée
  if (acc.syncError) await prisma.socialAccount.update({ where: { id: acc.id }, data: { syncError: null } });
  return result("ok", "Connexion opérationnelle : toutes les fonctions sont disponibles.", features);
}
