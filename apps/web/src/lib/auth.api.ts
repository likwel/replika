import { api, BASE_URL } from "./api";
import type { SubscriptionSummary } from "./billing.api";

export type SocialProvider = "facebook" | "google";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  defaultPage: string; // page ouverte après connexion
  desktopNotifications: boolean;
  darkMode: boolean;
  accentTheme: string; // "whatsapp" | "classic"
  subscription: SubscriptionSummary; // formule, échéance, limites
}

interface AuthResponse {
  status: string;
  data: { user: User; token: string };
}

interface MeResponse {
  status: string;
  data: { user: User };
}

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", body),

  login: (body: { email: string; password: string; remember?: boolean }) =>
    api.post<AuthResponse>("/auth/login", body),

  // Fournisseurs configurés côté serveur (seuls ceux-là sont proposés)
  providers: () => api.get<{ status: string; data: Record<SocialProvider, boolean> }>("/auth/providers").then((r) => r.data),

  // Navigation complète (pas d'appel AJAX) : la fenêtre du fournisseur doit s'ouvrir dans le navigateur
  socialLoginUrl: (provider: SocialProvider) => `${BASE_URL}/auth/${provider}`,

  logout: () => api.post<{ status: string }>("/auth/logout"),

  forgotPassword: (email: string) =>
    api.post<{ status: string; message: string }>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    api.post<{ status: string; message: string }>("/auth/reset-password", { token, password }),

  me: () => api.get<MeResponse>("/auth/me"),
};