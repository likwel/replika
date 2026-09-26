import type { SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import {
  graphClient,
  graphErrorMessage,
  type ConversationSummary,
  type InstagramPost,
  type PagePost,
} from "../facebook/graph.client.js";
import { detectKind, extractImage } from "../facebook/facebook.service.js";
import { aiErrorMessage, isAiConfigured } from "../ai/ai.client.js";
import { suggestReply } from "../ai/ai.service.js";
import type {
  AccountError,
  AccountRef,
  InboxLink,
  MetaPlatform,
  WorkspaceComment,
  WorkspaceConversation,
  WorkspaceMessage,
  WorkspacePost,
} from "./workspace.types.js";

type MetaAccount = SocialAccount & { platform: MetaPlatform };
const OPEN = ["PENDING", "ESCALATED"] as const; // statuts « à traiter » de la file d'attente

// ============================================================
// Helpers
// ============================================================

const isMeta = (a: SocialAccount): a is MetaAccount => a.platform === "FACEBOOK" || a.platform === "INSTAGRAM";

const ref = (acc: MetaAccount): AccountRef => ({
  accountId: acc.id,
  platform: acc.platform,
  accountName: acc.name,
  accountAvatar: acc.avatarUrl,
});

async function findAccount(userId: string, accountId: string): Promise<MetaAccount> {
  const acc = await prisma.socialAccount.findFirst({ where: { id: accountId, userId, isActive: true } });
  if (!acc || !isMeta(acc)) throw new AppError("Compte introuvable", 404);
  return acc;
}

// Comptes actifs de l'utilisateur, éventuellement restreints à une sélection
async function selectedAccounts(userId: string, ids?: string[]): Promise<MetaAccount[]> {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      userId,
      isActive: true,
      platform: { in: ["FACEBOOK", "INSTAGRAM"] },
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return accounts.filter(isMeta);
}

// Traduit les refus fréquents de Meta en message compréhensible
function graphFailure(e: unknown, action: string): AppError {
  const raw = graphErrorMessage(e).replace(/\s+/g, " ").trim();
  if (/outside of allowed window/i.test(raw)) {
    return new AppError(
      "Plus de 24 h depuis le dernier message de cette personne : Messenger n'autorise plus de réponse depuis ReplyKA.",
      422
    );
  }
  if (/impersonat/i.test(raw)) {
    return new AppError("Page non autorisée : reconnectez Facebook en cochant cette Page.", 403);
  }
  if (/\(#(200|10)\)|permission/i.test(raw)) {
    return new AppError(`Autorisation Facebook manquante pour ${action} : reconnectez Facebook. (${raw})`, 403);
  }
  return new AppError(`Impossible de ${action} : ${raw}`, 502);
}

// Lance une lecture par compte en parallèle ; un compte en échec n'empêche pas les autres
async function perAccount<T>(accounts: MetaAccount[], read: (acc: MetaAccount) => Promise<T[]>) {
  const errors: AccountError[] = [];
  const results = await Promise.all(
    accounts.map(async (acc) => {
      try {
        return await read(acc);
      } catch (e) {
        errors.push({ accountId: acc.id, accountName: acc.name, message: graphFailure(e, "lire ce compte").message });
        return [];
      }
    })
  );
  return { items: results.flat(), errors };
}

const isOwnAuthor = (acc: MetaAccount, id?: string, username?: string) =>
  (id !== undefined && id === acc.externalId) || (username !== undefined && `@${username}` === acc.name);

const fromInstagram = (acc: MetaAccount, m: InstagramPost): WorkspacePost => ({
  ...ref(acc),
  id: m.id,
  text: m.caption ?? "",
  image: m.media_type === "VIDEO" ? (m.thumbnail_url ?? null) : (m.media_url ?? m.thumbnail_url ?? null),
  permalink: m.permalink ?? null,
  time: m.timestamp,
  kind:
    m.media_product_type === "REELS" ? "reel" : m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image",
  isVideo: m.media_type === "VIDEO",
  reactions: m.like_count ?? 0,
  comments: m.comments_count ?? 0,
  shares: null,
  pending: 0,
});

const fromFacebook = (acc: MetaAccount, p: PagePost): WorkspacePost => {
  const { kind, isVideo } = detectKind(p);
  return {
    ...ref(acc),
    id: p.id,
    text: p.message ?? p.story ?? "",
    image: extractImage(p),
    permalink: p.permalink_url ?? null,
    time: p.created_time,
    kind,
    isVideo,
    reactions: p.likes?.summary.total_count ?? 0,
    comments: p.comments?.summary.total_count ?? 0,
    shares: p.shares?.count ?? 0,
    pending: 0,
  };
};

const participantName = (p?: { name?: string; username?: string }) =>
  p?.name ?? (p?.username ? `@${p.username}` : "Utilisateur");

const fromConversation = (acc: MetaAccount, c: ConversationSummary): WorkspaceConversation => {
  const other = c.participants?.data.find((p) => !isOwnAuthor(acc, p.id, p.username));
  const last = c.messages?.data[0];
  return {
    ...ref(acc),
    id: c.id,
    participant: { id: other?.id ?? "", name: participantName(other) },
    snippet: last?.message ?? "",
    lastFromPage: last?.from ? isOwnAuthor(acc, last.from.id) : false,
    updatedAt: c.updated_time,
    unread: c.unread_count ?? 0,
    pending: 0,
  };
};

// Éléments en attente dans la file d'attente, rattachés à leur publication
async function attachPostPending(accounts: MetaAccount[], posts: WorkspacePost[]) {
  const pending = await prisma.socialMessage.groupBy({
    by: ["postId"],
    where: { accountId: { in: accounts.map((a) => a.id) }, postId: { in: posts.map((p) => p.id) }, status: { in: [...OPEN] } },
    _count: true,
  });
  const byPost = new Map(pending.map((p) => [p.postId, p._count]));
  for (const post of posts) post.pending = byPost.get(post.id) ?? 0;
}

// Messages privés en attente dans la file, par personne
async function attachConversationPending(accounts: MetaAccount[], conversations: WorkspaceConversation[]) {
  const pending = await prisma.socialMessage.groupBy({
    by: ["accountId", "authorId"],
    where: { accountId: { in: accounts.map((a) => a.id) }, kind: "DIRECT", status: { in: [...OPEN] } },
    _count: true,
  });
  const key = (accountId: string, authorId: string | null) => `${accountId}:${authorId}`;
  const byAuthor = new Map(pending.map((p) => [key(p.accountId, p.authorId), p._count]));
  for (const c of conversations) c.pending = byAuthor.get(key(c.accountId, c.participant.id)) ?? 0;
}

// ============================================================
// Service
// ============================================================

export const workspaceService = {
  // Comptes gérables + nombre d'éléments à traiter par compte
  async accounts(userId: string) {
    const accounts = await selectedAccounts(userId);
    const pending = await prisma.socialMessage.groupBy({
      by: ["accountId"],
      where: { accountId: { in: accounts.map((a) => a.id) }, status: { in: [...OPEN] } },
      _count: true,
    });
    const byAccount = new Map(pending.map((p) => [p.accountId, p._count]));
    return accounts.map((a) => ({
      ...ref(a),
      id: a.id,
      syncError: a.syncError,
      pending: byAccount.get(a.id) ?? 0,
    }));
  },

  // --------------------------------------------------------- Publications

  async posts(userId: string, accountIds?: string[]) {
    const accounts = await selectedAccounts(userId, accountIds);
    const { items, errors } = await perAccount<WorkspacePost>(accounts, async (acc) =>
      acc.platform === "INSTAGRAM"
        ? (await graphClient.getInstagramPosts(acc.externalId, acc.accessToken)).map((m) => fromInstagram(acc, m))
        : (await graphClient.getPagePosts(acc.externalId, acc.accessToken)).map((p) => fromFacebook(acc, p))
    );
    await attachPostPending(accounts, items);
    items.sort((a, b) => +new Date(b.time) - +new Date(a.time));
    return { posts: items, errors };
  },

  // Une publication précise (ex. ouverte depuis la file d'attente, plus ancienne que la liste)
  async post(userId: string, accountId: string, postId: string): Promise<WorkspacePost> {
    const acc = await findAccount(userId, accountId);
    let post: WorkspacePost;
    try {
      if (acc.platform === "INSTAGRAM") {
        const media = await graphClient.getInstagramPost(postId, acc.accessToken);
        if (media.owner && media.owner.id !== acc.externalId) throw new AppError("Publication introuvable pour ce compte", 404);
        post = fromInstagram(acc, media);
      } else {
        if (!postId.startsWith(`${acc.externalId}_`)) throw new AppError("Publication introuvable pour ce compte", 404);
        post = fromFacebook(acc, await graphClient.getPagePost(postId, acc.accessToken));
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw graphFailure(e, "lire cette publication");
    }
    await attachPostPending([acc], [post]);
    return post;
  },

  // --------------------------------------------------------- Commentaires

  async comments(userId: string, accountId: string, postId: string): Promise<WorkspaceComment[]> {
    const acc = await findAccount(userId, accountId);
    let comments: WorkspaceComment[];
    try {
      if (acc.platform === "INSTAGRAM") {
        const thread = await graphClient.getInstagramCommentThread(postId, acc.accessToken);
        const map = (c: (typeof thread)[number]): WorkspaceComment => {
          const username = c.username ?? c.from?.username;
          const own = isOwnAuthor(acc, c.from?.id, username);
          return {
            id: c.id,
            author: username ? `@${username}` : "Utilisateur Instagram",
            authorId: c.from?.id ?? null,
            text: c.text ?? "",
            time: c.timestamp,
            likes: c.like_count ?? 0,
            hidden: c.hidden ?? false,
            isOwn: own,
            canHide: !own, // Instagram ne permet pas de masquer ses propres commentaires
            canDelete: true,
            inbox: null,
            replies: (c.replies?.data ?? []).map(map).reverse(),
          };
        };
        comments = thread.map(map);
      } else {
        if (!postId.startsWith(`${acc.externalId}_`)) throw new AppError("Publication introuvable pour ce compte", 404);
        const thread = await graphClient.getFacebookCommentThread(postId, acc.accessToken);
        const map = (c: (typeof thread)[number]): WorkspaceComment => {
          const own = isOwnAuthor(acc, c.from?.id);
          return {
            id: c.id,
            author: c.from?.name ?? "Utilisateur Facebook",
            authorId: c.from?.id ?? null,
            text: c.message ?? "",
            time: c.created_time,
            likes: c.like_count ?? 0,
            hidden: c.is_hidden ?? false,
            isOwn: own,
            canHide: c.can_hide ?? !own,
            canDelete: c.can_remove ?? true,
            inbox: null,
            replies: (c.comments?.data ?? []).map(map),
          };
        };
        comments = thread.map(map);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw graphFailure(e, "lire les commentaires");
    }

    // Rattache les suggestions préparées par l'automatisation
    const ids = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
    const inbox = await prisma.socialMessage.findMany({
      where: { accountId: acc.id, externalId: { in: ids } },
      select: { id: true, externalId: true, status: true, aiReply: true, intent: true },
    });
    const byId = new Map<string, InboxLink>(
      inbox.map((m) => [
        m.externalId,
        { id: m.id, status: m.status, suggestion: m.status === "REPLIED" ? null : m.aiReply, intent: m.intent },
      ])
    );
    for (const c of comments) {
      c.inbox = byId.get(c.id) ?? null;
      for (const r of c.replies) r.inbox = byId.get(r.id) ?? null;
    }
    return comments;
  },

  async commentOnPost(userId: string, accountId: string, postId: string, message: string) {
    const acc = await findAccount(userId, accountId);
    try {
      const res =
        acc.platform === "INSTAGRAM"
          ? await graphClient.commentOnInstagramMedia(postId, message, acc.accessToken)
          : await graphClient.replyToComment(postId, message, acc.accessToken);
      await prisma.activityLog.create({ data: { userId, action: "COMMENT_POSTED", meta: { accountId, postId } } });
      return { id: (res as { id?: string }).id ?? null };
    } catch (e) {
      throw graphFailure(e, "publier le commentaire");
    }
  },

  async replyToComment(userId: string, accountId: string, commentId: string, message: string) {
    const acc = await findAccount(userId, accountId);
    let res: { id?: string };
    try {
      res =
        acc.platform === "INSTAGRAM"
          ? await graphClient.replyToInstagramComment(commentId, message, acc.accessToken)
          : await graphClient.replyToComment(commentId, message, acc.accessToken);
    } catch (e) {
      throw graphFailure(e, "répondre");
    }
    // Le même commentaire dans la file d'attente est désormais traité
    await prisma.socialMessage.updateMany({
      where: { accountId: acc.id, externalId: commentId, status: { in: [...OPEN] } },
      data: { status: "REPLIED", aiReply: message, aiGenerated: false, repliedAt: new Date(), error: null },
    });
    await prisma.activityLog.create({
      data: { userId, action: "REPLY_SENT", meta: { accountId, commentId, source: "workspace" } },
    });
    return { id: res.id ?? null };
  },

  async setCommentHidden(userId: string, accountId: string, commentId: string, hidden: boolean) {
    const acc = await findAccount(userId, accountId);
    try {
      await graphClient.setCommentHidden(commentId, acc.platform, hidden, acc.accessToken);
    } catch (e) {
      throw graphFailure(e, hidden ? "masquer ce commentaire" : "réafficher ce commentaire");
    }
    return { hidden };
  },

  async deleteComment(userId: string, accountId: string, commentId: string) {
    const acc = await findAccount(userId, accountId);
    try {
      await graphClient.deleteComment(commentId, acc.accessToken);
    } catch (e) {
      throw graphFailure(e, "supprimer ce commentaire");
    }
    // Commentaire disparu : plus rien à traiter dans la file
    await prisma.socialMessage.updateMany({
      where: { accountId: acc.id, externalId: commentId, status: { in: [...OPEN] } },
      data: { status: "IGNORED" },
    });
    await prisma.activityLog.create({ data: { userId, action: "COMMENT_DELETED", meta: { accountId, commentId } } });
  },

  // --------------------------------------------------------- Messages privés

  async conversations(userId: string, accountIds?: string[]) {
    const accounts = await selectedAccounts(userId, accountIds);
    const { items, errors } = await perAccount<WorkspaceConversation>(accounts, async (acc) =>
      (await graphClient.listConversations(acc.accessToken, acc.platform === "INSTAGRAM" ? "instagram" : undefined)).map((c) =>
        fromConversation(acc, c)
      )
    );
    await attachConversationPending(accounts, items);
    items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return { conversations: items, errors };
  },

  // Conversation avec une personne (ex. ouverte depuis la file d'attente)
  async conversationWith(userId: string, accountId: string, personId: string): Promise<WorkspaceConversation> {
    const acc = await findAccount(userId, accountId);
    let found: ConversationSummary | null;
    try {
      found = await graphClient.findConversationWith(personId, acc.accessToken, acc.platform === "INSTAGRAM" ? "instagram" : undefined);
    } catch (e) {
      throw graphFailure(e, "retrouver la conversation");
    }
    const conversation = found ? fromConversation(acc, found) : null;
    if (!conversation || conversation.participant.id !== personId) throw new AppError("Conversation introuvable", 404);
    await attachConversationPending([acc], [conversation]);
    return conversation;
  },

  async conversation(userId: string, accountId: string, conversationId: string) {
    const acc = await findAccount(userId, accountId);
    let data: Awaited<ReturnType<typeof graphClient.getConversationMessages>>;
    try {
      data = await graphClient.getConversationMessages(conversationId, acc.accessToken);
    } catch (e) {
      throw graphFailure(e, "lire la conversation");
    }
    const other = data.participants?.data.find((p) => !isOwnAuthor(acc, p.id, p.username));
    const messages: WorkspaceMessage[] = (data.messages?.data ?? [])
      .map((m) => ({
        id: m.id,
        text: m.message ?? "",
        time: m.created_time,
        isOwn: isOwnAuthor(acc, m.from?.id, m.from?.username),
      }))
      .reverse();

    // Suggestion déjà préparée par l'automatisation pour cette personne
    const open = other
      ? await prisma.socialMessage.findFirst({
          where: { accountId: acc.id, kind: "DIRECT", authorId: other.id, status: { in: [...OPEN] }, aiReply: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { aiReply: true },
        })
      : null;

    return {
      participant: { id: other?.id ?? "", name: participantName(other) },
      messages,
      suggestion: open?.aiReply ?? null,
    };
  },

  async sendMessage(userId: string, accountId: string, conversationId: string, message: string) {
    const acc = await findAccount(userId, accountId);
    // Le destinataire est déterminé côté serveur, à partir de la conversation elle-même
    let recipientId: string | undefined;
    try {
      const data = await graphClient.getConversationMessages(conversationId, acc.accessToken);
      recipientId = data.participants?.data.find((p) => !isOwnAuthor(acc, p.id, p.username))?.id;
      if (!recipientId) throw new AppError("Destinataire introuvable dans cette conversation", 404);
      await graphClient.sendMessage(recipientId, message, acc.accessToken);
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw graphFailure(e, "envoyer le message");
    }
    await prisma.socialMessage.updateMany({
      where: { accountId: acc.id, kind: "DIRECT", authorId: recipientId, status: { in: [...OPEN] } },
      data: { status: "REPLIED", aiReply: message, aiGenerated: false, repliedAt: new Date(), error: null },
    });
    await prisma.activityLog.create({
      data: { userId, action: "REPLY_SENT", meta: { accountId, conversationId, source: "workspace" } },
    });
    return { sent: true };
  },

  // --------------------------------------------------------- IA

  async suggest(
    userId: string,
    accountId: string,
    input: { kind: "COMMENT"; text: string; authorName: string; postId?: string } | { kind: "DIRECT"; conversationId: string }
  ) {
    if (!isAiConfigured()) {
      throw new AppError("Aucun modèle IA configuré : renseignez AI_API_KEY dans apps/api/.env", 503);
    }
    const acc = await findAccount(userId, accountId);

    let aiInput: Parameters<typeof suggestReply>[1];
    if (input.kind === "COMMENT") {
      aiInput = { kind: "COMMENT", content: input.text, authorName: input.authorName, postId: input.postId };
    } else {
      const convo = await workspaceService.conversation(userId, accountId, input.conversationId);
      const lastIndex = convo.messages.map((m) => m.isOwn).lastIndexOf(false);
      if (lastIndex < 0) throw new AppError("Aucun message du client à qui répondre", 422);
      const history = convo.messages
        .slice(Math.max(0, lastIndex - 6), lastIndex)
        .map((m) => `${m.isOwn ? "Vous" : "Client"} : ${m.text}`)
        .join("\n");
      aiInput = { kind: "DIRECT", content: convo.messages[lastIndex].text, authorName: convo.participant.name, history };
    }

    try {
      return await suggestReply(acc, aiInput);
    } catch (e) {
      throw new AppError(`IA indisponible : ${aiErrorMessage(e)}`, 502);
    }
  },
};
