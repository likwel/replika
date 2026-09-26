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
  createdAt: string;
  account: { name: string; platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK"; avatarUrl: string | null };
  rule: { name: string } | null;
}

type Res<T> = { status: string; data: T };
// Les actions renvoient le message sans ses relations
type Updated = Omit<InboxMessage, "account" | "rule">;

export const messageApi = {
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
