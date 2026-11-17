import { useAuth } from "@/context/AuthContext";
import { profileApi } from "@/lib/profile.api";
import { saveThemePref, useThemePref, type ThemePref } from "@/lib/themePref";

// Cycle automatique → clair → sombre depuis la barre latérale ou la feuille « Plus » : l'affichage change aussitôt.
// Un choix clair/sombre explicite est aussi enregistré sur le compte (information), « automatique » ne l'est pas :
// il dépend de chaque appareil.
const NEXT: Record<ThemePref, ThemePref> = { auto: "light", light: "dark", dark: "auto" };

export function useThemeToggle() {
  const { updateUser } = useAuth();
  const { pref, dark } = useThemePref();
  const choose = (next: ThemePref) => {
    saveThemePref(next);
    if (next !== "auto") {
      updateUser({ darkMode: next === "dark" });
      void profileApi.updatePreferences({ darkMode: next === "dark" }).catch(() => undefined);
    }
  };
  return { pref, dark, choose, toggle: () => choose(NEXT[pref]) };
}
