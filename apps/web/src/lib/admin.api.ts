import { api } from "./api";
import type { PlanId } from "@/data/plans";
import type { PaymentStatus } from "./billing.api";

export type AdminStatus = "TRIAL" | "ACTIVE" | "EXPIRED";
export interface DayPoint { date: string; value: number }

export interface AdminOverview {
  days: number;
  users: { total: number; new: number; active7d: number; moderation: { suspended: number; banned: number; deleted: number }; signups: DayPoint[] };
  finance: {
    gross: number;
    fees: number;
    feesEstimated: number; // paiements dont la commission est estimée (non transmise par Papi)
    feeRates: FeeRates;
    net: number;
    aiReplies: number;
    aiCost: number;
    expenses: number;
    expensesByCategory: Array<{ category: string; amount: number }>;
    profit: number;
    margin: number;
  };
  subscriptions: { byStatus: Record<AdminStatus, number>; byPlan: Record<string, number>; paying: number; everPaid: number; conversion: number; mrr: number };
  revenue: {
    total: number;
    totalCount: number;
    period: number;
    periodCount: number;
    daily: DayPoint[];
    byKind: Array<{ kind: "SUBSCRIPTION" | "LIVE_HOURS"; amount: number; count: number }>;
    byPlan: Array<{ plan: PlanId; name: string; amount: number; count: number }>;
    byMethod: Array<{ method: string; amount: number; count: number }>;
    pending: { amount: number; count: number };
    failed: number;
  };
  usage: {
    month: string;
    aiReplies: number;
    liveSeconds: number;
    liveCreditUsed: number;
    liveCreditLeft: number;
    liveActive: number;
    pages: { active: number; total: number };
    instagram: { active: number; total: number };
    rulesActive: number;
    messages: number;
    replied: number;
    aiGenerated: number;
  };
  ai: {
    configured: boolean;
    provider: string;
    model: string;
    repliesThisMonth: number;
    costPerReply: number;
    estimatedCost: number;
    failures24h: number;
    quotaHits: number;
    accountsEnabled: number;
    languages: Array<{ language: string; count: number }>;
    top: Array<{ userId: string; name: string; email: string; aiReplies: number; liveSeconds: number }>;
  };
  system: {
    papi: { configured: boolean; testMode: boolean; notifications: boolean };
    liveHourPrice: number;
    mail: { configured: boolean; host: string | null; from: string; user: string | null };
    pollSeconds: number;
    webhookConfigured: boolean;
    publicApiUrl: string;
  };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  paymentPhone: string | null;
  account: AccountState;
  suspendedUntil: string | null;
  moderationReason: string | null;
  moderatedAt: string | null;
  twoFactorMethod: "EMAIL" | "TOTP" | null;
  role: string;
  createdAt: string;
  plan: PlanId;
  planName: string;
  kind: "TRIAL" | "PAID" | "MANUAL" | null;
  status: AdminStatus;
  periodEnd: string | null;
  pages: number;
  pagesLimit: number | null;
  aiReplies: number;
  aiLimit: number | null;
  liveSeconds: number;
  liveCreditSeconds: number;
  totalPaid: number;
  lastActivity: string | null;
}

export interface AdminPayment {
  reference: string;
  kind: "SUBSCRIPTION" | "LIVE_HOURS";
  planName: string | null;
  period: "MONTHLY" | "ANNUAL" | null;
  liveHours: number | null;
  amount: number;
  fee: number | null; // commission Papi (payés)
  feeEstimated: boolean;
  net: number | null;
  status: PaymentStatus;
  paymentMethod: string | null;
  payerPhone: string | null;
  failureMessage: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string; email: string };
}

export type AccountState = "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
export type AccountFilter = "current" | "active" | "suspended" | "banned" | "deleted" | "all";
export type ModerationAction = "suspend" | "unsuspend" | "ban" | "unban" | "delete" | "restore" | "logout" | "reset2fa";

export type FeeMethod = "MVOLA" | "ORANGE_MONEY" | "AIRTEL_MONEY" | "BRED";
export type FeeRates = Record<FeeMethod, number>;
export interface FeeSettings {
  rates: FeeRates;
  custom: boolean; // taux modifiés par l'administrateur (sinon tarifs publics Papi)
  updatedAt: string | null;
  presets: { transit: FeeRates; direct: FeeRates };
}

export type ExpenseCategory = "HOSTING" | "AI" | "MARKETING" | "SALARY" | "SOFTWARE" | "OTHER";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  recurring: boolean;
  note: string | null;
  inPeriod: number; // montant compté sur la période choisie
  occurrences: number;
}

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  HOSTING: "Hébergement et serveurs",
  AI: "Fournisseur IA",
  MARKETING: "Marketing et publicité",
  SALARY: "Salaires et prestataires",
  SOFTWARE: "Logiciels et outils",
  OTHER: "Autres",
};

export interface Paged { total: number; page: number; pageSize: number }

type Res<T> = { status: string; data: T };
const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const adminApi = {
  overview: (days: number) => api.get<Res<AdminOverview>>(`/admin/overview?days=${days}`).then((r) => r.data),
  users: (q: { search?: string; plan?: string; status?: string; account?: AccountFilter; page?: number; pageSize?: number }) =>
    api.get<Res<Paged & { users: AdminUser[] }>>(`/admin/users?${qs(q)}`).then((r) => r.data),
  payments: (q: { status?: string; page?: number; pageSize?: number }) =>
    api.get<Res<Paged & { payments: AdminPayment[] }>>(`/admin/payments?${qs(q)}`).then((r) => r.data),
  expenses: (days: number) => api.get<Res<{ expenses: Expense[]; total: number }>>(`/admin/expenses?days=${days}`).then((r) => r.data),
  addExpense: (body: { date: string; category: ExpenseCategory; label: string; amount: number; recurring: boolean; note?: string }) =>
    api.post<Res<Expense>>("/admin/expenses", body).then((r) => r.data),
  removeExpense: (id: string) => api.delete<void>(`/admin/expenses/${id}`),
  moderate: (userId: string, body: { action: ModerationAction; reason?: string; until?: string | null }) =>
    api.post<Res<{ ok: true }>>(`/admin/users/${userId}/moderation`, body).then((r) => r.data),
  mailTest: () => api.post<Res<{ to: string; delivered: boolean; error: string | null }>>("/admin/settings/mail-test").then((r) => r.data),
  feeSettings: () => api.get<Res<FeeSettings>>("/admin/settings/fees").then((r) => r.data),
  saveFeeRates: (rates: FeeRates | null) => api.put<Res<FeeSettings>>("/admin/settings/fees", { rates }).then((r) => r.data),
  addLiveHours: (userId: string, hours: number) =>
    api.post<Res<{ liveCreditSeconds: number }>>(`/admin/users/${userId}/live-hours`, { hours }).then((r) => r.data),
  // Formule posée à la main (Agence, prolongation, geste commercial)
  setSubscription: (body: { email: string; plan: PlanId; periodEnd: string | null; note?: string }) =>
    api.put<Res<unknown>>("/billing/admin/subscription", body).then((r) => r.data),
};
