import { api } from "./api";

export interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK";
  externalId: string;
  name: string;
  avatarUrl: string | null;   // ← NEW
  isActive: boolean;
  syncError: string | null; // dernière erreur de relève (permission manquante…)
  createdAt: string;
}

export type CheckStatus = "ok" | "missing" | "not_authorized" | "expired" | "error";

export interface AccountCheck {
  status: CheckStatus;
  message: string;
  features: Array<{ label: string; ok: boolean }>;
  checkedAt: string;
}

export const accountApi = {
  list: () =>
    api.get<{ status: string; data: SocialAccount[] }>("/accounts").then((r) => r.data),

  toggle: (id: string, isActive: boolean) =>
    api.patch<{ status: string; data: SocialAccount }>(`/accounts/${id}/toggle`, { isActive }),

  remove: (id: string) => api.delete<void>(`/accounts/${id}`),

  // Jeton, accès à la Page et autorisations de chaque fonction
  check: (id: string) => api.get<{ status: string; data: AccountCheck }>(`/accounts/${id}/check`).then((r) => r.data),
};