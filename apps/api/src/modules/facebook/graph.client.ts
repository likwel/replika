import axios from "axios";
import { env } from "../../config/env.js";

const GRAPH = `${env.fb.graphUrl}/${env.fb.apiVersion}`;

// Corps x-www-form-urlencoded : les textes longs ou accentués ne passent pas par l'adresse de la requête
const form = (fields: Record<string, string | number | boolean | null | undefined>) => {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) body.append(k, String(v));
  return body;
};

const PAGE_POST_FIELDS = [
  "id",
  "message",
  "story", // texte auto (ex. "X a ajouté une vidéo")
  "created_time",
  "full_picture",
  "permalink_url",
  "status_type",
  "attachments{media_type,type,media,url,subattachments}",
  "likes.summary(true)",
  "comments.summary(true)",
  "shares",
].join(",");

export interface PagePost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  full_picture?: string;
  permalink_url?: string;
  status_type?: string;
  attachments?: {
    data: Array<{
      media_type?: string;
      type?: string;
      url?: string;
      media?: { image?: { src: string }; source?: string };
      subattachments?: { data: Array<{ media?: { image?: { src: string } } }> };
    }>;
  };
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
}

const IG_MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

export interface InstagramPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: string; // FEED, REELS, STORY
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  owner?: { id: string }; // renvoyé seulement au propriétaire du média
}

const CONVERSATION_FIELDS = (platform?: "instagram") =>
  `id,updated_time,participants,messages.limit(1){message,from,created_time}${platform ? "" : ",unread_count"}`;

export interface ConversationSummary {
  id: string;
  updated_time: string;
  unread_count?: number;
  participants?: { data: Array<{ id: string; name?: string; username?: string }> };
  messages?: { data: Array<{ message?: string; from?: { id: string }; created_time: string }> };
}

export const graphClient = {
  // Échange le code OAuth contre un token utilisateur courte durée
  async exchangeCodeForToken(code: string): Promise<string> {
    const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        client_id: env.fb.appId,
        client_secret: env.fb.appSecret,
        redirect_uri: env.fb.redirectUri,
        code,
      },
    });
    return data.access_token as string;
  },

  // Convertit en token longue durée (~60 jours)
  async getLongLivedToken(shortToken: string): Promise<string> {
    const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: env.fb.appId,
        client_secret: env.fb.appSecret,
        fb_exchange_token: shortToken,
      },
    });
    return data.access_token as string;
  },

  // Autorisations portées par un jeton (de Page ou d'utilisateur), vérifiées avec le jeton de l'app
  async getTokenScopes(token: string): Promise<string[]> {
    const { data } = await axios.get(`${GRAPH}/debug_token`, {
      params: { input_token: token, access_token: `${env.fb.appId}|${env.fb.appSecret}` },
      timeout: 15_000,
    });
    return (data.data?.scopes as string[] | undefined) ?? [];
  },

  // Autorisations réellement accordées par l'utilisateur (il peut en décocher dans la fenêtre Facebook)
  async getGrantedPermissions(userToken: string): Promise<string[]> {
    const { data } = await axios.get(`${GRAPH}/me/permissions`, { params: { access_token: userToken } });
    return (data.data as Array<{ permission: string; status: string }>)
      .filter((p) => p.status === "granted")
      .map((p) => p.permission);
  },

  // Liste les Pages gérées + leur token de Page (ne périme pas si user token longue durée)
  async getUserPages(userToken: string) {
    const { data } = await axios.get(`${GRAPH}/me/accounts`, {
      params: {
        access_token: userToken,
        fields:
          "id,name,access_token,fan_count,picture,instagram_business_account{id,username,profile_picture_url}",
      },
    });
    return data.data as Array<{
      id: string;
      name: string;
      access_token: string;
      fan_count?: number;
      picture?: { data: { url: string } };
      instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
    }>;
  },

  // Publications d'une Page (via /feed pour inclure vidéos, reels, partages, etc.)
  async getPagePosts(pageId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${pageId}/feed`, {
      params: { access_token: pageToken, limit: 25, fields: PAGE_POST_FIELDS },
    });
    return data.data as PagePost[];
  },

  // Une publication précise d'une Page
  async getPagePost(postId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${postId}`, {
      params: { access_token: pageToken, fields: PAGE_POST_FIELDS },
    });
    return data as PagePost;
  },
  // Insights agrégés de la Page (portée, impressions, engagement)
  async getPageInsights(pageId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${pageId}/insights`, {
      params: {
        access_token: pageToken,
        metric: "page_impressions,page_engaged_users,page_fans",
        period: "week",
      },
    });
    return data.data;
  },

  // Commentaires d'une publication
  async getPostComments(postId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${postId}/comments`, {
      params: { access_token: pageToken, fields: "id,from,message,created_time", limit: 50 },
    });
    return data.data;
  },

  // Publier une réponse à un commentaire
  async replyToComment(commentId: string, message: string, pageToken: string) {
    const { data } = await axios.post(`${GRAPH}/${commentId}/comments`, form({ access_token: pageToken, message }));
    return data;
  },

  // ============================================================
  // Réponses automatiques : envoi
  // ============================================================

  // Répondre publiquement à un commentaire Instagram
  async replyToInstagramComment(commentId: string, message: string, pageToken: string) {
    const { data } = await axios.post(`${GRAPH}/${commentId}/replies`, form({ access_token: pageToken, message }));
    return data;
  },

  // Message privé (Messenger ou DM Instagram) — recipientId = PSID ou IGSID
  // tag : hors de la fenêtre de 24 h, étiquette Messenger autorisée (ex. POST_PURCHASE_UPDATE, non promotionnel)
  async sendMessage(recipientId: string, text: string, pageToken: string, tag?: string) {
    const { data } = await axios.post(
      `${GRAPH}/me/messages`,
      {
        recipient: { id: recipientId },
        ...(tag ? { messaging_type: "MESSAGE_TAG", tag } : { messaging_type: "RESPONSE" }),
        message: { text },
      },
      { params: { access_token: pageToken } }
    );
    return data as { recipient_id?: string; message_id?: string };
  },

  // Réponse privée à l'auteur d'un commentaire (une seule par commentaire, sous 7 jours).
  // recipient_id : identifiant Messenger / Instagram de la personne, pour relier ses réponses.
  async sendPrivateReply(commentId: string, text: string, pageToken: string) {
    const { data } = await axios.post(
      `${GRAPH}/me/messages`,
      { recipient: { comment_id: commentId }, message: { text } },
      { params: { access_token: pageToken } }
    );
    return data as { recipient_id?: string; message_id?: string };
  },

  // Abonne la Page aux webhooks de l'app (commentaires + messages)
  async subscribePageWebhooks(pageId: string, pageToken: string) {
    const { data } = await axios.post(`${GRAPH}/${pageId}/subscribed_apps`, null, {
      params: { access_token: pageToken, subscribed_fields: "feed,messages" },
    });
    return data;
  },

  // Texte d'une publication (FB) ou légende d'un média (IG) : contexte pour l'IA
  async getPostText(postId: string, platform: "FACEBOOK" | "INSTAGRAM", pageToken: string) {
    const field = platform === "INSTAGRAM" ? "caption" : "message";
    const { data } = await axios.get(`${GRAPH}/${postId}`, {
      params: { access_token: pageToken, fields: field },
    });
    return (data[field] as string | undefined) ?? "";
  },

  // Un commentaire Facebook (texte + auteur)
  async getComment(commentId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${commentId}`, {
      params: { access_token: pageToken, fields: "id,message,from" },
    });
    return data as { id: string; message?: string; from?: { id: string; name?: string } };
  },

  // Nom d'un expéditeur de message privé (absent des webhooks)
  async getSenderName(senderId: string, platform: "FACEBOOK" | "INSTAGRAM", pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${senderId}`, {
      params: { access_token: pageToken, fields: platform === "INSTAGRAM" ? "name,username" : "name" },
    });
    return (data.name || data.username || null) as string | null;
  },

  // ============================================================
  // Réponses automatiques : lecture (polling de secours)
  // ============================================================

  // Dernières publications ; updated_time avance quand un commentaire est ajouté
  async getRecentPostIds(pageId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${pageId}/feed`, {
      params: { access_token: pageToken, fields: "id,updated_time", limit: 15 },
    });
    return data.data as Array<{ id: string; updated_time: string }>;
  },

  // Commentaires récents d'une publication, réponses comprises
  async getRecentComments(postId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${postId}/comments`, {
      params: {
        access_token: pageToken,
        fields: "id,message,from,created_time",
        filter: "stream",
        order: "reverse_chronological",
        limit: 50,
      },
    });
    return data.data as Array<{
      id: string;
      message?: string;
      from?: { id: string; name?: string };
      created_time: string;
    }>;
  },

  // Conversations Messenger (ou Instagram) récentes avec leurs derniers messages
  async getConversations(pageToken: string, platform?: "instagram") {
    const { data } = await axios.get(`${GRAPH}/me/conversations`, {
      params: {
        access_token: pageToken,
        ...(platform ? { platform } : {}),
        fields: "updated_time,messages.limit(10){id,message,from,created_time}",
        limit: 20,
      },
    });
    return data.data as Array<{
      id: string;
      updated_time: string;
      messages?: {
        data: Array<{
          id: string;
          message?: string;
          from?: { id: string; name?: string; username?: string };
          created_time: string;
        }>;
      };
    }>;
  },

  // ============================================================
  // Espace de gestion : publications, commentaires, conversations
  // ============================================================

  // Publications Instagram avec média et statistiques
  async getInstagramPosts(igUserId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${igUserId}/media`, {
      params: { access_token: pageToken, fields: IG_MEDIA_FIELDS, limit: 25 },
    });
    return data.data as InstagramPost[];
  },

  // Un média Instagram précis
  async getInstagramPost(mediaId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${mediaId}`, {
      params: { access_token: pageToken, fields: `${IG_MEDIA_FIELDS},owner` },
    });
    return data as InstagramPost;
  },

  // Commentaires Facebook avec leurs réponses et les droits de modération
  async getFacebookCommentThread(postId: string, pageToken: string) {
    const base = "id,message,from,created_time,like_count,is_hidden,can_hide,can_remove";
    const { data } = await axios.get(`${GRAPH}/${postId}/comments`, {
      params: {
        access_token: pageToken,
        fields: `${base},comments.limit(20){${base}}`,
        filter: "toplevel",
        order: "reverse_chronological",
        limit: 50,
      },
    });
    type FbComment = {
      id: string;
      message?: string;
      from?: { id: string; name?: string };
      created_time: string;
      like_count?: number;
      is_hidden?: boolean;
      can_hide?: boolean;
      can_remove?: boolean;
    };
    return data.data as Array<FbComment & { comments?: { data: FbComment[] } }>;
  },

  // Commentaires Instagram avec leurs réponses
  async getInstagramCommentThread(mediaId: string, pageToken: string) {
    const base = "id,text,username,from,timestamp,like_count,hidden";
    const { data } = await axios.get(`${GRAPH}/${mediaId}/comments`, {
      params: { access_token: pageToken, fields: `${base},replies{${base}}`, limit: 50 },
    });
    type IgComment = {
      id: string;
      text?: string;
      username?: string;
      from?: { id: string; username?: string };
      timestamp: string;
      like_count?: number;
      hidden?: boolean;
    };
    return data.data as Array<IgComment & { replies?: { data: IgComment[] } }>;
  },

  // Commenter une publication Instagram en tant que compte
  async commentOnInstagramMedia(mediaId: string, message: string, pageToken: string) {
    const { data } = await axios.post(`${GRAPH}/${mediaId}/comments`, form({ access_token: pageToken, message }));
    return data as { id: string };
  },

  // Masquer / réafficher un commentaire (visible seulement par son auteur et ses amis une fois masqué)
  async setCommentHidden(commentId: string, platform: "FACEBOOK" | "INSTAGRAM", hidden: boolean, pageToken: string) {
    const { data } = await axios.post(`${GRAPH}/${commentId}`, null, {
      params: { access_token: pageToken, ...(platform === "INSTAGRAM" ? { hide: hidden } : { is_hidden: hidden }) },
    });
    return data;
  },

  async deleteComment(commentId: string, pageToken: string) {
    const { data } = await axios.delete(`${GRAPH}/${commentId}`, { params: { access_token: pageToken } });
    return data;
  },

  // Liste des conversations (Messenger, ou Instagram avec platform=instagram)
  async listConversations(pageToken: string, platform?: "instagram") {
    const { data } = await axios.get(`${GRAPH}/me/conversations`, {
      params: { access_token: pageToken, ...(platform ? { platform } : {}), fields: CONVERSATION_FIELDS(platform), limit: 25 },
    });
    return data.data as ConversationSummary[];
  },

  // Conversation de la Page avec une personne précise (PSID Messenger ou IGSID Instagram)
  async findConversationWith(userId: string, pageToken: string, platform?: "instagram") {
    const { data } = await axios.get(`${GRAPH}/me/conversations`, {
      params: { access_token: pageToken, ...(platform ? { platform } : {}), user_id: userId, fields: CONVERSATION_FIELDS(platform) },
    });
    return ((data.data as ConversationSummary[]) ?? [])[0] ?? null;
  },

  // Messages d'une conversation (du plus récent au plus ancien)
  async getConversationMessages(conversationId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${conversationId}`, {
      params: {
        access_token: pageToken,
        fields: "participants,messages.limit(30){id,message,from,created_time}",
      },
    });
    return data as {
      participants?: { data: Array<{ id: string; name?: string; username?: string }> };
      messages?: { data: Array<{ id: string; message?: string; from?: { id: string; name?: string; username?: string }; created_time: string }> };
    };
  },

  // Derniers médias d'un compte Instagram professionnel
  async getInstagramMedia(igUserId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${igUserId}/media`, {
      params: { access_token: pageToken, fields: "id,timestamp", limit: 5 },
    });
    return data.data as Array<{ id: string; timestamp: string }>;
  },

  // Commentaires d'un média Instagram
  async getInstagramComments(mediaId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${mediaId}/comments`, {
      params: { access_token: pageToken, fields: "id,text,timestamp,username,from", limit: 50 },
    });
    return data.data as Array<{
      id: string;
      text?: string;
      timestamp: string;
      username?: string;
      from?: { id: string; username?: string };
    }>;
  },

  // ============================================================
  // Planification : publication
  // ============================================================

  // Publication texte (avec lien éventuel) sur une Page
  async publishPagePost(pageId: string, pageToken: string, post: { message: string; link?: string | null }) {
    const { data } = await axios.post(`${GRAPH}/${pageId}/feed`, form({ access_token: pageToken, message: post.message, link: post.link || undefined }));
    return data as { id: string };
  },

  // Photo avec légende : fichier envoyé directement (aucune adresse publique nécessaire) ou URL publique
  async publishPagePhoto(
    pageId: string,
    pageToken: string,
    photo: { caption: string; file?: { data: Buffer; type: string; name: string }; url?: string }
  ) {
    const body = new FormData();
    body.append("access_token", pageToken);
    body.append("caption", photo.caption);
    if (photo.file) body.append("source", new Blob([photo.file.data], { type: photo.file.type }), photo.file.name);
    else body.append("url", photo.url ?? "");
    const { data } = await axios.post(`${GRAPH}/${pageId}/photos`, body, { timeout: 120_000 });
    return data as { id: string; post_id?: string };
  },

  // Instagram : conteneur, attente du traitement, puis publication
  async publishInstagramImage(igUserId: string, pageToken: string, imageUrl: string, caption: string) {
    const { data: container } = await axios.post(`${GRAPH}/${igUserId}/media`, form({ access_token: pageToken, image_url: imageUrl, caption }), {
      timeout: 120_000,
    });
    for (let attempt = 0; attempt < 15; attempt++) {
      const { data } = await axios.get(`${GRAPH}/${container.id}`, {
        params: { access_token: pageToken, fields: "status_code,status" },
      });
      if (data.status_code === "FINISHED" || data.status_code === undefined) break;
      if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
        throw new Error(`Instagram a refusé le média : ${data.status ?? data.status_code}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    const { data } = await axios.post(`${GRAPH}/${igUserId}/media_publish`, null, {
      params: { access_token: pageToken, creation_id: container.id },
    });
    return data as { id: string };
  },

  async getInstagramPermalink(mediaId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${mediaId}`, { params: { access_token: pageToken, fields: "permalink" } });
    return (data.permalink as string | undefined) ?? null;
  },

  // ============================================================
  // Lives : vidéos en direct et commentaires
  // ============================================================

  async getLiveVideos(pageId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${pageId}/live_videos`, {
      params: {
        access_token: pageToken,
        fields: "id,title,description,status,creation_time,permalink_url,video{id,picture}",
        limit: 15,
      },
    });
    return data.data as Array<{
      id: string;
      title?: string;
      description?: string;
      status: string; // LIVE, VOD, SCHEDULED_UNPUBLISHED, LIVE_STOPPED…
      creation_time?: string;
      permalink_url?: string;
      video?: { id: string; picture?: string };
    }>;
  },

  async getLiveVideoStatus(liveVideoId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${liveVideoId}`, { params: { access_token: pageToken, fields: "status" } });
    return data.status as string;
  },

  // Live Instagram en cours (vide hors direct)
  async getInstagramLiveMedia(igUserId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${igUserId}/live_media`, {
      params: { access_token: pageToken, fields: "id,caption,media_product_type,timestamp,permalink" },
    });
    return data.data as Array<{ id: string; caption?: string; timestamp?: string; permalink?: string }>;
  },

  // Commentaires les plus récents d'une vidéo, d'une publication ou d'un média Instagram
  async getLatestComments(objectId: string, platform: "FACEBOOK" | "INSTAGRAM", pageToken: string) {
    if (platform === "INSTAGRAM") {
      const { data } = await axios.get(`${GRAPH}/${objectId}/comments`, {
        params: { access_token: pageToken, fields: "id,text,timestamp,username,from", limit: 50 },
      });
      return (data.data as Array<{ id: string; text?: string; timestamp: string; username?: string; from?: { id: string; username?: string } }>).map(
        (c) => ({
          id: c.id,
          text: c.text ?? "",
          authorId: c.from?.id,
          authorName: c.username ?? c.from?.username ?? "Utilisateur Instagram",
          createdAt: new Date(c.timestamp),
        })
      );
    }
    const { data } = await axios.get(`${GRAPH}/${objectId}/comments`, {
      params: {
        access_token: pageToken,
        fields: "id,message,from,created_time",
        filter: "stream",
        order: "reverse_chronological",
        limit: 100,
      },
    });
    return (data.data as Array<{ id: string; message?: string; from?: { id: string; name?: string }; created_time: string }>).map((c) => ({
      id: c.id,
      text: c.message ?? "",
      authorId: c.from?.id,
      authorName: c.from?.name ?? "Utilisateur Facebook",
      createdAt: new Date(c.created_time),
    }));
  },

  // ============================================================
  // Connexions : état d'un jeton de Page
  // ============================================================

  async getTokenInfo(token: string) {
    const { data } = await axios.get(`${GRAPH}/debug_token`, {
      params: { input_token: token, access_token: `${env.fb.appId}|${env.fb.appSecret}` },
      timeout: 15_000,
    });
    const info = data.data as { is_valid?: boolean; scopes?: string[]; error?: { message?: string } } | undefined;
    return { isValid: info?.is_valid ?? false, scopes: info?.scopes ?? [], error: info?.error?.message ?? null };
  },

  // Lecture minimale du compte avec son propre jeton : échoue si la Page n'est plus autorisée
  async getAccountBasic(externalId: string, pageToken: string) {
    const { data } = await axios.get(`${GRAPH}/${externalId}`, { params: { access_token: pageToken, fields: "id,name" } });
    return data as { id: string; name?: string };
  },
};

// Extrait le message d'erreur renvoyé par l'API Graph
export function graphErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const apiMsg = (e.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    // Les coupures réseau (ETIMEDOUT, ECONNRESET…) arrivent parfois sans message
    return apiMsg || e.message || (e.code ? `erreur réseau (${e.code})` : "erreur réseau");
  }
  return (e instanceof Error && e.message) || String(e);
}

export interface GraphErrorDetails {
  message: string;
  userMessage: string | null; // texte destiné à l'utilisateur, souvent traduit par Facebook
  code: number | null;
  subcode: number | null;
  transient: boolean;
  trace: string | null;
}

export function graphErrorDetails(e: unknown): GraphErrorDetails {
  const err = axios.isAxiosError(e)
    ? (e.response?.data as { error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string } } | undefined)?.error
    : undefined;
  const userMessage = [err?.error_user_title, err?.error_user_msg].filter(Boolean).join(" : ") || null;
  return {
    message: graphErrorMessage(e),
    userMessage,
    code: err?.code ?? null,
    subcode: err?.error_subcode ?? null,
    transient: Boolean(err?.is_transient) || err?.code === 1 || err?.code === 2 || isNetworkError(e),
    trace: err?.fbtrace_id ?? null,
  };
}

// Erreur de connexion (aucune réponse de Facebook) : passagère, le prochain passage réessaie
export const isNetworkError = (e: unknown) => axios.isAxiosError(e) && !e.response;