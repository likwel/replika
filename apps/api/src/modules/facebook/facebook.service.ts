import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { graphClient, graphErrorMessage } from "./graph.client.js";
import { aiErrorMessage, isAiConfigured } from "../ai/ai.client.js";
import { generateReply, type AiReply } from "../ai/ai.service.js";
import { pageSlotsLeft } from "../billing/entitlements.js";

// ============================================================
// Helpers (hors de l'objet service)
// ============================================================

// Permissions demandées à Facebook (FB_SCOPES dans .env permet de les remplacer)
function requestedScopes(): string[] {
  if (env.fb.scopes) return env.fb.scopes.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "pages_show_list",
    "pages_read_engagement",
    "read_insights",
    "business_management", // ← aide à voir toutes les pages, et requis pour lire les catalogues (Gescom)
    "catalog_management", // Gescom : lire les produits du Catalogue Facebook connecté à Marketplace
    //   ⚠️ permission avancée : nécessite la validation de l'app par Meta (Business Verification + revue).
    //   En mode développement, elle fonctionne directement pour les comptes testeurs.
    // Réponses automatiques
    "pages_read_user_content", // lire les commentaires
    "pages_manage_engagement", // répondre aux commentaires
    "pages_manage_metadata", // abonner la Page aux webhooks
    "pages_messaging", // Messenger
    "pages_manage_posts", // planification : publier sur la Page
    "instagram_basic",
    "instagram_manage_comments",
    "instagram_manage_messages",
    "instagram_content_publish", // planification : publier sur Instagram
  ];
}

const NO_PAGE_FOUND =
  "Aucune Page Facebook trouvée sur ce compte : il doit être administrateur (contrôle total) d'au moins une Page, et cette Page doit être cochée dans la fenêtre Facebook.";

function noPageAccessMessage(granted: string[]) {
  const got = granted.filter((p) => p !== "public_profile");
  return (
    "Facebook n'a donné à SuiteFlow aucun accès aux Pages de ce compte" +
    (got.length ? ` (autorisations reçues : ${got.join(", ")})` : "") +
    ". Si vos Pages étaient bien cochées, l'app SuiteFlow attend encore la validation de ses autorisations par Meta : " +
    "en attendant, seuls les comptes Facebook ajoutés à l'app (administrateur, développeur ou testeur) peuvent connecter leurs Pages."
  );
}

// Comptes connectés auparavant mais absents de la dernière connexion (Page décochée dans la fenêtre Facebook)
const NOT_SELECTED = {
  FACEBOOK:
    "Page non autorisée : elle n'a pas été cochée lors de la dernière connexion Facebook. Reconnectez Facebook et sélectionnez-la.",
  INSTAGRAM:
    "Compte non autorisé : sa Page Facebook n'a pas été cochée lors de la dernière connexion. Reconnectez Facebook et sélectionnez-la.",
} as const;

// Retrouve le compte (et son token) propriétaire d'un post via le préfixe pageId_
async function findAccountForPost(userId: string, postId: string) {
  const pageId = postId.split("_")[0]; // les IDs de post FB sont "{pageId}_{postId}"
  const acc = await prisma.socialAccount.findFirst({
    where: { userId, platform: "FACEBOOK", externalId: pageId, isActive: true },
  });
  if (!acc) throw new AppError("Page introuvable pour ce post", 404);
  return acc;
}

// Déduit le type d'affichage à partir des champs Facebook
export function detectKind(post: {
  status_type?: string;
  attachments?: { data: Array<{ media_type?: string; type?: string }> };
}): { kind: string; isVideo: boolean } {
  const att = post.attachments?.data?.[0];
  const mediaType = att?.media_type;
  const type = att?.type;
  const status = post.status_type;

  if (type?.includes("reel")) return { kind: "reel", isVideo: true };

  if (mediaType === "video" || type === "video_inline" || type === "video_autoplay" || status === "added_video") {
    return { kind: "video", isVideo: true };
  }

  if (type === "event") return { kind: "event", isVideo: false };

  if (mediaType === "photo" || mediaType === "album" || type === "photo" || status === "added_photos") {
    return { kind: "image", isVideo: false };
  }

  if (mediaType === "link" || type === "share") return { kind: "image", isVideo: false };

  return { kind: "text", isVideo: false };
}

// Extrait la meilleure image disponible

export function extractImage(post: {
  full_picture?: string;
  attachments?: {
    data: Array<{
      media?: { image?: { src: string }; source?: string };
      subattachments?: { data: Array<{ media?: { image?: { src: string } } }> };
    }>;
  };
}): string | null {
  // 1. full_picture (présent pour photos et parfois vidéos)
  if (post.full_picture) return post.full_picture;

  const att = post.attachments?.data?.[0];
  if (!att) return null;

  // 2. image directe de l'attachment (miniature vidéo, aperçu lien, photo)
  if (att.media?.image?.src) return att.media.image.src;

  // 3. album / carrousel : 1re sous-image
  const sub = att.subattachments?.data?.[0]?.media?.image?.src;
  if (sub) return sub;

  return null;
}
// ============================================================
// Service
// ============================================================

export const facebookService = {
  // state : jeton anti-CSRF émis par issueOAuthState, lié au navigateur de la personne connectée
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.fb.appId,
      redirect_uri: env.fb.redirectUri,
      state,
      scope: requestedScopes().join(","),
      response_type: "code",
      auth_type: "rerequest",
    });
    return `https://www.facebook.com/${env.fb.apiVersion}/dialog/oauth?${params}`;
  },

  // userId : relu dans le state une fois celui-ci vérifié contre le cookie (voir facebookController.callback)
  async handleCallback(code: string, userId: string) {
    const shortToken = await graphClient.exchangeCodeForToken(code);
    const longToken = await graphClient.getLongLivedToken(shortToken);

    // Autorisations décochées dans la fenêtre Facebook : signalées tout de suite à l'utilisateur
    const granted = await graphClient.getGrantedPermissions(longToken).catch(() => null);
    const missing = granted ? requestedScopes().filter((s) => !granted.includes(s)) : [];

    // Aucun accès aux Pages : Page décochée, ou autorisations de l'app pas encore validées par Meta
    // (sans « accès avancé », seuls les comptes ayant un rôle sur l'app peuvent les accorder)
    const noPageAccess = Boolean(granted && !granted.includes("pages_show_list"));
    const pages = await graphClient.getUserPages(longToken).catch((e) => {
      if (noPageAccess) return [];
      throw e;
    });
    if (!pages.length) {
      throw new AppError(noPageAccess ? noPageAccessMessage(granted!) : NO_PAGE_FOUND, 404, noPageAccess ? "FB_NO_PAGE_ACCESS" : "FB_NO_PAGE");
    }

    // Le jeton de Page porte les autorisations accordées par l'utilisateur : enregistrées tout de suite,
    // sans appel à debug_token (compté dans le plafond de l'app). Inconnues : vérifiées à la prochaine relève.
    const token = granted
      ? { tokenScopes: granted, tokenValid: true, tokenCheckedAt: new Date() }
      : { tokenScopes: [], tokenValid: null, tokenCheckedAt: null };

    // Nombre de Pages de la formule : une Page déjà active le reste, les nouvelles prennent les places libres
    let slots = await pageSlotsLeft(userId);
    const limited: string[] = [];

    let instagramCount = 0;
    for (const page of pages) {
      const avatarUrl = page.picture?.data?.url ?? null;
      const existing = await prisma.socialAccount.findUnique({
        where: { platform_externalId_userId: { platform: "FACEBOOK", externalId: page.id, userId } },
        select: { isActive: true },
      });
      const isActive = existing?.isActive || slots-- > 0;
      if (!isActive) limited.push(page.name);
      await prisma.socialAccount.upsert({
        where: {
          platform_externalId_userId: {
            platform: "FACEBOOK",
            externalId: page.id,
            userId,
          },
        },
        update: {
          accessToken: page.access_token,
          name: page.name,
          avatarUrl,
          isActive,
          syncError: null, // nouveau jeton : l'erreur éventuelle sera réévaluée à la prochaine relève
          ...token,
        },
        create: {
          userId,
          platform: "FACEBOOK",
          externalId: page.id,
          name: page.name,
          avatarUrl,
          accessToken: page.access_token,
          isActive,
          ...token,
        },
      });

      // Compte Instagram professionnel lié : il utilise le token de la Page
      const ig = page.instagram_business_account;
      if (ig) {
        const igData = {
          name: ig.username ? `@${ig.username}` : page.name,
          avatarUrl: ig.profile_picture_url ?? null,
          accessToken: page.access_token,
          linkedPageId: page.id, // activé et désactivé avec sa Page
          isActive,
          ...token,
        };
        await prisma.socialAccount.upsert({
          where: { platform_externalId_userId: { platform: "INSTAGRAM", externalId: ig.id, userId } },
          update: { ...igData, syncError: null },
          create: { userId, platform: "INSTAGRAM", externalId: ig.id, ...igData },
        });
        instagramCount++;
      }

      // Webhooks (commentaires + messages) — sans bloquer la connexion si la permission manque
      await graphClient
        .subscribePageWebhooks(page.id, page.access_token)
        .catch((e) => console.warn(`⚠️ Abonnement webhooks ${page.name} :`, graphErrorMessage(e)));
    }

    // Comptes déjà liés mais non cochés cette fois : signalés tout de suite (Facebook leur a retiré l'accès)
    const pageIds = pages.map((p) => p.id);
    const igIds = pages.flatMap((p) => (p.instagram_business_account ? [p.instagram_business_account.id] : []));
    const absent = await prisma.socialAccount.findMany({
      where: {
        userId,
        OR: [
          { platform: "FACEBOOK", externalId: { notIn: pageIds } },
          { platform: "INSTAGRAM", externalId: { notIn: igIds } },
        ],
      },
    });
    for (const acc of absent) {
      if (acc.platform === "TIKTOK") continue;
      await prisma.socialAccount.update({ where: { id: acc.id }, data: { syncError: NOT_SELECTED[acc.platform] } });
    }

    // Jeton utilisateur (longue durée) : conservé pour Gescom (Business Manager / Catalogue), inaccessible avec un jeton de Page
    await prisma.user.update({ where: { id: userId }, data: { fbUserToken: longToken } });

    await prisma.activityLog.create({
      data: {
        userId,
        action: "FACEBOOK_CONNECTED",
        meta: { pages: pages.length, instagram: instagramCount, absent: absent.length, limited: limited.length },
      },
    });

    return {
      pages: pages.length,
      instagram: instagramCount,
      missing,
      absent: absent.filter((a) => a.platform !== "TIKTOK").map((a) => a.name),
      limited, // Pages connectées mais laissées inactives : limite de la formule atteinte
    };
  },

  async getAggregatedPosts(userId: string) {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId, platform: "FACEBOOK", isActive: true },
    });

    const all = await Promise.all(
      accounts.map(async (acc) => {
        try {
          const posts = await graphClient.getPagePosts(acc.externalId, acc.accessToken);
          return posts.map((p) => {
            const { kind, isVideo } = detectKind(p);
            return {
              id: p.id,
              plat: "fb" as const,
              page: acc.name,
              pageAvatar: acc.avatarUrl ?? null,
              text: p.message ?? "",
              img: extractImage(p),
              permalink: p.permalink_url,
              time: p.created_time,
              kind,
              isVideo,
              reactions: p.likes?.summary.total_count ?? 0,
              comments: p.comments?.summary.total_count ?? 0,
              shares: p.shares?.count ?? 0,
              live: false,
              price: null,
              leads: 0,
            };
          });
        } catch {
          return [];
        }
      })
    );

    return all.flat().sort((a, b) => +new Date(b.time) - +new Date(a.time));
  },

  async getInsights(userId: string) {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId, platform: "FACEBOOK", isActive: true },
    });
    const insights = await Promise.all(
      accounts.map(async (acc) => {
        try {
          const data = await graphClient.getPageInsights(acc.externalId, acc.accessToken);
          return { page: acc.name, avatar: acc.avatarUrl ?? null, metrics: data };
        } catch {
          return { page: acc.name, avatar: acc.avatarUrl ?? null, metrics: [] };
        }
      })
    );
    return insights;
  },

  async getComments(userId: string, postId: string) {
    const acc = await findAccountForPost(userId, postId);
    const raw = await graphClient.getPostComments(postId, acc.accessToken);
    return raw.map((c: { id: string; from?: { name?: string }; message?: string; created_time?: string }) => ({
      id: c.id,
      author: c.from?.name ?? "Utilisateur",
      text: c.message ?? "",
      time: c.created_time,
    }));
  },

  async aiReplyToComment(userId: string, postId: string, commentId: string) {
    const acc = await findAccountForPost(userId, postId);
    if (!isAiConfigured()) {
      throw new AppError("Aucun modèle IA configuré : renseignez AI_API_KEY dans apps/api/.env", 503);
    }

    const [comment, postText] = await Promise.all([
      graphClient.getComment(commentId, acc.accessToken),
      graphClient.getPostText(postId, "FACEBOOK", acc.accessToken).catch(() => ""),
    ]);
    let ai: AiReply;
    try {
      ai = await generateReply(acc, {
        kind: "COMMENT",
        authorName: comment.from?.name ?? "Utilisateur Facebook",
        content: comment.message ?? "",
        postText,
      });
    } catch (e) {
      if (e instanceof AppError) throw e; // abonnement expiré, quota atteint
      throw new AppError(`IA indisponible : ${aiErrorMessage(e)}`, 502);
    }
    if (!ai.reply) throw new AppError("L'IA estime que ce commentaire ne demande pas de réponse.", 422);

    const reply = ai.reply;
    await graphClient.replyToComment(commentId, reply, acc.accessToken);
    await prisma.activityLog.create({
      data: { userId, action: "AI_REPLY_SENT", meta: { postId, commentId } },
    });
    return reply;
  },
};