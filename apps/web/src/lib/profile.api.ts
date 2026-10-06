import { api } from "./api";

// Pages d'ouverture acceptées : doit rester aligné sur DEFAULT_PAGES du serveur
// (apps/api/src/modules/profile/profile.schema.ts), qui rejette toute autre valeur.
export const DEFAULT_PAGES = ["gestion", "automatisation", "statistiques"] as const;
export type DefaultPage = (typeof DEFAULT_PAGES)[number];
export const resolveDefaultPage = (page: string | null | undefined): DefaultPage =>
  DEFAULT_PAGES.includes(page as DefaultPage) ? (page as DefaultPage) : "gestion";

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  autoReplyEnabled: boolean;
  defaultPage: DefaultPage;
  desktopNotifications: boolean;
}

export interface SecurityEvent {
  id: string;
  action: "REGISTER" | "LOGIN" | "PASSWORD_CHANGED" | "PASSWORD_RESET" | "EMAIL_CHANGED" | "LOGOUT_ALL";
  meta: { ip?: string | null; ua?: string | null; from?: string; to?: string } | null;
  createdAt: string;
}

type Res<T> = { status: string; data: T };
type Msg = { status: string; message: string };

export const profileApi = {
  get: () => api.get<Res<Profile>>("/profile").then((r) => r.data),

  update: (body: Partial<Pick<Profile, "name" | "phone" | "companyName" | "address" | "avatarUrl">>) =>
    api.patch<Res<Profile>>("/profile", body).then((r) => r.data),

  changeEmail: (email: string, currentPassword: string) =>
    api.patch<Res<Profile>>("/profile/email", { email, currentPassword }).then((r) => r.data),

  // La session courante reçoit un nouveau cookie ; les autres appareils sont déconnectés
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<Msg>("/profile/password", { currentPassword, newPassword }),

  logoutOthers: () => api.post<Msg>("/profile/logout-others"),

  updatePreferences: (body: Partial<Pick<Profile, "autoReplyEnabled" | "defaultPage" | "desktopNotifications">>) =>
    api.patch<Res<Profile>>("/profile/preferences", body).then((r) => r.data),

  activity: () => api.get<Res<SecurityEvent[]>>("/profile/activity").then((r) => r.data),

  remove: (password: string, confirm: string) => api.delete<void>("/profile", { password, confirm }),
};
