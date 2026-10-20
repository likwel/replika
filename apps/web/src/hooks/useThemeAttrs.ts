import { useEffect } from "react";
import type { User } from "@/lib/auth.api";

// Synchronise data-theme/data-accent sur <html> avec les préférences de l'utilisateur,
// et les recopie dans localStorage pour que le script inline d'index.html puisse les
// poser avant le premier rendu au prochain chargement (évite le flash).
export function useThemeAttrs(user: User | null) {
  useEffect(() => {
    if (!user) return;
    const theme = user.darkMode ? "dark" : "light";
    const accent = user.accentTheme === "classic" ? "classic" : "whatsapp";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-accent", accent);
    try {
      localStorage.setItem("replika:darkMode", user.darkMode ? "1" : "0");
      localStorage.setItem("replika:accentTheme", accent);
    } catch {
      // Stockage indisponible (navigation privée…) : le thème reste correct pour cette session.
    }
  }, [user?.darkMode, user?.accentTheme]);
}
