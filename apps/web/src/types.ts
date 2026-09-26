import type { LucideIcon } from "lucide-react";

export type Platform = "fb" | "ig";
export type ViewMode = "card" | "list";

export interface Menu {
  id: string;
  icon: LucideIcon;
  label: string;
  sub: string[];
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