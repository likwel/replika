import { api } from "./api";
import type { MetaPlatform } from "./workspace.api";
import type { RuleChannel } from "./automation.api";

export const DAY_RANGES = [7, 14, 30] as const;
export type DayRange = (typeof DAY_RANGES)[number];

export interface StatsOverview {
  windowDays: number;
  totals: { comments: number; messages: number; leads: number; aiReplies: number };
  // variation en % vs la période précédente de même durée ; null = pas de comparaison possible
  trends: { comments: number | null; messages: number | null; leads: number | null; aiReplies: number | null };
  responseRate: { auto: number; manual: number; pending: number; total: number };
}

export interface EngagementDay {
  date: string; // "2026-10-03"
  FACEBOOK: number;
  INSTAGRAM: number;
}

export interface AccountStats {
  id: string;
  name: string;
  platform: MetaPlatform;
  avatarUrl: string | null;
  comments: number;
  messages: number;
  leads: number;
}

export interface RuleStats {
  id: string;
  name: string;
  channel: RuleChannel;
  autoSend: boolean;
  hitCount: number;
  lastTriggeredAt: string | null;
  account: { name: string } | null;
}

type Res<T> = { status: string; data: T };

export const statsApi = {
  overview: () => api.get<Res<StatsOverview>>("/stats/overview").then((r) => r.data),
  engagement: (days: DayRange) => api.get<Res<EngagementDay[]>>(`/stats/engagement?days=${days}`).then((r) => r.data),
  accounts: () => api.get<Res<AccountStats[]>>("/stats/accounts").then((r) => r.data),
  rules: () => api.get<Res<RuleStats[]>>("/stats/rules").then((r) => r.data),
};
