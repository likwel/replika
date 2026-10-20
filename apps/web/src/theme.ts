// Les valeurs pointent vers les variables CSS définies dans index.css (neutres par
// data-theme, accent par data-accent). Changer ces attributs sur <html> change tout
// l'affichage en direct — y compris dans les fichiers qui construisent des maps
// de couleurs au chargement du module (planner.ts, history.ts, leads.ts, live.ts,
// marketplace.api.ts) — sans toucher à aucun des fichiers qui importent `theme`.
export const theme = {
  gold: "var(--color-gold)",
  goldDark: "var(--color-goldDark)",
  goldLight: "var(--color-goldLight)",
  goldSoft: "var(--color-goldSoft)",
  onAccent: "var(--color-onAccent)", // texte posé sur la couleur d'accent
  red: "var(--color-red)",
  redLight: "var(--color-redLight)",
  dangerBg: "var(--color-dangerBg)",
  // Statuts : le vert signale « en ligne / actif / inclus », le jaune « à surveiller »
  green: "var(--color-green)",
  greenLight: "var(--color-greenLight)",
  greenSoft: "var(--color-greenSoft)",
  amber: "var(--color-amber)",
  amberSoft: "var(--color-amberSoft)",
  canvas: "var(--color-canvas)", // fond de la zone de contenu
  bg: "var(--color-bg)", // surfaces en retrait : champs, lignes dans une carte
  bgCard: "var(--color-bgCard)",
  sidebar: "var(--color-sidebar)",
  hover: "var(--color-hover)",
  active: "var(--color-active)",
  bgDark: "var(--color-bgDark)",
  bgDark2: "var(--color-bgDark2)",
  text: "var(--color-text)",
  textMuted: "var(--color-textMuted)",
  border: "var(--color-border)",
} as const;
