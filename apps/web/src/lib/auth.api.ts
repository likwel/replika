import { api } from "./api";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  defaultPage: string; // page ouverte après connexion
  desktopNotifications: boolean;
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

  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", body),

  logout: () => api.post<{ status: string }>("/auth/logout"),

  forgotPassword: (email: string) =>
    api.post<{ status: string; message: string }>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    api.post<{ status: string; message: string }>("/auth/reset-password", { token, password }),

  me: () => api.get<MeResponse>("/auth/me"),
};