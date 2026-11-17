// Aide de page : le bouton « Comment fonctionne cette page » de l'en-tête ouvre ces quelques repères.
// Une entrée par module (id de data/menus.ts) ; chaque point tient en une phrase.
export interface PageHelp {
  title: string;
  intro: string;
  points: string[];
}

export const PAGE_HELP: Record<string, PageHelp> = {
  dash: {
    title: "Tableau de bord",
    intro: "Votre point de départ : tout ce qui demande votre attention, sans ouvrir chaque module.",
    points: [
      "La carte « À traiter » compte les messages et commentaires qui attendent une réponse de votre part.",
      "Les pastilles de comptes montrent, Page par Page, ce qui est en attente. Un clic ouvre la file.",
      "Les chiffres de la semaine se comparent à la semaine précédente.",
      "« Protection du compte » liste ce qui reste à activer pour sécuriser votre accès.",
    ],
  },
  queue: {
    title: "À traiter",
    intro: "Les messages et commentaires qui attendent une décision de votre part : suggestions à valider, cas escaladés.",
    points: [
      "Choisissez les Pages à afficher avec les pastilles du bandeau du haut.",
      "Validez, modifiez ou refusez la réponse proposée ; un clic ouvre la publication ou la conversation d'origine.",
      "Les nouveaux messages portent une pastille « Nouveau » et font monter la bulle de la cloche ; ils sont « vus » quand cette page les affiche, ou avec « Tout marquer comme vu » dans la cloche.",
      "Plus vos règles et votre assistant IA sont précis, moins cette page se remplit.",
    ],
  },
  hub: {
    title: "Publications et messages",
    intro: "Publications, commentaires et messages privés de toutes vos Pages au même endroit.",
    points: [
      "Choisissez les Pages à afficher avec les pastilles du bandeau du haut.",
      "Ouvrez une publication pour répondre à ses commentaires, ou une conversation pour répondre en privé.",
      "L'assistant IA peut proposer une réponse : vous la relisez avant l'envoi.",
    ],
  },
  conn: {
    title: "Comptes associés",
    intro: "Reliez vos Pages Facebook et comptes Instagram : SuiteFlow lit leurs commentaires et messages pour y répondre à votre place.",
    points: [
      "La connexion passe par l'autorisation officielle de Meta ; aucun mot de passe Facebook n'est demandé.",
      "Si une Page cesse de se synchroniser, reconnectez-la depuis cette page.",
    ],
  },
  live: {
    title: "Ventes en live",
    intro: "Suivez vos lives Facebook et transformez les commentaires « JP » en commandes.",
    points: [
      "Onglet « Listes d'articles » : importez vos articles depuis Google Sheets, Excel ou CSV avant le live, et associez une seule fois vos colonnes (code, article, prix, stock).",
      "Au démarrage d'une session, joignez la liste en un clic : le tableur est relu pour avoir les prix et stocks du jour.",
      "Réglages de la session › « Réponses aux autres commentaires » : joignez des règles (prix, livraison…) pour répondre aux commentaires qui ne sont pas des JP.",
      "Aucun JP n'est perdu : si le serveur s'arrête, tout ce qui a été publié pendant l'arrêt est relu au redémarrage, et chaque JP repris va jusqu'au bout (commande, message privé).",
      "Créez une session pour un live en cours ou une publication, avec ses produits et ses champs obligatoires.",
      "Les commandes détectées arrivent dans l'onglet Commandes ; les factures se génèrent à la fin du live.",
    ],
  },
  market: {
    title: "Annonces et ventes",
    intro: "Vos annonces, leurs commandes et votre Catalogue Facebook.",
    points: [
      "Importez vos produits depuis le Catalogue ou créez-les à la main.",
      "Les commandes des acheteurs se suivent par statut, de la nouvelle commande à la livraison.",
    ],
  },
  leads: {
    title: "Prospects",
    intro: "Les clients potentiels repérés automatiquement dans vos commentaires et messages.",
    points: [
      "Chaque lead reçoit un score (chaud, tiède, froid) selon l'intention d'achat détectée.",
      "Faites avancer un lead de colonne en colonne dans le Pipeline, ou changez son statut dans la liste.",
    ],
  },
  plan: {
    title: "Publications planifiées",
    intro: "Programmez vos publications et envois sur Facebook et Instagram.",
    points: [
      "Le calendrier montre ce qui part et quand ; la file d'attente liste les envois à venir.",
      "Les brouillons restent privés tant que vous ne les programmez pas.",
      "« Importer » lit un tableur Google Sheets ou CSV (date, texte, compte, lien de l'image) et programme chaque ligne ; les images sont téléchargées depuis leur lien.",
      "Gardez le tableur : l'onglet Imports le relit régulièrement et programme les nouvelles lignes toutes seules.",
    ],
  },
  rules: {
    title: "Règles de réponse",
    intro: "Une règle dit à SuiteFlow quoi répondre : quand un client écrit tel mot, il répond tel message.",
    points: [
      "Créez une règle avec « Nouvelle règle », ou partez d'un modèle (prix, livraison, accueil…).",
      "Si plusieurs règles correspondent, la première de la liste répond ; sans règle, l'assistant IA prend le relais, sinon le message vous attend dans « À traiter ».",
      "« Tester » montre quelle règle répondrait à un message d'exemple, sans rien publier.",
      "L'onglet « État des comptes » explique ce qui empêche une réponse automatique et comment le corriger.",
    ],
  },
  auto: {
    title: "Pipelines",
    intro: "Un pipeline enchaîne des étapes automatiquement quand un événement se produit.",
    points: [
      "Choisissez un déclencheur : nouveau commentaire, nouveau message, nouveau lead ou lead chaud.",
      "Ajoutez des étapes dans l'ordre : des conditions (le message correspond à une règle, la note du lead…) puis des actions (message privé, statut du lead, escalade, note).",
      "Si une condition n'est pas remplie, le pipeline s'arrête là, sans erreur.",
      "Un nouveau pipeline démarre en pause : relisez-le avant de l'activer. Le détail de chaque exécution est dans l'onglet Exécutions.",
    ],
  },
  stat: {
    title: "Performances",
    intro: "L'activité de vos comptes sur la période choisie, comparée à la précédente.",
    points: [
      "La vue globale résume commentaires, messages, leads et réponses IA.",
      "Engagement détaille l'activité jour par jour ; Rapports classe vos comptes et vos règles.",
    ],
  },
  hist: {
    title: "Journal d'activité",
    intro: "Tout ce qui s'est passé sur votre compte, le plus récent en premier.",
    points: ["Filtrez par messages ou par connexions avec les onglets.", "Chaque ligne indique le compte concerné et, en équipe, le membre à l'origine de l'action."],
  },
  set: {
    title: "Paramètres",
    intro: "Votre profil, la sécurité de votre accès, vos préférences, votre équipe et votre facturation.",
    points: ["Activez la validation en deux étapes dans Sécurité.", "Mode sombre, couleur d'accent et page d'ouverture se règlent dans Préférences."],
  },
  admin: {
    title: "Administration",
    intro: "Le suivi de la plateforme : inscriptions, encaissements, activité et état des services.",
    points: ["Les chiffres se filtrent par période en haut de la vue d'ensemble.", "Les onglets listent les comptes, les paiements, les dépenses et l'usage de l'IA."],
  },
};
