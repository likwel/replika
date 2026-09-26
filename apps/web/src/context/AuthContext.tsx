import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type User } from "@/lib/auth.api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Met à jour l'utilisateur affiché (en-tête, préférences) après une modification dans les paramètres
  updateUser: (patch: Partial<User>) => void;
  // Session fermée côté serveur (compte supprimé…) : on oublie l'utilisateur localement
  clearUser: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Au montage : tente de récupérer la session via le cookie
  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setUser(res.data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register({ name, email, password });
    setUser(res.data.user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateUser = (patch: Partial<User>) => setUser((u) => (u ? { ...u, ...patch } : u));
  const clearUser = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, clearUser }}>
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