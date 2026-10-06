import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { resolveDefaultPage } from "@/lib/profile.api";

// /app → page d'ouverture choisie dans Paramètres → Préférences
export function DefaultPageRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/app/${resolveDefaultPage(user?.defaultPage)}`} replace />;
}
