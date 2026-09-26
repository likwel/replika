import { MessageCircle, MessagesSquare, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import type { MessageTag, Schedule, ScheduleKind, ScheduleStatus } from "@/lib/schedule.api";

export const KIND_META: Record<ScheduleKind, { label: string; short: string; icon: LucideIcon; color: string }> = {
  POST: { label: "Publication", short: "Publication", icon: Newspaper, color: "#2563eb" },
  COMMENT: { label: "Commentaire", short: "Commentaire", icon: MessageCircle, color: "#7c3aed" },
  MESSAGE: { label: "Message privé", short: "Message", icon: MessagesSquare, color: "#0d9488" },
};

export const STATUS_META: Record<ScheduleStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Brouillon", color: theme.textMuted, bg: theme.bg },
  SCHEDULED: { label: "Programmé", color: theme.goldDark, bg: theme.goldSoft },
  PUBLISHING: { label: "Envoi en cours", color: "#2563eb", bg: "#E8F0FE" },
  DONE: { label: "Publié", color: "#15803d", bg: "#E7F6EC" },
  PARTIAL: { label: "Partiel", color: "#b45309", bg: "#FEF3C7" },
  FAILED: { label: "Échec", color: theme.red, bg: "#FDECEC" },
};

export const TAG_OPTIONS: Array<{ value: MessageTag | ""; label: string; hint: string }> = [
  { value: "", label: "Aucune (réponse sous 24 h)", hint: "La personne doit vous avoir écrit dans les 24 h précédant l'envoi." },
  { value: "POST_PURCHASE_UPDATE", label: "Suivi de commande", hint: "Confirmation, expédition, livraison d'un achat. Pas de promotion." },
  { value: "CONFIRMED_EVENT_UPDATE", label: "Rappel d'événement", hint: "Rappel d'un événement auquel la personne est inscrite." },
  { value: "ACCOUNT_UPDATE", label: "Mise à jour de compte", hint: "Changement concernant le compte ou la demande de la personne." },
];

export const isEditable = (s: Schedule) => ["DRAFT", "SCHEDULED", "FAILED"].includes(s.status);

// Dates locales : l'utilisateur programme à l'heure de son fuseau
export const pad = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dayKey = (d: Date) => toDateInput(d);

export function formatSlot(iso: string | null) {
  if (!iso) return "Sans date";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (dayKey(d) === dayKey(today)) return `Aujourd'hui à ${time}`;
  if (dayKey(d) === dayKey(tomorrow)) return `Demain à ${time}`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${time}`;
}

// Prochaine heure pleine (au moins 30 min plus tard)
export function nextSlot(base = new Date()) {
  const d = new Date(base.getTime() + 30 * 60000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

// Grille du mois (6 semaines, du lundi au dimanche)
export function monthRange(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 42);
  return { start, end };
}
