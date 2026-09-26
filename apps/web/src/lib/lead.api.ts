import { api } from "./api";
import type { MetaPlatform } from "./workspace.api";

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type Temperature = "hot" | "warm" | "cold";

export interface Lead {
  id: string;
  personId: string | null;
  psid: string | null;
  name: string;
  score: number;
  signals: string[];
  intent: string | null;
  phone: string | null;
  email: string | null;
  lastMessage: string;
  lastSource: "COMMENT" | "DIRECT" | "LIVE";
  postId: string | null;
  messageCount: number;
  status: LeadStatus;
  value: number | null;
  note: string | null;
  lastSeenAt: string;
  createdAt: string;
  account: { id: string; name: string; platform: MetaPlatform; avatarUrl: string | null };
}

export interface LeadDetail extends Lead {
  messages: Array<{ id: string; kind: "COMMENT" | "DIRECT" | "LIVE_COMMENT"; content: string; createdAt: string; status: string; aiReply: string | null; leadScore: number | null }>;
  orders: Array<{ id: string; code: string | null; productName: string | null; quantity: number; unitPrice: number | null; status: string; createdAt: string; session: { title: string } }>;
}

export interface LeadStats {
  total: number;
  hot: number;
  toContact: number;
  byStatus: Record<LeadStatus, number>;
  newThisWeek: number;
  conversion: number | null;
  wonValue: number;
}

type Res<T> = { status: string; data: T };
const d = <T,>(p: Promise<Res<T>>) => p.then((r) => r.data);

export const leadApi = {
  list: (params: { status?: LeadStatus[]; temperature?: Temperature; accountId?: string; q?: string; sort?: "score" | "recent" } = {}) => {
    const q = new URLSearchParams();
    if (params.status?.length) q.set("status", params.status.join(","));
    if (params.temperature) q.set("temperature", params.temperature);
    if (params.accountId) q.set("accountId", params.accountId);
    if (params.q) q.set("q", params.q);
    if (params.sort) q.set("sort", params.sort);
    const qs = q.toString();
    return d(api.get<Res<Lead[]>>(`/leads${qs ? `?${qs}` : ""}`));
  },
  stats: () => d(api.get<Res<LeadStats>>("/leads/stats")),
  get: (id: string) => d(api.get<Res<LeadDetail>>(`/leads/${id}`)),
  update: (id: string, body: Partial<Pick<Lead, "status" | "note" | "value" | "phone" | "email" | "name">>) => d(api.patch<Res<Lead>>(`/leads/${id}`, body)),
  remove: (id: string) => api.delete<void>(`/leads/${id}`),
  message: (id: string, text: string) => d(api.post<Res<Lead>>(`/leads/${id}/message`, { text })),
  rescan: () => d(api.post<Res<{ analyzed: number; created: number }>>("/leads/rescan")),
};
