import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/theme";

// Inverse de ProtectedRoute : une fois connecté, inutile de revoir la landing page ou le formulaire.
export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: theme.bg }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: theme.gold, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return user ? <Navigate to="/app" replace /> : <Outlet />;
}
