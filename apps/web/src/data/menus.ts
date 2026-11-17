import { CalendarDays, Radio, MessageSquareText, Workflow, BarChart3, History, Plug, Settings, MessagesSquare, Inbox, LayoutGrid, Target, Store, ShieldCheck } from "lucide-react";
import type { Menu } from "@/types";

// Chaque menu porte sa couleur : l'icône du rail est toujours colorée, l'accent sert d'état actif.
export const MENUS: Menu[] = [
  // Page d'accueil : synthèse de tout ce qui demande l'attention de l'utilisateur
  { id: "dash", icon: LayoutGrid, label: "Tableau de bord", color: "#f05a1a", short: "Accueil", sub: ["Vue d'ensemble"] },
  // Une seule vue : toutes les plateformes sont gérées sur le même écran
  { id: "conn", icon: Plug, label: "Comptes associés", color: "#3B82F6", short: "Comptes", sub: ["Comptes connectés"] },
  // Publications (ex-Actualités) et messages privés de toutes les Pages
  { id: "hub", icon: MessagesSquare, label: "Publications et messages", color: "#8B5CF6", short: "Messages", sub: ["Publications", "Messages privés"] },
  // Page à part : ce qui attend une décision humaine (suggestions à valider, escalades)
  { id: "queue", icon: Inbox, label: "À traiter", color: "#F05A1A", sub: ["Réponses à valider"] },
  { id: "live", icon: Radio, label: "Ventes en live", color: "#EF4444", short: "Lives", sub: ["Sessions live", "Commandes JP", "Listes d'articles"] },
  { id: "market", icon: Store, label: "Annonces et ventes", color: "#10B981", short: "Annonces", sub: ["Annonces", "Commandes", "Catalogue"] },
  { id: "leads", icon: Target, label: "Prospects", color: "#F59E0B", short: "Prospects", sub: ["Tous les leads", "À contacter", "Pipeline"] },
  // 4e sous-onglet nommé « Envois » (et non « Historique ») pour le distinguer du menu Historique de l'en-tête
  { id: "plan", icon: CalendarDays, label: "Publications planifiées", color: "#06B6D4", short: "Planning", sub: ["Calendrier", "File d'attente", "Brouillons", "Envois", "Imports"] },
  // Règles de réponse (mots-clés → réponse) et assistant IA : ce que SuiteFlow répond
  {
    id: "rules",
    icon: MessageSquareText,
    label: "Règles de réponse",
    short: "Règles",
    color: "#8B5CF6",
    sub: ["Mes règles", "Assistant IA", "État des comptes"],
  },
  // Pipelines : un déclencheur, puis des étapes (conditions sur les règles, actions) exécutées dans l'ordre
  {
    id: "auto",
    icon: Workflow,
    label: "Pipelines",
    color: "#00A884",
    short: "Pipelines",
    sub: ["Pipelines", "Exécutions"],
  },
  { id: "stat", icon: BarChart3, label: "Performances", color: "#0EA5E9", short: "Stats", sub: ["Vue globale", "Engagement", "Rapports"] },
  // Dans la navigation, groupe « Analyse ».
  { id: "hist", icon: History, label: "Journal d'activité", color: "#64748B", short: "Journal", sub: ["Actions", "Messages", "Connexions"] },
  // Masqué du rail : accessible depuis le menu du compte (avatar, en haut à droite).
  // Tableau de bord de la plateforme : visible des administrateurs seulement (lien dans la barre latérale)
  { id: "admin", icon: ShieldCheck, label: "Administration", color: "#6366F1", sub: ["Vue d'ensemble", "Utilisateurs", "Paiements", "Dépenses", "IA & système", "Messages"], hidden: true },
  { id: "set", icon: Settings, label: "Paramètres", color: "#A1A1AA", sub: ["Profil", "Sécurité", "Préférences", "Équipe", "Facturation"], hidden: true },
];
