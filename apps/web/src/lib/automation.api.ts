import { api } from "./api";

export type RuleChannel = "ALL" | "COMMENT" | "DIRECT";
export type MatchType = "CONTAINS" | "EXACT" | "ANY";

export interface AutomationRule {
  id: string;
  name: string;
  channel: RuleChannel;
  matchType: MatchType;
  trigger: string;
  response: string;
  privateReply: string | null;
  autoSend: boolean;
  isActive: boolean;
  priority: number;
  hitCount: number;
  lastTriggeredAt: string | null;
  accountId: string | null;
  account: { name: string; platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK"; isActive: boolean; syncError: string | null } | null;
  createdAt: string;
}

export type RuleInput = Pick<
  AutomationRule,
  | "name"
  | "channel"
  | "matchType"
  | "trigger"
  | "response"
  | "privateReply"
  | "autoSend"
  | "isActive"
  | "priority"
  | "accountId"
>;

export interface AutomationSettings {
  autoReplyEnabled: boolean;
  pollSeconds: number;
  webhookConfigured: boolean;
  ai: { configured: boolean; provider: string; model: string };
  stats: {
    repliedToday: number;
    autoRepliedToday: number;
    pending: number;
    suggested: number;
    escalated: number;
    failed: number;
  };
  // Comptes dont la relève échoue : aucune réponse ne peut partir tant que ce n'est pas réglé
  syncIssues: Array<{ id: string; name: string; platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK"; syncError: string }>;
}

export interface SyncResult {
  accounts: number;
  processed: number;
  initialized: number;
}

export type TestResult =
  | { matched: false }
  | {
      matched: true;
      rule: { id: string; name: string; autoSend: boolean };
      reply: string;
      privateReply: string | null;
    };

type Res<T> = { status: string; data: T };

export type CheckAction = "reconnect" | "activate" | "create_rule" | "enable_ai" | "resume";

export interface HealthCheck {
  id: "active" | "authorized" | "permissions" | "sync" | "comments" | "direct";
  ok: boolean;
  warn?: boolean;
  label: string;
  detail: string;
  action?: CheckAction;
}

export interface Diagnostic {
  autoReplyEnabled: boolean;
  ai: { configured: boolean; provider: string };
  sync: { mode: "webhook" | "polling"; pollSeconds: number };
  rules: { total: number; active: number; autoSend: number };
  brokenRules: Array<{ id: string; name: string; account: string }>;
  accounts: Array<{
    id: string;
    name: string;
    platform: "FACEBOOK" | "INSTAGRAM";
    avatarUrl: string | null;
    status: "ok" | "warning" | "blocked";
    checks: HealthCheck[];
  }>;
}

export const automationApi = {
  // État réel, compte par compte (jeton, autorisations, relève, règles applicables)
  diagnostic: () => api.get<{ status: string; data: Diagnostic }>("/automation/diagnostic").then((r) => r.data),

  list: () => api.get<Res<AutomationRule[]>>("/automation").then((r) => r.data),

  create: (body: RuleInput) => api.post<Res<AutomationRule>>("/automation", body).then((r) => r.data),

  update: (id: string, body: Partial<RuleInput>) =>
    api.patch<Res<AutomationRule>>(`/automation/${id}`, body).then((r) => r.data),

  remove: (id: string) => api.delete<void>(`/automation/${id}`),

  settings: () => api.get<Res<AutomationSettings>>("/automation/settings").then((r) => r.data),

  setEnabled: (autoReplyEnabled: boolean) =>
    api.patch<Res<AutomationSettings>>("/automation/settings", { autoReplyEnabled }).then((r) => r.data),

  // Relève immédiatement les nouveaux commentaires / messages
  sync: () => api.post<Res<SyncResult>>("/automation/sync").then((r) => r.data),

  // Simule un message entrant (rien n'est envoyé)
  test: (body: { text: string; kind: "COMMENT" | "DIRECT"; accountId?: string }) =>
    api.post<Res<TestResult>>("/automation/test", body).then((r) => r.data),
};
