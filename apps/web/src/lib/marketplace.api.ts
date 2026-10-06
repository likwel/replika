import { theme } from "@/theme";
import { api } from "./api";
import type { MetaPlatform } from "./workspace.api";

export type ListingStatus = "ACTIVE" | "SOLD_OUT" | "ARCHIVED";
export type ListingSource = "MANUAL" | "CATALOG";

export interface FacebookCatalog {
  id: string;
  name: string;
  productCount: number | null;
  businessName: string;
}

export interface GescomAccount {
  id: string;
  name: string;
  platform: MetaPlatform;
  avatarUrl: string | null;
  catalogId: string | null;
  catalogName: string | null;
  catalogSyncedAt: string | null;
  facebookLinked: boolean; // jeton utilisateur Facebook présent : sans lui, pas d'accès au catalogue
}

// Publication Gescom → Catalogue Facebook
export interface PushResult {
  sent: number;
  skipped: Array<{ title: string; reason: string }>;
  errors: string[];
}

export interface SyncResult {
  created: number;
  updated: number;
  total: number;
}
export type MarketplaceOrderStatus = "NEW" | "CONTACTED" | "CONFIRMED" | "DELIVERED" | "CANCELED";

export interface MarketplaceListing {
  id: string;
  accountId: string;
  title: string;
  description: string | null;
  price: number | null;
  stock: number | null;
  category: string | null;
  images: string[];
  status: ListingStatus;
  source: ListingSource;
  externalId: string | null;
  pushedAt: string | null; // dernière publication réussie vers le Catalogue Facebook
  push?: PushState; // résultat de la publication tentée à l'enregistrement
  account: { id: string; name: string; platform: MetaPlatform; avatarUrl: string | null };
  _count: { orders: number };
  createdAt: string;
  updatedAt: string;
}

// Ce que l'API répond après une tentative de publication vers Facebook
export interface PushState {
  ok: boolean;
  message: string;
}

export interface MarketplaceListingDetail extends MarketplaceListing {
  orders: MarketplaceOrder[];
}

export interface MarketplaceOrder {
  id: string;
  listingId: string;
  customerId: string | null;
  customerName: string;
  quantity: number;
  unitPrice: number | null;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  status: MarketplaceOrderStatus;
  createdAt: string;
  updatedAt: string;
  listing?: { id: string; title: string; account: { name: string; platform: MetaPlatform } };
}

export interface MarketplaceStats {
  listings: number;
  activeListings: number;
  orders: number;
  byStatus: Partial<Record<MarketplaceOrderStatus, number>>;
  revenue: number;
}

export type ListingInput = Pick<MarketplaceListing, "accountId" | "title" | "description" | "price" | "stock" | "category" | "images" | "status">;
export type OrderInput = Partial<Pick<MarketplaceOrder, "customerName" | "quantity" | "unitPrice" | "fullName" | "phone" | "address" | "note" | "status">>;

type Res<T> = { status: string; data: T };
const d = <T,>(p: Promise<Res<T>>) => p.then((r) => r.data);

export const marketplaceApi = {
  stats: () => d(api.get<Res<MarketplaceStats>>("/marketplace/stats")),

  listings: (filters: { accountId?: string; status?: ListingStatus } = {}) => {
    const q = new URLSearchParams();
    if (filters.accountId) q.set("accountId", filters.accountId);
    if (filters.status) q.set("status", filters.status);
    const qs = q.toString();
    return d(api.get<Res<MarketplaceListing[]>>(`/marketplace/listings${qs ? `?${qs}` : ""}`));
  },
  listing: (id: string) => d(api.get<Res<MarketplaceListingDetail>>(`/marketplace/listings/${id}`)),
  createListing: (body: ListingInput) => d(api.post<Res<MarketplaceListing>>("/marketplace/listings", body)),
  updateListing: (id: string, body: Partial<ListingInput>) => d(api.patch<Res<MarketplaceListing>>(`/marketplace/listings/${id}`, body)),
  removeListing: (id: string) => api.delete<void>(`/marketplace/listings/${id}`),

  orders: (filters: { listingId?: string; status?: MarketplaceOrderStatus[] } = {}) => {
    const q = new URLSearchParams();
    if (filters.listingId) q.set("listingId", filters.listingId);
    if (filters.status?.length) q.set("status", filters.status.join(","));
    const qs = q.toString();
    return d(api.get<Res<MarketplaceOrder[]>>(`/marketplace/orders${qs ? `?${qs}` : ""}`));
  },
  createOrder: (listingId: string, body: OrderInput & { customerName: string }) =>
    d(api.post<Res<MarketplaceOrder>>(`/marketplace/listings/${listingId}/orders`, body)),
  updateOrder: (id: string, body: OrderInput) => d(api.patch<Res<MarketplaceOrder>>(`/marketplace/orders/${id}`, body)),
  removeOrder: (id: string) => api.delete<void>(`/marketplace/orders/${id}`),

  // Catalogue Facebook (Commerce Manager) : produits publiés sur Marketplace
  accounts: () => d(api.get<Res<GescomAccount[]>>("/marketplace/accounts")),
  catalogs: () => d(api.get<Res<FacebookCatalog[]>>("/marketplace/catalogs")),
  connectCatalog: (accountId: string, body: { catalogId: string | null; catalogName: string | null }) =>
    d(api.put<Res<GescomAccount>>(`/marketplace/accounts/${accountId}/catalog`, body)),
  syncCatalog: (accountId: string) => d(api.post<Res<SyncResult>>(`/marketplace/accounts/${accountId}/sync`)),
  pushCatalog: (accountId: string) => d(api.post<Res<PushResult>>(`/marketplace/accounts/${accountId}/push`)),
  pushListing: (id: string) => d(api.post<Res<PushResult>>(`/marketplace/listings/${id}/push`)),
};

export const LISTING_STATUS: Record<ListingStatus, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "En ligne", color: theme.green, bg: theme.greenSoft },
  SOLD_OUT: { label: "Épuisé", color: theme.amber, bg: theme.amberSoft },
  ARCHIVED: { label: "Archivé", color: "#6b7280", bg: "#F3F4F6" },
};

export const formatAriaryMk = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n.toLocaleString("fr-FR")} Ar`;

export const MARKETPLACE_ORDER_STATUS: Record<MarketplaceOrderStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: "Nouveau", color: theme.textMuted, bg: theme.bg },
  CONTACTED: { label: "Contacté", color: "#2563eb", bg: "#E8F0FE" },
  CONFIRMED: { label: "Confirmé", color: theme.green, bg: theme.greenSoft },
  DELIVERED: { label: "Livré", color: theme.goldDark, bg: theme.goldSoft },
  CANCELED: { label: "Annulé", color: theme.red, bg: "#FDECEC" },
};
