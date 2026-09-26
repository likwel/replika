import { api } from "./api";
import type { MetaPlatform } from "./workspace.api";

export type SessionStatus = "ACTIVE" | "PAUSED" | "ENDED";
export type OrderStatus = "NEW" | "MESSAGED" | "PARTIAL" | "CONFIRMED" | "WAITLIST" | "DELIVERED" | "CANCELED";
export type ContactField = "nom" | "telephone" | "adresse";

export interface LiveProduct {
  code: string;
  name: string;
  price: number | null;
  stock: number | null;
}

export interface SessionStats {
  orders: number;
  customers: number;
  byStatus: Partial<Record<OrderStatus, number>>;
  revenue: number;
  items: number;
  jp?: number;
}

export interface LiveSettings {
  title: string;
  keywords: string;
  requiredFields: ContactField[];
  autoMessage: boolean;
  replyPublic: string | null;
  firstMessage: string;
  missingMessage: string;
  confirmMessage: string;
  soldOutMessage: string;
}

export interface LiveSession extends Omit<LiveSettings, "requiredFields"> {
  id: string;
  status: SessionStatus;
  sourceType: "live" | "post";
  objectId: string;
  postId: string | null;
  liveVideoId: string | null;
  liveStatus: string | null;
  permalink: string | null;
  thumbnail: string | null;
  requiredFields: string; // "nom,telephone,adresse"
  lastPolledAt: string | null;
  syncError: string | null;
  endedAt: string | null;
  createdAt: string;
  account: { id: string; name: string; platform: MetaPlatform; avatarUrl: string | null };
  _count: { comments: number };
  stats: SessionStats;
  products?: Array<LiveProduct & { id: string }>;
}

export interface LiveSource {
  type: "live" | "post";
  objectId: string;
  liveVideoId: string | null;
  title: string;
  status: string;
  createdAt: string | null;
  permalink: string | null;
  thumbnail: string | null;
  comments?: number;
}

export interface LiveComment {
  id: string;
  externalId: string;
  authorId: string | null;
  authorName: string;
  text: string;
  isJp: boolean;
  own: boolean; // publié en tant que Page : jamais compté comme JP
  createdAt: string;
  order: { id: string; status: OrderStatus; code: string | null } | null;
}

export interface LiveOrder {
  id: string;
  sessionId: string;
  commentId: string | null;
  customerId: string | null;
  customerName: string;
  recipientId: string | null;
  comment: string;
  code: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number | null;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  replies: string | null;
  status: OrderStatus;
  reminders: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  session?: { id: string; title: string; account: { name: string; platform: MetaPlatform } };
}

export interface Detection {
  isJp: boolean;
  code: string | null;
  label: string | null;
  quantity: number;
  product: LiveProduct | null;
}

export type OrderInput = Partial<
  Pick<LiveOrder, "customerName" | "code" | "productName" | "quantity" | "unitPrice" | "fullName" | "phone" | "address" | "note" | "status">
>;

type Res<T> = { status: string; data: T };
const d = <T,>(p: Promise<Res<T>>) => p.then((r) => r.data);

export const liveApi = {
  defaults: () => d(api.get<Res<Omit<LiveSettings, "title" | "autoMessage" | "requiredFields"> & { requiredFields: string }>>("/lives/defaults")),
  sources: (accountId: string) =>
    d(api.get<Res<{ lives: LiveSource[]; livesError: string | null; posts: LiveSource[]; postsError: string | null }>>(`/lives/sources?accountId=${encodeURIComponent(accountId)}`)),
  detect: (text: string, keywords?: string, products?: LiveProduct[]) => d(api.post<Res<Detection>>("/lives/detect", { text, keywords, products })),

  sessions: () => d(api.get<Res<LiveSession[]>>("/lives/sessions")),
  session: (id: string) => d(api.get<Res<LiveSession>>(`/lives/sessions/${id}`)),
  createSession: (body: Partial<LiveSettings> & {
    accountId: string;
    source: Pick<LiveSource, "type" | "objectId" | "liveVideoId" | "permalink" | "thumbnail">;
    includeExisting: boolean;
    products: LiveProduct[];
  }) => d(api.post<Res<LiveSession>>("/lives/sessions", body)),
  updateSession: (id: string, body: Partial<LiveSettings> & { status?: SessionStatus }) => d(api.patch<Res<LiveSession>>(`/lives/sessions/${id}`, body)),
  removeSession: (id: string) => api.delete<void>(`/lives/sessions/${id}`),
  saveProducts: (id: string, products: LiveProduct[]) => d(api.put<Res<Array<LiveProduct & { id: string }>>>(`/lives/sessions/${id}/products`, { products })),
  sync: (id: string) => d(api.post<Res<{ created: number }>>(`/lives/sessions/${id}/sync`)),
  comments: (id: string, after?: string) =>
    d(api.get<Res<LiveComment[]>>(`/lives/sessions/${id}/comments${after ? `?after=${encodeURIComponent(after)}` : ""}`)),
  markJp: (id: string, commentId: string, body: { code?: string | null; quantity: number }) =>
    d(api.post<Res<LiveOrder>>(`/lives/sessions/${id}/comments/${encodeURIComponent(commentId)}/jp`, body)),

  orders: (params: { sessionId?: string; status?: OrderStatus[] } = {}) => {
    const q = new URLSearchParams();
    if (params.sessionId) q.set("sessionId", params.sessionId);
    if (params.status?.length) q.set("status", params.status.join(","));
    const qs = q.toString();
    return d(api.get<Res<LiveOrder[]>>(`/lives/orders${qs ? `?${qs}` : ""}`));
  },
  createOrder: (sessionId: string, body: OrderInput & { customerName: string }) => d(api.post<Res<LiveOrder>>(`/lives/sessions/${sessionId}/orders`, body)),
  updateOrder: (id: string, body: OrderInput) => d(api.patch<Res<LiveOrder>>(`/lives/orders/${id}`, body)),
  removeOrder: (id: string) => api.delete<void>(`/lives/orders/${id}`),
  message: (id: string, text?: string) => d(api.post<Res<LiveOrder>>(`/lives/orders/${id}/message`, { text: text ?? null })),
};

export const formatAriary = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n.toLocaleString("fr-FR")} Ar`;
