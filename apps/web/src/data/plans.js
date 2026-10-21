// Formules affichées sur la page d'accueil (sans appel à l'API).
// Source de vérité des prix et limites : apps/api/src/modules/billing/plans.ts — la concordance est
// vérifiée par apps/api/src/modules/billing/billing.logic.test.ts. L'écran Facturation lit les prix de l'API.
// L'IA et les lives sont au cœur du produit : toutes les formules les incluent, avec des volumes qui
// augmentent d'une formule à l'autre (Pages, réponses IA, heures de live), puis des fonctionnalités en plus.
// Coût IA estimé : ~1 Ar par réponse (gpt-oss-20b), ~7 Ar au pire (GPT-5 mini) : les volumes gardent la marge.
// Une heure de live coûte surtout des lectures Meta (gratuites) ; l'IA n'y lit que les coordonnées des clients.
// Une ligne finissant par « : » est un intertitre (« Tout Starter, plus : »), affiché sans coche.
export const PLAN_DEFS = [
    {
        id: "STARTER",
        name: "Starter",
        base: 49000,
        tagline: "Pour un vendeur qui démarre",
        quota: { pages: 2, aiReplies: 1000, liveHours: 30 },
        limits: { pages: "2 Pages + leurs comptes Instagram", ai: "1 000 réponses IA / mois", live: "30 h de live / mois (≈ 1 h par jour)" },
        feats: [
            "Assistant IA sur les commentaires et messages",
            "Lives : commandes JP, coordonnées lues par l'IA, factures",
            "Règles par mots-clés illimitées",
            "File « À traiter » et validation manuelle",
            "Planification des publications",
            "Statistiques de base",
        ],
        hl: false,
    },
    {
        id: "PRO",
        name: "Pro",
        base: 129000,
        tagline: "Le plus choisi par les vendeurs actifs",
        quota: { pages: 5, aiReplies: 5000, liveHours: 90 },
        limits: { pages: "5 Pages + leurs comptes Instagram", ai: "5 000 réponses IA / mois", live: "90 h de live / mois (≈ 3 h par jour)" },
        feats: [
            "Tout Starter, plus :",
            "Règles IA ciblées par publication",
            "Leads : détection, pipeline et export",
            "Marketplace : catalogue Facebook synchronisé et commandes",
            "Statistiques avancées, rapports et historique",
        ],
        hl: true,
    },
    {
        id: "BUSINESS",
        name: "Business",
        base: 249000,
        tagline: "Pour les boutiques à fort volume",
        quota: { pages: 15, aiReplies: 15000, liveHours: 300 },
        limits: { pages: "15 Pages + leurs comptes Instagram", ai: "15 000 réponses IA / mois", live: "300 h de live / mois (≈ 10 h par jour)" },
        feats: [
            "Tout Pro, plus :",
            "Mise en place accompagnée : règles et assistant IA configurés avec vous",
            "Support prioritaire",
            "Équipe et rôles (bientôt)",
        ],
        hl: false,
    },
    {
        id: "AGENCY",
        name: "Agence",
        base: null,
        tagline: "Pour les agences qui gèrent plusieurs marques",
        quota: { pages: null, aiReplies: null, liveHours: null },
        limits: { pages: "Pages illimitées", ai: "Volume IA sur mesure", live: "Lives illimités" },
        feats: ["Tout Business, plus :", "Tarif dégressif par marque gérée", "Accompagnement dédié"],
        hl: false,
    },
];
export const planDef = (id) => PLAN_DEFS.find((p) => p.id === id) ?? PLAN_DEFS[1];
// Au-delà du volume inclus
export const AI_PACK = { replies: 1000, price: 9900 };
export const ANNUAL_DISCOUNT = 0.15;
// Prix mensuel en formule annuelle : -15 %, arrondi au millier
export function annualMonthly(base) {
    return Math.round((base * (1 - ANNUAL_DISCOUNT)) / 1000) * 1000;
}
export const CONTACT_EMAIL = "contact@suiteflow.mg";
export const AGENCY_CONTACT_URL = `mailto:${CONTACT_EMAIL}?subject=SuiteFlow%20Agence`;
export const MOBILE_MONEY = "MVola · Orange Money · Airtel Money · carte bancaire";
