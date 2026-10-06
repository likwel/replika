import type { LucideIcon } from "lucide-react";

export type Platform = "fb" | "ig";
export type ViewMode = "card" | "list";

export interface Menu {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string; // accent du menu : icône colorée du rail, indicateur de sous-onglet actif
  short?: string; // libellé court du rail d'icônes, quand le nom complet y serait tronqué
  sub: string[];
  hidden?: boolean; // masqué du rail d'icônes (accessible autrement : en-tête, sous-menu fusionné…)
  iconRailAlias?: string; // icône du rail à garder active quand ce menu (masqué) est actif
  mergeGroups?: Array<{ menuId: string; label: string }>; // sous-listes d'autres menus ajoutées après la sienne
}

export interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface Post {
  id: string;
  plat: Platform;
  page: string;
  time: string;
  live: boolean;
  kind: PostKind;
  text: string;
  img: string;
  isVideo: boolean;
  price: string | null;
  reactions: number;
  comments: number;
  shares: number;
  leads: number;
}

export type PostKind =
  | "text"
  | "image"
  | "video"
  | "reel"
  | "event"
  | "live"
  // compat avec les anciennes données mock :
  | "shop"
  | "reels"
  | "lives";

export interface ScheduledPost {
  plat: Platform;
  time: string;
  text: string;
  st: "scheduled" | "draft";
}