import type { Permissions } from "./team.api";
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
  twoFactorMethod: TwoFactorMethod | null; // validation en deux étapes (null : désactivée)
  workspace?: WorkspaceInfo;
}

// Espace de travail : le sien, ou celui d'une équipe rejointe (current), avec les droits du membre
export interface WorkspaceInfo {
  current: { ownerId: string; space: string; role: string; roleLabel: string; permissions: Permissions } | null;
  unavailable: string | null; // espace ouvert devenu inaccessible (accès retiré, formule sans équipe…)
  spaces: Array<{ ownerId: string; space: string; roleLabel: string }>;
  invitations: number; // invitations en attente
}

export type TwoFactorMethod = "EMAIL" | "TOTP";

// Seconde étape de connexion en attente du code
export interface TwoFactorChallenge {
  challengeId: string;
  method: TwoFactorMethod;
  emailHint: string | null;
  expiresAt: string;
  delivery?: "email" | "console" | null; // console : pas de serveur d'e-mail, code affiché dans le terminal de l'API
}

export interface TwoFactorStatus {
  method: TwoFactorMethod | null;
  enabledAt: string | null;
  recoveryLeft: number;
  emailAvailable: boolean;
  mailConfigured: boolean;
}

interface AuthResponse {
  status: string;
  data: { user: User; token: string };
}

// Connexion : session ouverte, ou code de validation en deux étapes demandé
interface LoginResponse {
  status: string;
  data: { user?: User; token?: string; twoFactor?: TwoFactorChallenge };
}

type Res<T> = { status: string; data: T };

interface MeResponse {
  status: string;
  data: { user: User };
}

export const authApi = {
  register: (body: { name: string; email: string; password: string; turnstileToken?: string | null }) =>
    api.post<AuthResponse>("/auth/register", body),

  login: (body: { email: string; password: string; remember?: boolean; turnstileToken?: string | null }) =>
    api.post<LoginResponse>("/auth/login", body),

  verifyTwoFactor: (challengeId: string, code: string) =>
    api.post<Res<{ user: User; token: string; usedRecovery: boolean; recoveryLeft: number }>>("/auth/2fa/verify", { challengeId, code }).then((r) => r.data),
  resendTwoFactor: (challengeId: string) =>
    api.post<Res<{ twoFactor: TwoFactorChallenge }>>("/auth/2fa/resend", { challengeId }).then((r) => r.data.twoFactor),

  // Réglages publics : clé du widget Cloudflare Turnstile (null : désactivé)
  config: () => api.get<Res<{ turnstileSiteKey: string | null }>>("/auth/config").then((r) => r.data),

  // Validation en deux étapes (utilisateur connecté)
  twoFactor: {
    status: () => api.get<Res<TwoFactorStatus>>("/auth/2fa").then((r) => r.data),
    emailStart: () => api.post<Res<TwoFactorChallenge>>("/auth/2fa/email/start").then((r) => r.data),
    emailConfirm: (challengeId: string, code: string) =>
      api.post<Res<{ method: TwoFactorMethod; recoveryCodes: string[] }>>("/auth/2fa/email/confirm", { challengeId, code }).then((r) => r.data),
    totpStart: () => api.post<Res<{ secret: string; otpauthUrl: string; qrDataUrl: string }>>("/auth/2fa/totp/start").then((r) => r.data),
    totpConfirm: (code: string) =>
      api.post<Res<{ method: TwoFactorMethod; recoveryCodes: string[] }>>("/auth/2fa/totp/confirm", { code }).then((r) => r.data),
    disableStart: () => api.post<Res<TwoFactorChallenge | null>>("/auth/2fa/disable/start").then((r) => r.data),
    disable: (code: string, challengeId?: string) => api.post<Res<{ method: null }>>("/auth/2fa/disable", { code, challengeId }).then((r) => r.data),
  },

  // Fournisseurs configurés côté serveur (seuls ceux-là sont proposés)
  providers: () => api.get<{ status: string; data: Record<SocialProvider, boolean> }>("/auth/providers").then((r) => r.data),

  // Navigation complète (pas d'appel AJAX) : la fenêtre du fournisseur doit s'ouvrir dans le navigateur
  socialLoginUrl: (provider: SocialProvider) => `${BASE_URL}/auth/${provider}`,

  logout: () => api.post<{ status: string }>("/auth/logout"),

  forgotPassword: (email: string, turnstileToken?: string | null) =>
    api.post<{ status: string; message: string }>("/auth/forgot-password", { email, turnstileToken }),

  resetPassword: (token: string, password: string) =>
    api.post<{ status: string; message: string }>("/auth/reset-password", { token, password }),

  me: () => api.get<MeResponse>("/auth/me"),
};