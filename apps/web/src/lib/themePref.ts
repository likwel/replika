import { useEffect, useState } from "react";

// Thème d'affichage : « auto » (défaut) suit l'appareil — clair ou sombre selon ses réglages, et change en direct
// quand il bascule (coucher du soleil, réglage du système). « light » / « dark » forcent l'un des deux.
// Réglage de cet appareil (localStorage) : index.html le lit avant le premier rendu pour éviter tout flash.
export type ThemePref = "auto" | "light" | "dark";

const KEY = "replika:theme";
const EVENT = "suiteflow:theme";
export const THEME_LABELS: Record<ThemePref, string> = { auto: "Automatique", light: "Clair", dark: "Sombre" };

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

const systemDark = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
export const resolveTheme = (pref: ThemePref): "light" | "dark" => (pref === "auto" ? (systemDark() ? "dark" : "light") : pref);

export function applyTheme(pref: ThemePref) {
  document.documentElement.setAttribute("data-theme", resolveTheme(pref));
  document.documentElement.setAttribute("data-theme-pref", pref);
}

export function saveThemePref(pref: ThemePref) {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour cette session seulement
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
}

// Préférence courante + thème réellement affiché ; reste synchronisé avec l'appareil en mode auto
export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(readThemePref()));

  useEffect(() => {
    const sync = () => {
      const p = readThemePref();
      setPref(p);
      setResolved(resolveTheme(p));
    };
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readThemePref() !== "auto") return;
      applyTheme("auto");
      sync();
    };
    mq?.addEventListener("change", onSystem);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // autre onglet
    return () => {
      mq?.removeEventListener("change", onSystem);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { pref, dark: resolved === "dark" };
}
