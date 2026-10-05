import { CalendarDays, Radio, Bot, BarChart3, History, Plug, Settings, LayoutDashboard, Target } from "lucide-react";
import type { Menu } from "@/types";

export const MENUS: Menu[] = [
  // Publications (ex-Actualités), messages privés et file « À traiter » (ex-Messages) de toutes les Pages
  { id: "conn", icon: Plug, label: "Connexions", sub: ["Facebook", "Instagram", "TikTok"] },
  { id: "hub", icon: LayoutDashboard, label: "Gestion", sub: ["Publications", "Messages privés", "À traiter"] },
  { id: "live", icon: Radio, label: "Live Manager", sub: ["Sessions live", "Commandes JP"] },
  { id: "leads", icon: Target, label: "Lead Manager", sub: ["Tous les leads", "À contacter", "Pipeline"] },
  { id: "plan", icon: CalendarDays, label: "Planifier", sub: ["Calendrier", "File d'attente", "Brouillons", "Historique"] },
  { id: "auto", icon: Bot, label: "Automatisation", sub: ["Toutes les règles", "Commentaires", "Messages privés", "Assistant IA"] },
  { id: "stat", icon: BarChart3, label: "Statistiques", sub: ["Vue globale", "Engagement", "Rapports"] },
  { id: "hist", icon: History, label: "Historique", sub: ["Actions", "Messages", "Connexions"] },
  { id: "set", icon: Settings, label: "Paramètres", sub: ["Profil", "Sécurité", "Préférences", "Équipe", "Facturation"] },
];
