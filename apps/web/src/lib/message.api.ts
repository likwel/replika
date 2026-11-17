import { api } from "./api";
import type { AiReply, Intent } from "./ai.api";

export type MessageStatus = "PENDING" | "REPLIED" | "ESCALATED" | "IGNORED";
export type MessageKind = "COMMENT" | "DIRECT" | "LIVE_COMMENT";

export interface InboxMessage {
  id: string;
  externalId: string;
  kind: MessageKind;
  accountId: string;
  authorId: string | null;
  postId: string | null;
  authorName: string;
  content: string;
  intent: Intent | null;
  aiReply: string | null;
  aiGenerated: boolean;
  status: MessageStatus;
  error: string | null;
  repliedAt: string | null;
  seenAt: string | null; // null : nouveau (jamais vu dans À traiter)
  createdAt: string;
  account: { name: string; platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK"; avatarUrl: string | null };
  rule: { name: string } | null;
}

type Res<T> = { status: string; data: T };
// Les actions renvoient le message sans ses relations
type Updated = Omit<InboxMessage, "account" | "rule">;

// Bulle de notification : ce qui attend une action, dont les nouveautés (jamais vues)
export interface NotificationItem {
  id: string;
  kind: MessageKind;
  accountId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  postId: string | null;
  externalId: string;
  status: MessageStatus;
  intent: Intent | null;
  createdAt: string;
  seen: boolean;
  account: { name: string; platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK"; avatarUrl: string | null };
}
export interface Notifications { total: number; unseen: number; items: NotificationItem[] }

export const messageApi = {
  notifications: () => api.get<Res<Notifications>>("/messages/notifications").then((r) => r.data),

  // Marque des messages précis, ou tout ce qui est à traiter, comme vus
  markSeen: (input: { ids: string[] } | { all: true }) => api.post<Res<{ updated: number }>>("/messages/seen", input).then((r) => r.data),

  list: (filters: { status?: MessageStatus[]; kind?: MessageKind; accounts?: string[] }) => {
    const params = new URLSearchParams();
    if (filters.accounts?.length) params.set("accounts", filters.accounts.join(","));
    if (filters.status?.length) params.set("status", filters.status.join(","));
    if (filters.kind) params.set("kind", filters.kind);
    const qs = params.toString();
    return api.get<Res<InboxMessage[]>>(`/messages${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },

  reply: (id: string, reply: string) =>
    api.post<Res<Updated>>(`/messages/${id}/reply`, { reply }).then((r) => r.data),

  // Réponse proposée par l'IA (non envoyée)
  aiSuggest: (id: string) =>
    api.post<Res<Updated & { suggestion: AiReply }>>(`/messages/${id}/ai-suggest`).then((r) => r.data),

  escalate: (id: string) => api.post<Res<Updated>>(`/messages/${id}/escalate`).then((r) => r.data),

  ignore: (id: string) => api.post<Res<Updated>>(`/messages/${id}/ignore`).then((r) => r.data),
};
