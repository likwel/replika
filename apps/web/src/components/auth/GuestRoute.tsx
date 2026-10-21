import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/theme";

// Inverse de ProtectedRoute : une fois connecté, inutile de revoir la landing page ou le formulaire.
export function GuestRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: theme.bg }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: theme.gold, borderTopColor: "transparent" }} />
      </div>
    );
  }

  // Connecté depuis une invitation d'équipe : retour sur l'invitation pour la rejoindre
  const invitation = new URLSearchParams(location.search).get("invitation");
  return user ? <Navigate to={invitation ? `/invitation/${invitation}` : "/app"} replace /> : <Outlet />;
}
