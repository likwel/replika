import {
  UserPlus, LogIn, LogOut, KeyRound, Mail, Facebook, Bot, Sparkles, Send,
  MessageCircle, Trash2, Target, CalendarClock, CheckCircle2, XCircle, Radio, Settings2, Power, History as HistoryIcon,
  CreditCard, Gauge, PauseCircle, ShieldAlert, ShieldCheck, Coins, Users,
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
  FACEBOOK_CONNECT_FAILED: { label: "Connexion Facebook échouée", icon: Facebook, color: theme.red },
  AUTO_REPLY_SENT: { label: "Réponse automatique envoyée", icon: Bot, color: theme.goldDark },
  AUTO_REPLY_FAILED: { label: "Réponse automatique en échec", icon: Bot, color: theme.red },
  AI_REPLY_SENT: { label: "Réponse IA envoyée", icon: Sparkles, color: theme.goldDark },
  AI_REPLY_FAILED: { label: "Réponse IA en échec", icon: Sparkles, color: theme.red },
  REPLY_SENT: { label: "Réponse envoyée", icon: Send, color: theme.goldDark },
  COMMENT_POSTED: { label: "Commentaire publié", icon: MessageCircle, color: theme.goldDark },
  COMMENT_DELETED: { label: "Commentaire supprimé", icon: Trash2, color: theme.textMuted },
  LEAD_CONTACTED: { label: "Lead contacté", icon: Target, color: theme.goldDark },
  SCHEDULE_CREATED: { label: "Programmation créée", icon: CalendarClock, color: theme.textMuted },
  SCHEDULE_PUBLISHED: { label: "Programmation publiée", icon: CheckCircle2, color: "#166534" },
  SCHEDULE_FAILED: { label: "Programmation en échec", icon: XCircle, color: theme.red },
  LIVE_SESSION_STARTED: { label: "Session live démarrée", icon: Radio, color: "#B91C1C" },
  PROFILE_UPDATED: { label: "Profil mis à jour", icon: Settings2, color: theme.textMuted },
  AUTO_REPLY_ENABLED: { label: "Réponses automatiques activées", icon: Power, color: "#166534" },
  AUTO_REPLY_DISABLED: { label: "Réponses automatiques en pause", icon: Power, color: theme.textMuted },
  AI_NEEDS_REVIEW: { label: "Réponse IA envoyée, à relire", icon: Sparkles, color: theme.amber },
  // Abonnement
  CHECKOUT_CREATED: { label: "Paiement démarré", icon: CreditCard, color: theme.textMuted },
  SUBSCRIPTION_ACTIVATED: { label: "Formule activée", icon: CreditCard, color: "#166534" },
  LIVE_HOURS_PURCHASED: { label: "Heures de live achetées", icon: Radio, color: "#166534" },
  REPLY_CREDITS_PURCHASED: { label: "Crédits de réponses achetés", icon: Coins, color: "#166534" },
  SUBSCRIPTION_SET_BY_ADMIN: { label: "Formule modifiée par l'équipe SuiteFlow", icon: CreditCard, color: theme.goldDark },
  PAYMENT_FAILED: { label: "Paiement refusé", icon: CreditCard, color: theme.red },
  PAYMENT_AMOUNT_MISMATCH: { label: "Paiement à vérifier", icon: ShieldAlert, color: theme.red },
  AI_QUOTA_REACHED: { label: "Quota de réponses IA atteint", icon: Gauge, color: theme.amber },
  LIVE_QUOTA_REACHED: { label: "Quota d'heures de live atteint", icon: Gauge, color: theme.amber },
  LIVE_PAUSED_QUOTA: { label: "Live en pause : quota atteint", icon: PauseCircle, color: theme.amber },
  LIVE_PAUSED_SUBSCRIPTION: { label: "Live en pause : abonnement expiré", icon: PauseCircle, color: theme.red },
  SCHEDULE_SKIPPED_SUBSCRIPTION: { label: "Publication non envoyée : abonnement expiré", icon: XCircle, color: theme.red },
  PAGES_DEACTIVATED_FOR_PLAN: { label: "Pages désactivées (limite de la formule)", icon: Power, color: theme.amber },
  LIVE_HOURS_GIFTED: { label: "Heures de live offertes par SuiteFlow", icon: Radio, color: "#166534" },
  REPLY_CREDITS_GIFTED: { label: "Crédits de réponses offerts par SuiteFlow", icon: Coins, color: "#166534" },
  // Équipe
  TEAM_MEMBER_INVITED: { label: "Membre invité dans l'équipe", icon: Users, color: theme.goldDark },
  TEAM_MEMBER_JOINED: { label: "Membre arrivé dans l'équipe", icon: Users, color: "#166534" },
  TEAM_MEMBER_UPDATED: { label: "Droits d'un membre modifiés", icon: Users, color: theme.goldDark },
  TEAM_MEMBER_DISABLED: { label: "Accès d'un membre suspendu", icon: Users, color: theme.amber },
  TEAM_MEMBER_ENABLED: { label: "Accès d'un membre rétabli", icon: Users, color: "#166534" },
  TEAM_MEMBER_REMOVED: { label: "Membre retiré de l'équipe", icon: Users, color: theme.red },
  TEAM_MEMBER_LEFT: { label: "Membre parti de l'équipe", icon: Users, color: theme.textMuted },
  TEAM_INVITE_CANCELLED: { label: "Invitation annulée", icon: Users, color: theme.textMuted },
  TEAM_INVITE_DECLINED: { label: "Invitation refusée", icon: Users, color: theme.textMuted },
  // Modération par un administrateur
  ACCOUNT_SUSPENDED: { label: "Compte suspendu", icon: PauseCircle, color: theme.amber },
  ACCOUNT_REACTIVATED: { label: "Suspension levée", icon: Power, color: "#166534" },
  ACCOUNT_BANNED: { label: "Compte banni", icon: ShieldAlert, color: theme.red },
  ACCOUNT_UNBANNED: { label: "Bannissement levé", icon: Power, color: "#166534" },
  ACCOUNT_DELETED: { label: "Compte supprimé par l'administrateur", icon: Trash2, color: theme.red },
  ACCOUNT_RESTORED: { label: "Compte restauré", icon: Power, color: "#166534" },
  SESSIONS_REVOKED: { label: "Sessions fermées par l'administrateur", icon: LogOut, color: theme.textMuted },
  TWO_FACTOR_ENABLED: { label: "Validation en deux étapes activée", icon: ShieldCheck, color: "#166534" },
  TWO_FACTOR_DISABLED: { label: "Validation en deux étapes désactivée", icon: ShieldAlert, color: theme.amber },
  TWO_FACTOR_RESET: { label: "Validation en deux étapes réinitialisée par l'administrateur", icon: ShieldAlert, color: theme.amber },
  FEE_RATES_UPDATED: { label: "Commissions Papi modifiées", icon: CreditCard, color: theme.textMuted },
};

const PLAN_NAMES: Record<string, string> = { STARTER: "Starter", PRO: "Pro", BUSINESS: "Business", AGENCY: "Agence" };
const fmtAr = (n: number) => `${n.toLocaleString("fr-FR").replace(/[\u202f\u00a0,]/g, " ")} Ar`;

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
    case "CHECKOUT_CREATED":
    case "SUBSCRIPTION_ACTIVATED": {
      const plan = PLAN_NAMES[str(m, "plan") ?? ""] ?? null;
      const period = str(m, "period") === "ANNUAL" ? "annuel" : str(m, "period") === "MONTHLY" ? "mensuel" : null;
      const amount = num(m, "amount");
      const end = str(m, "periodEnd");
      const extra = num(m, "extraDays");
      return [
        [plan, period].filter(Boolean).join(" "),
        amount !== null ? fmtAr(amount) : null,
        end ? `jusqu'au ${new Date(end).toLocaleDateString("fr-FR")}` : null,
        extra ? `+${extra} j convertis` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "LIVE_HOURS_PURCHASED": {
      const hours = num(m, "hours");
      const amount = num(m, "amount");
      return [hours !== null ? `${hours} h de Live Manager` : null, amount !== null ? fmtAr(amount) : null].filter(Boolean).join(" · ");
    }
    case "FACEBOOK_CONNECT_FAILED":
      return str(m, "reason");
    case "TEAM_MEMBER_INVITED":
    case "TEAM_MEMBER_JOINED":
    case "TEAM_MEMBER_UPDATED":
    case "TEAM_MEMBER_DISABLED":
    case "TEAM_MEMBER_ENABLED":
    case "TEAM_MEMBER_REMOVED":
    case "TEAM_MEMBER_LEFT":
    case "TEAM_INVITE_CANCELLED":
    case "TEAM_INVITE_DECLINED":
      return str(m, "email");
    case "REPLY_CREDITS_PURCHASED": {
      const credits = num(m, "credits");
      const amount = num(m, "amount");
      return [credits !== null ? `${credits.toLocaleString("fr-FR")} réponses` : null, amount !== null ? fmtAr(amount) : null].filter(Boolean).join(" · ");
    }
    case "REPLY_CREDITS_GIFTED": {
      const credits = num(m, "credits");
      return credits !== null ? `${credits.toLocaleString("fr-FR")} réponses ajoutées au crédit` : null;
    }
    case "SUBSCRIPTION_SET_BY_ADMIN": {
      const end = str(m, "periodEnd");
      return [PLAN_NAMES[str(m, "plan") ?? ""], end ? `jusqu'au ${new Date(end).toLocaleDateString("fr-FR")}` : "sans échéance"].filter(Boolean).join(" · ");
    }
    case "PAYMENT_FAILED":
      return str(m, "message");
    case "AI_QUOTA_REACHED": {
      const limit = num(m, "limit");
      return limit !== null ? `${limit.toLocaleString("fr-FR")} réponses ce mois-ci : les crédits de réponses prennent le relais, sinon les messages restent dans « À traiter »` : null;
    }
    case "LIVE_PAUSED_QUOTA":
    case "LIVE_QUOTA_REACHED":
    case "LIVE_PAUSED_SUBSCRIPTION":
      return str(m, "title");
    case "ACCOUNT_SUSPENDED":
    case "ACCOUNT_BANNED":
    case "ACCOUNT_DELETED": {
      const until = str(m, "until");
      return [str(m, "reason"), until ? `jusqu'au ${new Date(until).toLocaleDateString("fr-FR")}` : null].filter(Boolean).join(" · ") || null;
    }
    case "LIVE_HOURS_GIFTED": {
      const hours = num(m, "hours");
      return hours !== null ? `${hours} h ajoutées au crédit` : null;
    }
    case "PAGES_DEACTIVATED_FOR_PLAN": {
      const pages = m && Array.isArray(m.pages) ? (m.pages as string[]) : [];
      return pages.join(", ") || null;
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
