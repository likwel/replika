import { Prisma, type LiveOrder, type LiveSession, type SocialAccount, type SocialMessage } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { graphClient, graphErrorMessage } from "../facebook/graph.client.js";
import { workspaceService } from "../workspace/workspace.service.js";
import { extractContact } from "./live.ai.js";
import { recordFromLiveOrder } from "../leads/lead.service.js";
import {
  detectJp,
  FIELD_LABELS,
  formatAriary,
  missingFields,
  parseFields,
  parseKeywords,
  renderTemplate,
  type Detection,
  type JpProduct,
} from "./live.matcher.js";
import type { CreateOrderInput, CreateSessionInput, UpdateOrderInput, UpdateSessionInput } from "./live.schema.js";

type MetaAccount = SocialAccount & { platform: "FACEBOOK" | "INSTAGRAM" };
type SessionWithAccount = LiveSession & { account: SocialAccount };

export const DEFAULT_TEMPLATES = {
  keywords: "jp, j'prends, jprends, je prends, j'prend, je prend",
  requiredFields: "nom,telephone,adresse",
  replyPublic: "{nom}, JP {code} bien noté ✅ Consultez vos messages 📩",
  firstMessage:
    "Bonjour {nom} 👋 Merci pour votre JP : {produit} {prix}.\n" +
    "Pour valider votre commande, répondez à ce message avec :\n• votre nom complet\n• votre numéro de téléphone\n• votre adresse de livraison",
  missingMessage: "Merci {nom} ! Il nous manque encore {manquant}. Pouvez-vous nous l'envoyer ?",
  confirmMessage: "Merci {nom} ✅ Votre commande est enregistrée : {articles}. Nous vous appelons au {telephone} pour la livraison.",
  soldOutMessage: "Désolé {nom}, {produit} est épuisé 😔 Vous êtes sur liste d'attente : nous vous prévenons s'il se libère.",
};

const ORDER_STATUSES = ["NEW", "MESSAGED", "PARTIAL", "CONFIRMED", "WAITLIST", "DELIVERED", "CANCELED"] as const;
const isOrderStatus = (s: string): s is LiveOrder["status"] => (ORDER_STATUSES as readonly string[]).includes(s);
const OPEN_ORDER = ["MESSAGED", "PARTIAL"] as const; // en attente des coordonnées du client
const MAX_REMINDERS = 3;
const REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // une session terminée reçoit encore les réponses 7 jours

const isMeta = (a: SocialAccount): a is MetaAccount => a.platform === "FACEBOOK" || a.platform === "INSTAGRAM";

async function findAccount(userId: string, accountId: string): Promise<MetaAccount> {
  const acc = await prisma.socialAccount.findFirst({ where: { id: accountId, userId, isActive: true } });
  if (!acc || !isMeta(acc)) throw new AppError("Compte introuvable ou désactivé", 404);
  return acc;
}

async function findSession(userId: string, id: string) {
  const s = await prisma.liveSession.findFirst({ where: { id, userId }, include: { account: true } });
  if (!s) throw new AppError("Session introuvable", 404);
  return s;
}

async function findOrder(userId: string, id: string) {
  const o = await prisma.liveOrder.findFirst({ where: { id, session: { userId } }, include: { session: { include: { account: true } } } });
  if (!o) throw new AppError("Commande introuvable", 404);
  return o;
}

// Traduit les refus fréquents de Meta
export function explain(e: unknown): string {
  const raw = graphErrorMessage(e).replace(/\s+/g, " ").trim();
  if (/outside of allowed window/i.test(raw)) return "Plus de 24 h sans message du client : Messenger refuse l'envoi.";
  if (/already.*(replied|sent)|only.*one.*private/i.test(raw)) return "Message privé déjà envoyé pour ce commentaire.";
  if (/impersonat/i.test(raw)) return "Page non autorisée : reconnectez Facebook en cochant cette Page.";
  if (/\(#(200|10|230)\)|permission/i.test(raw)) return `Autorisation manquante : reconnectez Facebook (${raw})`;
  return raw;
}

const firstName = (name: string) => name.replace(/^@/, "").trim().split(/\s+/)[0] || name;
const isOwnComment = (acc: SocialAccount, c: { authorId?: string | null; authorName: string }) =>
  (c.authorId && c.authorId === acc.externalId) || (acc.platform === "INSTAGRAM" && `@${c.authorName.replace(/^@/, "")}` === acc.name);

const productLabel = (o: Pick<LiveOrder, "productName" | "code">) => o.productName ?? (o.code ? `l'article ${o.code}` : "votre article");

function varsFor(session: LiveSession, account: SocialAccount, orders: LiveOrder[], missing: string[] = []) {
  const o = orders[0];
  const total = orders.reduce((n, x) => n + (x.unitPrice ?? 0) * x.quantity, 0);
  return {
    nom: firstName(o.fullName ?? o.customerName),
    client: o.fullName ?? o.customerName,
    code: o.code ?? "",
    produit: productLabel(o),
    prix: o.unitPrice !== null ? `(${formatAriary(o.unitPrice * o.quantity)})` : "",
    quantite: String(o.quantity),
    total: total ? formatAriary(total) : "",
    articles: orders.map((x) => `${productLabel(x)}${x.quantity > 1 ? ` x${x.quantity}` : ""}`).join(", "),
    telephone: o.phone ?? "",
    adresse: o.address ?? "",
    manquant: missing.map((f) => FIELD_LABELS[f as keyof typeof FIELD_LABELS]).join(" et "),
    page: account.name,
    live: session.title,
  };
}

const contactOf = (orders: LiveOrder[]) => ({
  fullName: orders.find((o) => o.fullName)?.fullName ?? null,
  phone: orders.find((o) => o.phone)?.phone ?? null,
  address: orders.find((o) => o.address)?.address ?? null,
});

// ============================================================
// Capture : commentaires → commandes JP → message privé
// ============================================================

interface LiveCommentInput {
  id: string;
  text: string;
  authorId?: string | null;
  authorName: string;
  createdAt: Date;
}

// Message privé adapté à l'état de la commande.
// Nouveau JP : réponse privée à son commentaire (une seule autorisée par commentaire).
// Relance : dans la conversation déjà ouverte avec le client, sinon réponse privée au commentaire.
async function contactCustomer(session: LiveSession, account: SocialAccount, order: LiveOrder, mode: "new" | "relaunch") {
  const publicReply = mode === "new";
  const required = parseFields(session.requiredFields);
  const missing = missingFields(order, required);
  const waitlist = order.status === "WAITLIST";
  const template = waitlist ? session.soldOutMessage : missing.length ? session.firstMessage : session.confirmMessage;
  const text = renderTemplate(template, varsFor(session, account, [order], missing));
  const errors: string[] = [];

  if (publicReply && !waitlist && session.replyPublic?.trim() && order.commentId) {
    const reply = renderTemplate(session.replyPublic, varsFor(session, account, [order], missing));
    try {
      if (account.platform === "INSTAGRAM") await graphClient.replyToInstagramComment(order.commentId, reply, account.accessToken);
      else await graphClient.replyToComment(order.commentId, reply, account.accessToken);
    } catch (e) {
      errors.push(`Réponse publique : ${explain(e)}`);
    }
  }

  let recipientId = order.recipientId;
  let sent = false;
  try {
    if (order.commentId && (mode === "new" || !recipientId)) {
      const res = await graphClient.sendPrivateReply(order.commentId, text, account.accessToken);
      recipientId = res.recipient_id ?? recipientId;
    } else if (recipientId) {
      await graphClient.sendMessage(recipientId, text, account.accessToken);
    } else {
      throw new Error("Aucun commentaire ni conversation pour joindre ce client.");
    }
    sent = true;
  } catch (e) {
    errors.push(`Message privé : ${explain(e)}`);
  }

  return prisma.liveOrder.update({
    where: { id: order.id },
    data: {
      recipientId,
      error: errors.length ? errors.join(" · ") : null,
      ...(sent && !waitlist ? { status: missing.length ? "MESSAGED" : "CONFIRMED" } : {}),
    },
  });
}

async function createOrder(
  session: LiveSession,
  account: SocialAccount,
  comment: LiveCommentInput,
  detection: Pick<Detection, "code" | "label" | "quantity" | "product">
) {
  const product = detection.product;
  let status: LiveOrder["status"] = "NEW";
  if (product?.stock !== null && product?.stock !== undefined) {
    const taken = await prisma.liveOrder.aggregate({
      _sum: { quantity: true },
      where: { sessionId: session.id, code: product.code, status: { notIn: ["CANCELED", "WAITLIST"] } },
    });
    if ((taken._sum.quantity ?? 0) + detection.quantity > product.stock) status = "WAITLIST";
  }

  // Client déjà connu dans cette session : ses coordonnées sont reprises
  const known = comment.authorId
    ? await prisma.liveOrder.findMany({ where: { sessionId: session.id, customerId: comment.authorId }, orderBy: { updatedAt: "desc" } })
    : [];
  const contact = contactOf(known);

  let order: LiveOrder;
  try {
    order = await prisma.liveOrder.create({
      data: {
        sessionId: session.id,
        commentId: comment.id,
        customerId: comment.authorId ?? null,
        customerName: comment.authorName,
        recipientId: known.find((o) => o.recipientId)?.recipientId ?? null,
        comment: comment.text,
        code: detection.code,
        productName: product?.name ?? detection.label,
        quantity: detection.quantity,
        unitPrice: product?.price ?? null,
        ...contact,
        status,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null; // déjà créée
    throw e;
  }
  const final = session.autoMessage ? await contactCustomer(session, account, order, "new") : order;
  // Un JP est un lead chaud (après le message : son identifiant Messenger est connu)
  await recordFromLiveOrder(account, final).catch((e) => console.error(`❌ Lead du JP ${final.id} :`, e));
  return final;
}

async function productsOf(sessionId: string): Promise<JpProduct[]> {
  return prisma.liveProduct.findMany({ where: { sessionId }, select: { code: true, name: true, price: true, stock: true } });
}

// Enregistre un commentaire (une seule fois) et crée la commande s'il s'agit d'un JP.
// « other » : commentaire ordinaire (question, prix…), laissé aux réponses automatiques habituelles.
export type LiveIngest = { status: "duplicate" | "own" | "jp" | "other" };

export async function ingestLiveComment(session: SessionWithAccount, comment: LiveCommentInput, products?: JpProduct[]): Promise<LiveIngest> {
  const own = isOwnComment(session.account, comment);
  const detection = own
    ? null
    : detectJp(comment.text, parseKeywords(session.keywords), products ?? (await productsOf(session.id)));
  try {
    await prisma.liveComment.create({
      data: {
        sessionId: session.id,
        externalId: comment.id,
        authorId: comment.authorId ?? null,
        authorName: comment.authorName,
        text: comment.text,
        isJp: Boolean(detection?.isJp),
        createdAt: comment.createdAt,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: "duplicate" }; // déjà lu
    throw e;
  }
  if (own) return { status: "own" }; // la Page elle-même : jamais une commande
  if (!detection?.isJp) return { status: "other" };
  await createOrder(session, session.account, comment, detection);
  return { status: "jp" };
}

// Session active qui suit cette publication : elle capture les JP de ses commentaires
export function findActiveSessionForPost(accountId: string, postId: string) {
  return prisma.liveSession.findFirst({
    where: { accountId, status: "ACTIVE", OR: [{ postId }, { objectId: postId }] },
    include: { account: true },
  });
}

// ============================================================
// Réponses des clients (messages privés)
// ============================================================

// Rattache un message privé à des commandes en attente de coordonnées. null : message sans rapport.
export async function handleLiveDirectMessage(account: SocialAccount, msg: Pick<SocialMessage, "authorId" | "authorName" | "content">) {
  if (!msg.authorId) return null;
  const recent = { accountId: account.id, OR: [{ status: { not: "ENDED" as const } }, { endedAt: { gte: new Date(Date.now() - REPLY_WINDOW_MS) } }] };
  let orders = await prisma.liveOrder.findMany({
    where: { recipientId: msg.authorId, status: { in: [...OPEN_ORDER] }, session: recent },
    include: { session: true },
    orderBy: { createdAt: "asc" },
  });

  // Client qui écrit de lui-même (message privé non reçu) : rapprochement par nom, s'il est sans ambiguïté
  if (!orders.length && msg.authorName) {
    const byName = await prisma.liveOrder.findMany({
      where: { recipientId: null, status: { in: ["NEW", "MESSAGED"] }, customerName: msg.authorName, session: { accountId: account.id, status: { not: "ENDED" } } },
      include: { session: true },
      orderBy: { createdAt: "asc" },
    });
    if (byName.length && new Set(byName.map((o) => o.customerId ?? o.customerName)).size === 1) orders = byName;
  }
  if (!orders.length) return null;

  const parsed = await extractContact(msg.content);
  const session = orders[0].session;
  const known = contactOf(orders);
  const contact = {
    fullName: parsed.fullName ?? known.fullName,
    phone: parsed.phone ?? known.phone,
    address: parsed.address ?? known.address,
  };
  const missing = missingFields(contact, parseFields(session.requiredFields));
  const replies = (o: LiveOrder) => `${o.replies ? `${o.replies}\n` : ""}${msg.content}`.slice(-2000);

  for (const o of orders) {
    await prisma.liveOrder.update({
      where: { id: o.id },
      data: {
        ...contact,
        recipientId: msg.authorId,
        replies: replies(o),
        status: missing.length ? "PARTIAL" : "CONFIRMED",
        ...(missing.length ? { reminders: { increment: 1 } } : {}),
      },
    });
  }

  const updated = await prisma.liveOrder.findMany({ where: { id: { in: orders.map((o) => o.id) } }, orderBy: { createdAt: "asc" } });
  const reminders = Math.max(...orders.map((o) => o.reminders));
  const template = missing.length ? (reminders < MAX_REMINDERS ? session.missingMessage : null) : session.confirmMessage;
  if (!template) return { reply: null, orders: updated };

  const reply = renderTemplate(template, varsFor(session, account, updated, missing));
  try {
    await graphClient.sendMessage(msg.authorId, reply, account.accessToken);
  } catch (e) {
    const error = `Message privé : ${explain(e)}`;
    await prisma.liveOrder.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { error } });
    return { reply: null, error, orders: updated };
  }
  return { reply, orders: updated };
}

// ============================================================
// Service (routes)
// ============================================================

function stats(orders: Array<Pick<LiveOrder, "status" | "quantity" | "unitPrice" | "customerId" | "customerName">>) {
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  const counted = orders.filter((o) => o.status === "CONFIRMED" || o.status === "DELIVERED");
  return {
    orders: orders.length,
    customers: new Set(orders.map((o) => o.customerId ?? o.customerName)).size,
    byStatus,
    revenue: counted.reduce((n, o) => n + (o.unitPrice ?? 0) * o.quantity, 0),
    items: counted.reduce((n, o) => n + o.quantity, 0),
  };
}

const sessionSelect = {
  account: { select: { id: true, name: true, platform: true, avatarUrl: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.LiveSessionInclude;

export const liveService = {
  // Lives et publications d'un compte pouvant servir de source
  async sources(userId: string, accountId: string) {
    const acc = await findAccount(userId, accountId);
    let lives: Array<Record<string, unknown>> = [];
    let livesError: string | null = null;
    try {
      if (acc.platform === "FACEBOOK") {
        const videos = await graphClient.getLiveVideos(acc.externalId, acc.accessToken);
        lives = videos.map((v) => ({
          type: "live",
          objectId: v.video?.id ?? v.id,
          liveVideoId: v.id,
          title: v.title || v.description || "Vidéo en direct",
          status: v.status,
          createdAt: v.creation_time ?? null,
          permalink: v.permalink_url ? new URL(v.permalink_url, "https://www.facebook.com").toString() : null,
          thumbnail: v.video?.picture ?? null,
        }));
      } else {
        const media = await graphClient.getInstagramLiveMedia(acc.externalId, acc.accessToken);
        lives = media.map((m) => ({
          type: "live",
          objectId: m.id,
          liveVideoId: null,
          title: m.caption || "Live Instagram",
          status: "LIVE",
          createdAt: m.timestamp ?? null,
          permalink: m.permalink ?? null,
          thumbnail: null,
        }));
      }
    } catch (e) {
      livesError = explain(e);
    }
    const { posts, errors } = await workspaceService.posts(userId, [accountId]);
    return {
      lives,
      livesError,
      posts: posts.slice(0, 20).map((p) => ({
        type: "post",
        objectId: p.id,
        liveVideoId: null,
        title: p.text.slice(0, 100) || "Publication sans texte",
        status: p.kind,
        createdAt: p.time,
        permalink: p.permalink,
        thumbnail: p.image,
        comments: p.comments,
      })),
      postsError: errors[0]?.message ?? null,
    };
  },

  async listSessions(userId: string) {
    const sessions = await prisma.liveSession.findMany({ where: { userId }, include: sessionSelect, orderBy: { createdAt: "desc" }, take: 100 });
    const orders = await prisma.liveOrder.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      select: { sessionId: true, status: true, quantity: true, unitPrice: true, customerId: true, customerName: true },
    });
    return sessions.map((s) => ({ ...s, stats: stats(orders.filter((o) => o.sessionId === s.id)) }));
  },

  async getSession(userId: string, id: string) {
    const s = await prisma.liveSession.findFirst({
      where: { id, userId },
      include: { ...sessionSelect, products: { orderBy: { code: "asc" } } },
    });
    if (!s) throw new AppError("Session introuvable", 404);
    const orders = await prisma.liveOrder.findMany({ where: { sessionId: id }, select: { status: true, quantity: true, unitPrice: true, customerId: true, customerName: true } });
    const jp = await prisma.liveComment.count({ where: { sessionId: id, isJp: true } });
    return { ...s, stats: { ...stats(orders), jp } };
  },

  async createSession(userId: string, input: CreateSessionInput) {
    const acc = await findAccount(userId, input.accountId);
    const src = input.source;
    // Facebook : les webhooks désignent la vidéo par {pageId}_{videoId}
    const postId = acc.platform === "FACEBOOK" && !src.objectId.includes("_") ? `${acc.externalId}_${src.objectId}` : src.objectId;
    if (acc.platform === "FACEBOOK" && !postId.startsWith(`${acc.externalId}_`)) {
      throw new AppError(`Cette publication n'appartient pas à ${acc.name}`, 422);
    }
    const active = await prisma.liveSession.findFirst({ where: { accountId: acc.id, status: { not: "ENDED" }, objectId: src.objectId } });
    if (active) throw new AppError(`Une session suit déjà cette ${src.type === "live" ? "vidéo" : "publication"} : « ${active.title} »`, 409);

    const session = await prisma.liveSession.create({
      data: {
        userId,
        accountId: acc.id,
        title: input.title ?? `Live du ${new Date().toLocaleDateString("fr-FR")}`,
        sourceType: src.type,
        objectId: src.objectId,
        postId,
        liveVideoId: src.liveVideoId ?? null,
        permalink: src.permalink ?? null,
        thumbnail: src.thumbnail ?? null,
        keywords: input.keywords ?? DEFAULT_TEMPLATES.keywords,
        requiredFields: input.requiredFields?.join(",") ?? DEFAULT_TEMPLATES.requiredFields,
        autoMessage: input.autoMessage ?? true,
        replyPublic: input.replyPublic === undefined ? DEFAULT_TEMPLATES.replyPublic : input.replyPublic,
        firstMessage: input.firstMessage ?? DEFAULT_TEMPLATES.firstMessage,
        missingMessage: input.missingMessage ?? DEFAULT_TEMPLATES.missingMessage,
        confirmMessage: input.confirmMessage ?? DEFAULT_TEMPLATES.confirmMessage,
        soldOutMessage: input.soldOutMessage ?? DEFAULT_TEMPLATES.soldOutMessage,
        // Sans reprise de l'existant : seuls les commentaires publiés à partir de maintenant comptent
        cursor: input.includeExisting ? null : new Date(),
        products: { create: input.products.map((p) => ({ code: p.code, name: p.name, price: p.price ?? null, stock: p.stock ?? null })) },
      },
      include: { account: true },
    });
    await prisma.activityLog.create({ data: { userId, action: "LIVE_SESSION_STARTED", meta: { sessionId: session.id, accountId: acc.id } } });
    return liveService.getSession(userId, session.id);
  },

  async updateSession(userId: string, id: string, input: UpdateSessionInput) {
    const s = await findSession(userId, id);
    if (input.status === "ACTIVE" && s.status === "ENDED") {
      const other = await prisma.liveSession.findFirst({ where: { id: { not: id }, accountId: s.accountId, objectId: s.objectId, status: { not: "ENDED" } } });
      if (other) throw new AppError(`Une autre session suit déjà cette source : « ${other.title} »`, 409);
    }
    await prisma.liveSession.update({
      where: { id },
      data: {
        ...input,
        requiredFields: input.requiredFields?.join(","),
        ...(input.status === "ENDED" && s.status !== "ENDED" ? { endedAt: new Date() } : {}),
        ...(input.status && input.status !== "ENDED" ? { endedAt: null } : {}),
      },
    });
    return liveService.getSession(userId, id);
  },

  async removeSession(userId: string, id: string) {
    await findSession(userId, id);
    await prisma.liveSession.delete({ where: { id } });
  },

  async replaceProducts(userId: string, id: string, products: CreateSessionInput["products"]) {
    await findSession(userId, id);
    await prisma.$transaction([
      prisma.liveProduct.deleteMany({ where: { sessionId: id } }),
      prisma.liveProduct.createMany({
        data: products.map((p) => ({ sessionId: id, code: p.code, name: p.name, price: p.price ?? null, stock: p.stock ?? null })),
      }),
    ]);
    return prisma.liveProduct.findMany({ where: { sessionId: id }, orderBy: { code: "asc" } });
  },

  // Session avec son compte (lecture des commentaires)
  withAccount: findSession,

  // Derniers commentaires, avec la commande créée pour les JP
  async comments(userId: string, id: string, after?: string) {
    const session = await findSession(userId, id);
    const comments = await prisma.liveComment.findMany({
      where: { sessionId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const orders = await prisma.liveOrder.findMany({
      where: { sessionId: id, commentId: { in: comments.map((c) => c.externalId) } },
      select: { id: true, commentId: true, status: true, code: true },
    });
    const byComment = new Map(orders.map((o) => [o.commentId, o]));
    // own : publié en tant que Page (jamais compté comme JP)
    return comments.map((c) => ({ ...c, own: Boolean(isOwnComment(session.account, c)), order: byComment.get(c.externalId) ?? null }));
  },

  // Commentaire non détecté que le vendeur marque lui-même comme JP
  async markJp(userId: string, sessionId: string, commentId: string, input: { code?: string | null; quantity: number }) {
    const session = await findSession(userId, sessionId);
    const comment = await prisma.liveComment.findFirst({ where: { sessionId, externalId: commentId } });
    if (!comment) throw new AppError("Commentaire introuvable", 404);
    if (isOwnComment(session.account, comment)) throw new AppError("Commentaire publié par votre Page : ce n'est pas une commande client", 422);
    const products = await productsOf(sessionId);
    const code = input.code?.trim() || null;
    const product = code ? (products.find((p) => p.code.toLowerCase() === code.toLowerCase()) ?? null) : null;
    await prisma.liveComment.update({ where: { id: comment.id }, data: { isJp: true } });
    const order = await createOrder(
      session,
      session.account,
      { id: comment.externalId, text: comment.text, authorId: comment.authorId, authorName: comment.authorName, createdAt: comment.createdAt },
      { code: product?.code ?? code?.toUpperCase() ?? null, label: null, quantity: input.quantity, product }
    );
    if (!order) throw new AppError("Une commande existe déjà pour ce commentaire", 409);
    return order;
  },

  listOrders(userId: string, filters: { sessionId?: string; status?: string[] }) {
    return prisma.liveOrder.findMany({
      where: {
        session: { userId },
        ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
        ...(filters.status?.length ? { status: { in: filters.status.filter(isOrderStatus) } } : {}),
      },
      include: { session: { select: { id: true, title: true, account: { select: { name: true, platform: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
  },

  async createOrder(userId: string, sessionId: string, input: CreateOrderInput) {
    const session = await findSession(userId, sessionId);
    const missing = missingFields(
      { fullName: input.fullName ?? null, phone: input.phone ?? null, address: input.address ?? null },
      parseFields(session.requiredFields)
    );
    return prisma.liveOrder.create({
      data: {
        sessionId,
        customerName: input.customerName,
        comment: "Ajout manuel",
        code: input.code ?? null,
        productName: input.productName ?? null,
        quantity: input.quantity,
        unitPrice: input.unitPrice ?? null,
        fullName: input.fullName ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        note: input.note ?? null,
        status: missing.length ? "NEW" : "CONFIRMED",
      },
    });
  },

  async updateOrder(userId: string, id: string, input: UpdateOrderInput) {
    await findOrder(userId, id);
    return prisma.liveOrder.update({ where: { id }, data: input });
  },

  async removeOrder(userId: string, id: string) {
    await findOrder(userId, id);
    await prisma.liveOrder.delete({ where: { id } });
  },

  // Message au client : texte libre, ou relance automatique adaptée à la commande
  async messageOrder(userId: string, id: string, text: string | null | undefined) {
    const order = await findOrder(userId, id);
    const { session } = order;
    const account = session.account;
    if (!text) return contactCustomer(session, account, order, "relaunch");

    const send = async (tag?: string) => {
      if (order.recipientId) return graphClient.sendMessage(order.recipientId, text, account.accessToken, tag);
      if (order.commentId) return graphClient.sendPrivateReply(order.commentId, text, account.accessToken);
      throw new AppError("Aucun moyen de joindre ce client : pas de commentaire ni de conversation", 422);
    };
    try {
      try {
        await send();
      } catch (e) {
        // Hors fenêtre de 24 h : un suivi de commande est autorisé sur Messenger avec l'étiquette dédiée
        if (account.platform === "FACEBOOK" && order.recipientId && /outside of allowed window/i.test(graphErrorMessage(e))) {
          await send("POST_PURCHASE_UPDATE");
        } else {
          throw e;
        }
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      const error = explain(e);
      await prisma.liveOrder.update({ where: { id }, data: { error: `Message privé : ${error}` } });
      throw new AppError(`Envoi impossible : ${error}`, 502);
    }
    return prisma.liveOrder.update({ where: { id }, data: { error: null } });
  },

  detect(text: string, keywords?: string, products?: JpProduct[]) {
    return detectJp(text, parseKeywords(keywords || DEFAULT_TEMPLATES.keywords), products ?? []);
  },

  defaults: () => DEFAULT_TEMPLATES,
};
