import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const PAGES = ["gestion", "automatisation", "statistiques"];

// /app → page d'ouverture choisie dans Paramètres → Préférences
export function DefaultPageRedirect() {
  const { user } = useAuth();
  const page = user?.defaultPage && PAGES.includes(user.defaultPage) ? user.defaultPage : "gestion";
  return <Navigate to={`/app/${page}`} replace />;
}
