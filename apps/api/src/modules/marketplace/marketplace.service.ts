import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { graphClient, graphErrorMessage, type CatalogItemRequest } from "../facebook/graph.client.js";
import type { ListingInput, ListingUpdateInput, OrderInput, OrderUpdateInput } from "./marketplace.schema.js";

const SOLD = ["CONFIRMED", "DELIVERED"] as const;

async function findAccount(userId: string, accountId: string) {
  const acc = await prisma.socialAccount.findFirst({ where: { id: accountId, userId, isActive: true } });
  if (!acc) throw new AppError("Compte introuvable ou désactivé", 404);
  return acc;
}

// Le Business Manager et les catalogues ne sont accessibles qu'avec le jeton utilisateur, pas celui d'une Page
async function userToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fbUserToken: true } });
  if (!user?.fbUserToken) {
    throw new AppError("Reconnectez Facebook pour autoriser l'accès à votre catalogue (Gescom).", 422);
  }
  return user.fbUserToken;
}

// Traduit les refus de Meta propres au catalogue
function explainCatalog(e: unknown): string {
  const raw = graphErrorMessage(e).replace(/\s+/g, " ").trim();
  if (/catalog_management|permission/i.test(raw)) {
    return `Autorisation « catalog_management » manquante : elle doit être validée par Meta pour votre application (${raw})`;
  }
  if (/business/i.test(raw)) return `Business Manager inaccessible : ${raw}`;
  return raw;
}

// « 35000.00 MGA » → 35000
function parseCatalogPrice(price: string | undefined): number | null {
  if (!price) return null;
  const n = parseFloat(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Meta télécharge l'image depuis ses serveurs : une URL relative est absolutisée, une URL locale est refusée
function publicImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `${env.publicApiUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)/i.test(url) ? null : url;
}

type PushAccount = { id: string; name: string; externalId: string; catalogId: string | null };
type PushListing = { id: string; title: string; description: string | null; price: number | null; stock: number | null; status: string; images: string[]; retailerId: string | null };

function requireCatalog(acc: PushAccount): asserts acc is PushAccount & { catalogId: string } {
  if (!acc.catalogId) {
    throw new AppError(
      `Aucun catalogue Facebook connecté à « ${acc.name} ». Ouvrez Gescom → Catalogue pour en connecter un : sans catalogue, l'annonce reste dans Gescom.`,
      422
    );
  }
}

// Une annonce publiable → sa requête items_batch ; sinon le motif exact du refus, dit avant d'appeler Meta
function catalogRequest(l: PushListing, acc: PushAccount): { retailerId: string; request: CatalogItemRequest } | { reason: string } {
  if (l.price === null) return { reason: "prix manquant" };
  const image = publicImageUrl(l.images[0]);
  if (!image) {
    return {
      reason: l.images.length === 0 ? "photo manquante" : "photo non accessible depuis Internet (Meta doit pouvoir la télécharger)",
    };
  }
  const retailerId = l.retailerId ?? l.id;
  return {
    retailerId,
    request: {
      method: "UPDATE",
      retailer_id: retailerId,
      data: {
        title: l.title,
        description: l.description ?? l.title,
        availability: l.status === "SOLD_OUT" || l.stock === 0 ? "out of stock" : "in stock",
        condition: "new",
        price: `${l.price} MGA`,
        link: `https://www.facebook.com/${acc.externalId}`,
        image_link: image,
        brand: acc.name,
      },
    },
  };
}

// Envoi effectif vers le Catalogue, par lots (limite Meta par appel)
async function pushListings(userId: string, acc: PushAccount & { catalogId: string }, listings: PushListing[]) {
  const token = await userToken(userId);
  const skipped: Array<{ title: string; reason: string }> = [];
  const sendable: Array<{ id: string; retailerId: string; request: CatalogItemRequest }> = [];

  for (const l of listings) {
    const built = catalogRequest(l, acc);
    if ("reason" in built) skipped.push({ title: l.title, reason: built.reason });
    else sendable.push({ id: l.id, retailerId: built.retailerId, request: built.request });
  }

  if (sendable.length === 0) {
    throw new AppError(`Aucune annonce publiable : ${skipped.map((s) => `« ${s.title} » (${s.reason})`).join(", ")}`, 422);
  }

  const CHUNK = 100;
  const errors: string[] = [];
  for (let i = 0; i < sendable.length; i += CHUNK) {
    const batch = sendable.slice(i, i + CHUNK);
    try {
      const res = await graphClient.upsertCatalogItems(acc.catalogId, token, batch.map((b) => b.request));
      for (const v of res.validation_status ?? []) {
        for (const err of v.errors ?? []) {
          const message = err.description ?? err.message;
          if (message) errors.push(`${v.retailer_id ?? "article"} : ${message}`);
        }
      }
    } catch (e) {
      throw new AppError(explainCatalog(e), 502);
    }
  }

  await prisma.$transaction(
    sendable.map((s) => prisma.marketplaceListing.update({ where: { id: s.id }, data: { retailerId: s.retailerId, pushedAt: new Date() } }))
  );
  await prisma.socialAccount.update({ where: { id: acc.id }, data: { catalogSyncedAt: new Date() } });
  await prisma.activityLog.create({
    data: { userId, action: "GESCOM_CATALOG_PUSHED", meta: { accountId: acc.id, catalogId: acc.catalogId, sent: sendable.length, skipped: skipped.length } },
  });

  return { sent: sendable.length, skipped, errors };
}

// Publication tentée à l'enregistrement d'une annonce : jamais bloquante, l'annonce est déjà enregistrée.
// Le résultat est renvoyé avec elle pour que l'écran dise toujours ce qui s'est passé.
export interface PushState {
  ok: boolean;
  message: string;
}

async function autoPush(userId: string, listingId: string): Promise<PushState> {
  const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
  if (!listing) return { ok: false, message: "Annonce introuvable." };
  const acc = await prisma.socialAccount.findUnique({ where: { id: listing.accountId } });
  if (!acc) return { ok: false, message: "Page introuvable." };
  if (listing.status === "ARCHIVED") return { ok: false, message: "Annonce archivée : non publiée sur Facebook." };
  try {
    requireCatalog(acc);
    const r = await pushListings(userId, acc as PushAccount & { catalogId: string }, [listing]);
    if (r.errors.length) return { ok: false, message: `Facebook a refusé l'annonce — ${r.errors.join(" · ")}` };
    return { ok: true, message: "Publiée dans votre Catalogue Facebook." };
  } catch (e) {
    return { ok: false, message: e instanceof AppError ? e.message : "Publication vers Facebook impossible." };
  }
}

async function findListing(userId: string, id: string) {
  const listing = await prisma.marketplaceListing.findFirst({ where: { id, userId } });
  if (!listing) throw new AppError("Annonce introuvable", 404);
  return listing;
}

async function findOrder(userId: string, id: string) {
  const order = await prisma.marketplaceOrder.findFirst({ where: { id, listing: { userId } }, include: { listing: true } });
  if (!order) throw new AppError("Commande introuvable", 404);
  return order;
}

const listingSelect = {
  account: { select: { id: true, name: true, platform: true, avatarUrl: true } },
  _count: { select: { orders: true } },
} as const;

export const marketplaceService = {
  async listListings(userId: string, filters: { accountId?: string; status?: string }) {
    return prisma.marketplaceListing.findMany({
      where: {
        userId,
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.status ? { status: filters.status as "ACTIVE" | "SOLD_OUT" | "ARCHIVED" } : {}),
      },
      include: listingSelect,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  },

  async getListing(userId: string, id: string) {
    const listing = await prisma.marketplaceListing.findFirst({ where: { id, userId }, include: listingSelect });
    if (!listing) throw new AppError("Annonce introuvable", 404);
    const orders = await prisma.marketplaceOrder.findMany({ where: { listingId: id }, orderBy: { createdAt: "desc" } });
    return { ...listing, orders };
  },

  async createListing(userId: string, input: ListingInput) {
    await findAccount(userId, input.accountId);
    const listing = await prisma.marketplaceListing.create({
      data: {
        userId,
        accountId: input.accountId,
        title: input.title,
        description: input.description ?? null,
        price: input.price ?? null,
        stock: input.stock ?? null,
        category: input.category ?? null,
        images: input.images ?? [],
        status: input.status ?? "ACTIVE",
      },
      include: listingSelect,
    });
    // Publication immédiate vers le Catalogue si la Page en a un : l'écran annonce le résultat dans tous les cas
    const push = await autoPush(userId, listing.id);
    return { ...listing, pushedAt: push.ok ? new Date() : listing.pushedAt, push };
  },

  async updateListing(userId: string, id: string, input: ListingUpdateInput) {
    await findListing(userId, id);
    if (input.accountId) await findAccount(userId, input.accountId);
    const listing = await prisma.marketplaceListing.update({ where: { id }, data: input, include: listingSelect });
    const push = await autoPush(userId, listing.id);
    return { ...listing, pushedAt: push.ok ? new Date() : listing.pushedAt, push };
  },

  async removeListing(userId: string, id: string) {
    await findListing(userId, id);
    await prisma.marketplaceListing.delete({ where: { id } });
  },

  async listOrders(userId: string, filters: { listingId?: string; status?: string[] }) {
    return prisma.marketplaceOrder.findMany({
      where: {
        listing: { userId },
        ...(filters.listingId ? { listingId: filters.listingId } : {}),
        ...(filters.status?.length ? { status: { in: filters.status as Array<"NEW" | "CONTACTED" | "CONFIRMED" | "DELIVERED" | "CANCELED"> } } : {}),
      },
      include: { listing: { select: { id: true, title: true, account: { select: { name: true, platform: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
  },

  async createOrder(userId: string, listingId: string, input: OrderInput) {
    const listing = await findListing(userId, listingId);
    return prisma.marketplaceOrder.create({
      data: {
        listingId,
        customerName: input.customerName,
        quantity: input.quantity,
        unitPrice: input.unitPrice ?? listing.price ?? null,
        fullName: input.fullName ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        note: input.note ?? null,
        status: "NEW",
      },
    });
  },

  async updateOrder(userId: string, id: string, input: OrderUpdateInput) {
    await findOrder(userId, id);
    return prisma.marketplaceOrder.update({ where: { id }, data: input });
  },

  async removeOrder(userId: string, id: string) {
    await findOrder(userId, id);
    await prisma.marketplaceOrder.delete({ where: { id } });
  },

  // ============================================================
  // Catalogue Facebook (Commerce Manager) : découverte, connexion, import des produits
  // ============================================================

  // Catalogues de toutes les entreprises (Business Manager) administrées par l'utilisateur
  async listCatalogs(userId: string) {
    const token = await userToken(userId);
    try {
      const businesses = await graphClient.getUserBusinesses(token);
      const catalogs = await Promise.all(
        businesses.map(async (b) => {
          const list = await graphClient.getOwnedCatalogs(b.id, token).catch(() => []);
          return list.map((c) => ({ id: c.id, name: c.name, productCount: c.product_count ?? null, businessName: b.name }));
        })
      );
      return catalogs.flat();
    } catch (e) {
      throw new AppError(explainCatalog(e), 502);
    }
  },

  async connectCatalog(userId: string, accountId: string, catalog: { catalogId: string; catalogName: string } | null) {
    await findAccount(userId, accountId);
    return prisma.socialAccount.update({
      where: { id: accountId },
      data: { catalogId: catalog?.catalogId ?? null, catalogName: catalog?.catalogName ?? null, catalogSyncedAt: null },
      select: { id: true, name: true, catalogId: true, catalogName: true, catalogSyncedAt: true },
    });
  },

  // Importe/actualise les produits du catalogue connecté (ceux visibles sur Marketplace)
  async syncCatalog(userId: string, accountId: string) {
    const acc = await findAccount(userId, accountId);
    if (!acc.catalogId) throw new AppError("Aucun catalogue connecté à ce compte", 422);
    const token = await userToken(userId);

    let products;
    try {
      products = await graphClient.getCatalogProducts(acc.catalogId, token);
    } catch (e) {
      throw new AppError(explainCatalog(e), 502);
    }

    let created = 0;
    let updated = 0;
    for (const p of products) {
      const existing = await prisma.marketplaceListing.findFirst({ where: { accountId, externalId: p.id } });
      // Une annonce archivée à la main le reste : seul l'état en ligne / épuisé suit le catalogue
      const status = existing?.status === "ARCHIVED" ? undefined : p.availability === "out of stock" ? ("SOLD_OUT" as const) : ("ACTIVE" as const);
      const data = {
        title: p.name,
        description: p.description ?? null,
        price: parseCatalogPrice(p.price),
        category: p.category ?? null,
        images: p.image_url ? [p.image_url] : [],
        ...(status ? { status } : {}),
      };
      if (existing) {
        await prisma.marketplaceListing.update({ where: { id: existing.id }, data: { ...data, retailerId: p.retailer_id ?? existing.retailerId } });
        updated++;
      } else {
        await prisma.marketplaceListing.create({
          data: { ...data, status: status ?? "ACTIVE", userId, accountId, source: "CATALOG", externalId: p.id, retailerId: p.retailer_id ?? null },
        });
        created++;
      }
    }

    await prisma.socialAccount.update({ where: { id: accountId }, data: { catalogSyncedAt: new Date() } });
    await prisma.activityLog.create({
      data: { userId, action: "GESCOM_CATALOG_SYNCED", meta: { accountId, catalogId: acc.catalogId, created, updated } },
    });
    return { created, updated, total: products.length };
  },

  // Sens inverse de syncCatalog : publie des articles Gescom dans le Catalogue Facebook,
  // d'où Commerce Manager les diffuse sur Marketplace.
  async pushCatalog(userId: string, accountId: string) {
    const acc = await findAccount(userId, accountId);
    requireCatalog(acc);
    const listings = await prisma.marketplaceListing.findMany({
      where: { userId, accountId, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "asc" },
    });
    if (listings.length === 0) throw new AppError("Aucune annonce à publier pour ce compte", 422);
    return pushListings(userId, acc, listings);
  },

  // Publication d'une seule annonce, depuis sa fiche
  async pushListing(userId: string, id: string) {
    const listing = await findListing(userId, id);
    const acc = await findAccount(userId, listing.accountId);
    requireCatalog(acc);
    const result = await pushListings(userId, acc, [listing]);
    if (result.skipped.length) throw new AppError(`Annonce non publiable : ${result.skipped[0].reason}.`, 422);
    if (result.errors.length) throw new AppError(`Facebook a refusé l'annonce — ${result.errors.join(" · ")}`, 502);
    return result;
  },

  // Comptes du user avec l'état de leur catalogue (pour l'écran Gescom).
  // facebookLinked dit si le jeton utilisateur existe : sans lui, aucun accès catalogue n'est possible.
  async catalogStatus(userId: string) {
    const [accounts, user] = await Promise.all([
      prisma.socialAccount.findMany({
        where: { userId, isActive: true, platform: { not: "TIKTOK" } },
        select: { id: true, name: true, platform: true, avatarUrl: true, catalogId: true, catalogName: true, catalogSyncedAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { fbUserToken: true } }),
    ]);
    const facebookLinked = Boolean(user?.fbUserToken);
    return accounts.map((a) => ({ ...a, facebookLinked }));
  },

  async stats(userId: string) {
    const [listings, orders] = await Promise.all([
      prisma.marketplaceListing.findMany({ where: { userId }, select: { status: true } }),
      prisma.marketplaceOrder.findMany({ where: { listing: { userId } }, select: { status: true, quantity: true, unitPrice: true } }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    const sold = orders.filter((o) => SOLD.includes(o.status as (typeof SOLD)[number]));
    return {
      listings: listings.length,
      activeListings: listings.filter((l) => l.status === "ACTIVE").length,
      orders: orders.length,
      byStatus,
      revenue: sold.reduce((n, o) => n + (o.unitPrice ?? 0) * o.quantity, 0),
    };
  },
};
