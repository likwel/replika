import { CalendarDays, Radio, Bot, BarChart3, History, Plug, Settings, LayoutDashboard, Target, Store } from "lucide-react";
import type { Menu } from "@/types";

// Chaque menu porte sa couleur : l'icône du rail est toujours colorée, l'accent sert d'état actif.
export const MENUS: Menu[] = [
  { id: "conn", icon: Plug, label: "Connexions", color: "#3B82F6", sub: ["Facebook", "Instagram", "TikTok"] },
  // Publications (ex-Actualités), messages privés et file « À traiter » de toutes les Pages
  { id: "hub", icon: LayoutDashboard, label: "Gestion", color: "#8B5CF6", sub: ["Publications", "Messages privés", "À traiter"] },
  { id: "live", icon: Radio, label: "Live Manager", color: "#EF4444", short: "Lives", sub: ["Sessions live", "Commandes JP"] },
  { id: "market", icon: Store, label: "Gescom", color: "#10B981", sub: ["Annonces", "Commandes", "Catalogue"] },
  { id: "leads", icon: Target, label: "Lead Manager", color: "#F59E0B", short: "Leads", sub: ["Tous les leads", "À contacter", "Pipeline"] },
  // 4e sous-onglet nommé « Envois » (et non « Historique ») pour le distinguer du menu Historique de l'en-tête
  { id: "plan", icon: CalendarDays, label: "Planifier", color: "#06B6D4", sub: ["Calendrier", "File d'attente", "Brouillons", "Envois"] },
  {
    id: "auto",
    icon: Bot,
    label: "Automatisation",
    color: "#E5AC5F",
    short: "Automatisations",
    sub: ["Toutes les règles", "Commentaires", "Messages privés", "Assistant IA"],
  },
  { id: "stat", icon: BarChart3, label: "Statistiques", color: "#0EA5E9", short: "Stats", sub: ["Vue globale", "Engagement", "Rapports"] },
  // Masqué du rail : accessible depuis l'icône Historique de l'en-tête.
  { id: "hist", icon: History, label: "Historique", color: "#64748B", sub: ["Actions", "Messages", "Connexions"], hidden: true },
  { id: "set", icon: Settings, label: "Paramètres", color: "#A1A1AA", sub: ["Profil", "Sécurité", "Préférences", "Équipe", "Facturation"] },
];
