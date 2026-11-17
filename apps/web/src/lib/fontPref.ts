// Police du texte : réglage propre à l'appareil (comme « karama:theme » sur Karama-Ko), conservé dans le navigateur et
// posé sur <html data-font> (index.html le fait avant le premier affichage, ce module le fait au changement).
export type FontPref = "inter" | "satoshi" | "system";

const KEY = "replika:font";

export const FONT_OPTIONS: Array<{ value: FontPref; label: string; description: string; sample: string; body: string }> = [
  { value: "inter", label: "Inter", description: "La police par défaut de SuiteFlow.", sample: "Inter", body: "Inter" },
  { value: "satoshi", label: "Satoshi & Cabinet Grotesk", description: "Style Karama-Ko : titres expressifs, texte net.", sample: '"Cabinet Grotesk", Satoshi', body: "Satoshi" },
  { value: "system", label: "Police du système", description: "Celle de votre appareil, la plus rapide à charger.", sample: "system-ui", body: "system-ui" },
];

export function readFont(): FontPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "satoshi" || v === "system" ? v : "inter";
  } catch {
    return "inter";
  }
}

export function applyFont(font: FontPref) {
  if (font === "inter") document.documentElement.removeAttribute("data-font");
  else document.documentElement.setAttribute("data-font", font);
  try {
    if (font === "inter") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, font);
  } catch {
    // Stockage indisponible (navigation privée…) : la police change pour cette session seulement
  }
}
