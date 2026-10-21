import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type TwoFactorChallenge, type User } from "@/lib/auth.api";
import { useThemeAttrs } from "@/hooks/useThemeAttrs";

interface AuthState {
  user: User | null;
  loading: boolean;
  // Renvoie l'étape de validation en deux étapes si un code est demandé (pas encore de session)
  login: (email: string, password: string, remember?: boolean, turnstileToken?: string | null) => Promise<{ twoFactor?: TwoFactorChallenge }>;
  completeTwoFactor: (challengeId: string, code: string) => Promise<{ usedRecovery: boolean; recoveryLeft: number }>;
  register: (name: string, email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  // Met à jour l'utilisateur affiché (en-tête, préférences) après une modification dans les paramètres
  updateUser: (patch: Partial<User>) => void;
  // Relit l'utilisateur depuis l'API (formule après un paiement…)
  refreshUser: () => Promise<void>;
  // Session fermée côté serveur (compte supprimé…) : on oublie l'utilisateur localement
  clearUser: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useThemeAttrs(user);

  // Au montage : tente de récupérer la session via le cookie
  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, remember = true, turnstileToken?: string | null) => {
    const res = await authApi.login({ email, password, remember, turnstileToken });
    if (res.data.twoFactor) return { twoFactor: res.data.twoFactor };
    setUser(res.data.user!);
    return {};
  };

  const completeTwoFactor = async (challengeId: string, code: string) => {
    const r = await authApi.verifyTwoFactor(challengeId, code);
    setUser(r.user);
    return { usedRecovery: r.usedRecovery, recoveryLeft: r.recoveryLeft };
  };

  const register = async (name: string, email: string, password: string, turnstileToken?: string | null) => {
    const res = await authApi.register({ name, email, password, turnstileToken });
    setUser(res.data.user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateUser = (patch: Partial<User>) => setUser((u) => (u ? { ...u, ...patch } : u));
  const clearUser = () => setUser(null);
  const refreshUser = async () => {
    const res = await authApi.me();
    setUser(res.data.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, completeTwoFactor, register, logout, updateUser, refreshUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}