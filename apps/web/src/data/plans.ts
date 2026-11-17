// Formules affichées sur la page d'accueil (sans appel à l'API).
// Source de vérité des prix et limites : apps/api/src/modules/billing/plans.ts — la concordance est
// vérifiée par apps/api/src/modules/billing/billing.logic.test.ts. L'écran Facturation lit les prix de l'API.

export type PlanId = "STARTER" | "PRO" | "BUSINESS" | "AGENCY";

// L'IA et les lives sont au cœur du produit : toutes les formules les incluent, avec des volumes qui
// augmentent d'une formule à l'autre (Pages, réponses IA, heures de live), puis des fonctionnalités en plus.
// Coût IA estimé : ~1 Ar par réponse (gpt-oss-20b), ~7 Ar au pire (GPT-5 mini) : les volumes gardent la marge.
// Une heure de live coûte surtout des lectures Meta (gratuites) ; l'IA n'y lit que les coordonnées des clients.
// Une ligne finissant par « : » est un intertitre (« Tout Starter, plus : »), affiché sans coche.
export const PLAN_DEFS = [
  {
    id: "STARTER",
    name: "Starter",
    base: 49000, // prix promotionnel, facturé
    list: 59000, // prix public habituel, affiché barré
    tagline: "Pour un vendeur qui démarre",
    quota: { pages: 2, aiReplies: 1000, liveHours: 30 },
    limits: { pages: "2 Pages + leurs comptes Instagram", ai: "1 000 réponses IA / mois", live: "30 h de live / mois (≈ 1 h par jour)" },
    feats: [
      "Assistant IA sur les commentaires et messages",
      "Règles de réponse illimitées (mots-clés ou IA)",
      "Pipelines : déclencheur, conditions, actions",
      "File « À traiter » : validation avant envoi",
      "Lives : commandes JP, coordonnées lues par l'IA, factures",
      "Planification des publications",
      "Statistiques de base et journal d'activité",
    ],
    hl: false,
  },
  {
    id: "PRO",
    name: "Pro",
    base: 99000,
    list: 129000,
    tagline: "Le plus choisi par les vendeurs actifs",
    quota: { pages: 5, aiReplies: 5000, liveHours: 90 },
    limits: { pages: "5 Pages + leurs comptes Instagram", ai: "5 000 réponses IA / mois", live: "90 h de live / mois (≈ 3 h par jour)" },
    feats: [
      "Tout Starter, plus :",
      "Règles IA ciblées par publication",
      "Leads : détection, suivi par statut et export",
      "Marketplace : catalogue Facebook synchronisé et commandes",
      "Statistiques avancées et rapports",
    ],
    hl: true,
  },
  {
    id: "BUSINESS",
    name: "Business",
    base: 199000,
    list: 249000,
    tagline: "Pour les boutiques à fort volume",
    quota: { pages: 15, aiReplies: 15000, liveHours: 300 },
    limits: { pages: "15 Pages + leurs comptes Instagram", ai: "15 000 réponses IA / mois", live: "300 h de live / mois (≈ 10 h par jour)" },
    feats: [
      "Tout Pro, plus :",
      "Mise en place accompagnée : règles et assistant IA configurés avec vous",
      "Support prioritaire",
      "Équipe : 5 membres invités, droits par module (lecture ou écriture)",
    ],
    hl: false,
  },
  {
    id: "AGENCY",
    name: "Agence",
    base: null,
    list: null,
    tagline: "Pour les agences qui gèrent plusieurs marques",
    quota: { pages: null, aiReplies: null, liveHours: null },
    limits: { pages: "Pages illimitées", ai: "Volume IA sur mesure", live: "Lives illimités" },
    feats: ["Tout Business, plus :", "Membres d'équipe illimités", "Un espace de travail par marque, avec accès par équipe", "Tarif dégressif par marque gérée", "Accompagnement dédié"],
    hl: false,
  },
] as const;

export type PlanDef = (typeof PLAN_DEFS)[number];

// Tableau « Comparer les formules » : une ligne par critère, une valeur par formule (même ordre que PLAN_DEFS).
// `feature` / `team` relient la ligne à l'API : billing.logic.test.ts vérifie qu'elles concordent avec plans.ts côté API.
// Les lignes de volumes sont calculées depuis `quota` : rien à tenir à jour deux fois.
export type Cell = boolean | string;
export interface CompareRow {
  group: string;
  label: string;
  values: readonly [Cell, Cell, Cell, Cell];
  feature?: "postAiRules" | "leads" | "marketplace" | "advancedStats";
  team?: true;
}

const fmtN = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");
const volume = (key: "pages" | "aiReplies" | "liveHours", unit = "", unlimited = "Illimité"): CompareRow["values"] =>
  PLAN_DEFS.map((p) => (p.quota[key] === null ? unlimited : `${fmtN(p.quota[key] as number)}${unit}`)) as unknown as CompareRow["values"];

export const COMPARE_ROWS: CompareRow[] = [
  { group: "Volumes inclus", label: "Pages Facebook (+ comptes Instagram liés)", values: volume("pages") },
  { group: "Volumes inclus", label: "Réponses IA par mois", values: volume("aiReplies", "", "Sur mesure") },
  { group: "Volumes inclus", label: "Heures de live par mois", values: volume("liveHours", " h") },
  { group: "Volumes inclus", label: "Réponses par mots-clés", values: ["Illimitées", "Illimitées", "Illimitées", "Illimitées"] },
  { group: "Automatisation", label: "Assistant IA et règles de réponse", values: [true, true, true, true] },
  { group: "Automatisation", label: "Pipelines (déclencheur, conditions, actions)", values: [true, true, true, true] },
  { group: "Automatisation", label: "File « À traiter » et validation manuelle", values: [true, true, true, true] },
  { group: "Automatisation", label: "Règles IA ciblées par publication", values: [false, true, true, true], feature: "postAiRules" },
  { group: "Ventes", label: "Lives : commandes JP et factures", values: [true, true, true, true] },
  { group: "Ventes", label: "Leads : détection, suivi, export", values: [false, true, true, true], feature: "leads" },
  { group: "Ventes", label: "Marketplace : catalogue et commandes", values: [false, true, true, true], feature: "marketplace" },
  { group: "Pilotage", label: "Planification des publications", values: [true, true, true, true] },
  { group: "Pilotage", label: "Statistiques de base et journal d'activité", values: [true, true, true, true] },
  { group: "Pilotage", label: "Statistiques avancées et rapports", values: [false, true, true, true], feature: "advancedStats" },
  { group: "Équipe et accompagnement", label: "Membres d'équipe avec droits par module", values: ["—", "—", "5", "Illimités"], team: true },
  { group: "Équipe et accompagnement", label: "Mise en place accompagnée", values: [false, false, true, true] },
  { group: "Équipe et accompagnement", label: "Support prioritaire", values: [false, false, true, true] },
];

export const planDef = (id: PlanId): PlanDef => PLAN_DEFS.find((p) => p.id === id) ?? PLAN_DEFS[1];

// Au-delà du volume inclus
export const AI_PACK = { replies: 1000, price: 9900 };

export const ANNUAL_DISCOUNT = 0.15;

// Prix mensuel en formule annuelle : -15 %, arrondi au millier
export function annualMonthly(base: number): number {
  return Math.round((base * (1 - ANNUAL_DISCOUNT)) / 1000) * 1000;
}

export const CONTACT_EMAIL = "contact@suiteflow.mg";
export const AGENCY_CONTACT_URL = `mailto:${CONTACT_EMAIL}?subject=SuiteFlow%20Agence`;

export const MOBILE_MONEY = "MVola · Orange Money · Airtel Money · carte bancaire";
