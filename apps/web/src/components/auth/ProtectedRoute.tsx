import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/theme";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: theme.bg }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: theme.gold, borderTopColor: "transparent" }} />
      </div>
    );
  }

  // La page demandée est mémorisée : après connexion, on y revient au lieu de la page d'ouverture
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
}