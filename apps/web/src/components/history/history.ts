import {
  UserPlus, LogIn, LogOut, KeyRound, Mail, Facebook, Bot, Sparkles, Send,
  MessageCircle, Trash2, Target, CalendarClock, CheckCircle2, XCircle, Radio, Settings2, Power, History as HistoryIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { describeDevice } from "@/lib/format";
import type { HistoryEntry } from "@/lib/history.api";

interface ActionMeta {
  label: string;
  icon: LucideIcon;
  color: string;
}

export const ACTION_META: Record<string, ActionMeta> = {
  REGISTER: { label: "Création du compte", icon: UserPlus, color: theme.goldDark },
  LOGIN: { label: "Connexion", icon: LogIn, color: theme.textMuted },
  LOGOUT_ALL: { label: "Déconnexion des autres appareils", icon: LogOut, color: theme.textMuted },
  PASSWORD_CHANGED: { label: "Mot de passe modifié", icon: KeyRound, color: theme.goldDark },
  PASSWORD_RESET: { label: "Mot de passe réinitialisé", icon: KeyRound, color: theme.goldDark },
  EMAIL_CHANGED: { label: "Adresse e-mail modifiée", icon: Mail, color: theme.goldDark },
  FACEBOOK_CONNECTED: { label: "Facebook connecté", icon: Facebook, color: "#1877F2" },
  AUTO_REPLY_SENT: { label: "Réponse automatique envoyée", icon: Bot, color: theme.goldDark },
  AUTO_REPLY_FAILED: { label: "Réponse automatique en échec", icon: Bot, color: theme.red },
  AI_REPLY_SENT: { label: "Réponse IA envoyée", icon: Sparkles, color: theme.goldDark },
  AI_REPLY_FAILED: { label: "Réponse IA en échec", icon: Sparkles, color: theme.red },
  REPLY_SENT: { label: "Réponse envoyée", icon: Send, color: theme.goldDark },
  COMMENT_POSTED: { label: "Commentaire publié", icon: MessageCircle, color: theme.goldDark },
  COMMENT_DELETED: { label: "Commentaire supprimé", icon: Trash2, color: theme.textMuted },
  LEAD_CONTACTED: { label: "Lead contacté", icon: Target, color: theme.goldDark },
  SCHEDULE_CREATED: { label: "Programmation créée", icon: CalendarClock, color: theme.textMuted },
  SCHEDULE_PUBLISHED: { label: "Programmation publiée", icon: CheckCircle2, color: "#15803d" },
  SCHEDULE_FAILED: { label: "Programmation en échec", icon: XCircle, color: theme.red },
  LIVE_SESSION_STARTED: { label: "Session live démarrée", icon: Radio, color: "#dc2626" },
  PROFILE_UPDATED: { label: "Profil mis à jour", icon: Settings2, color: theme.textMuted },
  AUTO_REPLY_ENABLED: { label: "Réponses automatiques activées", icon: Power, color: "#15803d" },
  AUTO_REPLY_DISABLED: { label: "Réponses automatiques en pause", icon: Power, color: theme.textMuted },
};

export const actionMeta = (action: string): ActionMeta => ACTION_META[action] ?? { label: action, icon: HistoryIcon, color: theme.textMuted };

const str = (m: HistoryEntry["meta"], k: string) => (m && typeof m[k] === "string" ? (m[k] as string) : null);
const num = (m: HistoryEntry["meta"], k: string) => (m && typeof m[k] === "number" ? (m[k] as number) : null);

// Ligne de détail sous l'action : ce que portent les métadonnées, mis en forme en français
export function detailOf(e: HistoryEntry): string | null {
  const m = e.meta;
  switch (e.action) {
    case "LOGIN":
    case "REGISTER":
    case "PASSWORD_CHANGED":
    case "PASSWORD_RESET":
    case "LOGOUT_ALL": {
      const device = describeDevice(str(m, "ua"));
      const ip = str(m, "ip");
      return ip ? `${device} · ${ip}` : device;
    }
    case "EMAIL_CHANGED": {
      const from = str(m, "from");
      const to = str(m, "to");
      return from && to ? `${from} → ${to}` : null;
    }
    case "FACEBOOK_CONNECTED": {
      const pages = num(m, "pages") ?? 0;
      const ig = num(m, "instagram") ?? 0;
      const absent = num(m, "absent") ?? 0;
      const parts = [`${pages} Page${pages > 1 ? "s" : ""}`, ig > 0 ? `${ig} compte${ig > 1 ? "s" : ""} Instagram` : null].filter(Boolean);
      return absent > 0 ? `${parts.join(", ")} · ${absent} non cochée${absent > 1 ? "s" : ""}` : parts.join(", ");
    }
    case "AUTO_REPLY_FAILED":
    case "AI_REPLY_FAILED":
      return str(m, "error") ?? e.context;
    case "SCHEDULE_PUBLISHED":
    case "SCHEDULE_FAILED": {
      const done = num(m, "done") ?? 0;
      const failed = num(m, "failed") ?? 0;
      const kind = str(m, "kind");
      const kindLabel = kind === "POST" ? "Publication" : kind === "COMMENT" ? "Commentaire" : kind === "MESSAGE" ? "Message privé" : null;
      const result = failed > 0 ? `${done} réussie${done > 1 ? "s" : ""}, ${failed} en échec` : `${done} destination${done > 1 ? "s" : ""}`;
      return [kindLabel, result, e.context ? `« ${e.context} »` : null].filter(Boolean).join(" · ");
    }
    case "SCHEDULE_CREATED": {
      const kind = str(m, "kind");
      const kindLabel = kind === "POST" ? "Publication" : kind === "COMMENT" ? "Commentaire" : kind === "MESSAGE" ? "Message privé" : null;
      return [kindLabel, e.context ? `« ${e.context} »` : null].filter(Boolean).join(" · ");
    }
    case "PROFILE_UPDATED": {
      const fields = m && Array.isArray(m.fields) ? (m.fields as string[]) : [];
      return fields.length ? fields.join(", ") : null;
    }
    case "REPLY_SENT":
    case "COMMENT_POSTED":
    case "COMMENT_DELETED":
    case "AUTO_REPLY_SENT":
    case "AI_REPLY_SENT":
    case "LEAD_CONTACTED":
    case "LIVE_SESSION_STARTED":
      return e.context;
    default:
      return e.context;
  }
}

// "Aujourd'hui", "Hier", puis la date : en-tête des groupes de la liste
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function groupByDay(items: HistoryEntry[]): Array<[string, HistoryEntry[]]> {
  const groups = new Map<string, HistoryEntry[]>();
  for (const item of items) {
    const key = dayLabel(item.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}
