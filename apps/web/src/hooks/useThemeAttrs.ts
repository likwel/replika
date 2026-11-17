import { useEffect } from "react";
import type { User } from "@/lib/auth.api";
import { applyTheme, readThemePref, saveThemePref } from "@/lib/themePref";

// Synchronise data-theme/data-accent sur <html>.
// - Thème : réglage de l'appareil (lib/themePref.ts), « automatique » par défaut. Un compte qui avait choisi le mode
//   sombre avant l'existence du mode automatique (darkMode côté serveur) le garde, une seule fois, sur un appareil
//   qui n'a encore aucun réglage.
// - Accent : préférence du compte, recopiée dans localStorage pour que le script d'index.html la pose avant le
//   premier rendu (évite le flash).
const MIGRATED = "replika:themeMigrated";

export function useThemeAttrs(user: User | null) {
  // Le thème suit l'appareil en mode automatique, y compris sur les pages publiques
  useEffect(() => {
    applyTheme(readThemePref());
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      if (!localStorage.getItem(MIGRATED)) {
        localStorage.setItem(MIGRATED, "1");
        if (user.darkMode && readThemePref() === "auto" && !localStorage.getItem("replika:theme")) saveThemePref("dark");
      }
    } catch {
      // Stockage indisponible : on reste en automatique
    }
  }, [user?.darkMode]);

  useEffect(() => {
    if (!user) return;
    const accent = user.accentTheme === "classic" ? "classic" : "whatsapp";
    document.documentElement.setAttribute("data-accent", accent);
    try {
      localStorage.setItem("replika:accentTheme", accent);
    } catch {
      // Stockage indisponible (navigation privée…) : l'accent reste correct pour cette session.
    }
  }, [user?.accentTheme]);
}
