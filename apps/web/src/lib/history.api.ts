import { api } from "./api";
import type { MetaPlatform } from "./workspace.api";

export type HistoryCategory = "message" | "connexion";

export interface HistoryAccount {
  id: string;
  name: string;
  platform: MetaPlatform | "TIKTOK";
  avatarUrl: string | null;
}

export interface HistoryEntry {
  id: string;
  action: string;
  category: HistoryCategory | null;
  createdAt: string;
  meta: Record<string, unknown> | null;
  account: HistoryAccount | null;
  context: string | null;
}

export interface HistoryCounts {
  total: number;
  message: number;
  connexion: number;
}

type Res<T> = { status: string; data: T };

export const historyApi = {
  list: (params: { category?: HistoryCategory; before?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.before) q.set("before", params.before);
    if (params.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return api.get<Res<{ items: HistoryEntry[]; nextCursor: string | null }>>(`/history${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },

  counts: () => api.get<Res<HistoryCounts>>("/history/counts").then((r) => r.data),
};
