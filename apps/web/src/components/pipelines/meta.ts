import { AtSign, Clock, Coins, EyeOff, Flame, Globe, Hand, ListChecks, Mail, MessageCircle, MessageCircleReply, MessageSquareText, MessagesSquare, PenLine, Phone, Search, Send, StickyNote, Tags, Target, UserPlus, Webhook } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AutomationRule } from "@/lib/automation.api";
import type { LeadIntentValue, LeadStatusValue, PipelineStep, PipelineTrigger, StepType } from "@/lib/pipeline.api";

export const TRIGGERS: Array<{ id: PipelineTrigger; label: string; short: string; text: string; icon: LucideIcon; tint: string }> = [
  { id: "NEW_COMMENT", label: "Nouveau commentaire", short: "Commentaire", text: "Quelqu'un commente une publication de la Page", icon: MessageCircle, tint: "#3B82F6" },
  { id: "NEW_MESSAGE", label: "Nouveau message privé", short: "Message privé", text: "Quelqu'un écrit à la Page en privé", icon: Mail, tint: "#8B5CF6" },
  { id: "NEW_LEAD", label: "Nouveau lead", short: "Nouveau lead", text: "Un client potentiel est repéré pour la première fois", icon: UserPlus, tint: "#F59E0B" },
  { id: "HOT_LEAD", label: "Lead chaud", short: "Lead chaud", text: "Un message d'un lead dont la note est de 70 et plus", icon: Flame, tint: "#EF4444" },
];
export const triggerOf = (id: PipelineTrigger) => TRIGGERS.find((t) => t.id === id)!;

export const LEAD_STATUSES: Array<{ id: LeadStatusValue; label: string }> = [
  { id: "NEW", label: "À contacter" },
  { id: "CONTACTED", label: "Contacté" },
  { id: "QUALIFIED", label: "Qualifié" },
  { id: "WON", label: "Gagné" },
  { id: "LOST", label: "Perdu" },
];

export const LEAD_INTENTS: Array<{ id: LeadIntentValue; label: string }> = [
  { id: "prix", label: "Prix" },
  { id: "commande", label: "Commande" },
  { id: "livraison", label: "Livraison" },
  { id: "disponibilite", label: "Disponibilité" },
  { id: "question", label: "Question" },
  { id: "reclamation", label: "Réclamation" },
  { id: "compliment", label: "Compliment" },
  { id: "autre", label: "Autre" },
];

export interface StepMeta {
  type: StepType;
  kind: "condition" | "action";
  group: string; // famille dans la bibliothèque de blocs
  label: string;
  text: string;
  icon: LucideIcon;
  tint: string;
  make: (id: string) => PipelineStep;
}

// Bibliothèque de blocs. Conditions : si elles ne sont pas remplies, le pipeline s'arrête. Actions : elles font quelque chose.
export const STEP_TYPES: StepMeta[] = [
  // ── Conditions · Message
  { type: "KEYWORD", kind: "condition", group: "Le message", label: "Le message contient des mots", text: "Continue si l'un des mots (séparés par des virgules) est dans le message", icon: Search, tint: "#8B5CF6", make: (id) => ({ id, type: "KEYWORD", config: { keywords: "", mode: "CONTAINS" } }) },
  { type: "MATCH_RULE", kind: "condition", group: "Le message", label: "Le message correspond à une règle", text: "Continue seulement si le message déclenche la règle choisie", icon: MessageSquareText, tint: "#8B5CF6", make: (id) => ({ id, type: "MATCH_RULE", config: { ruleId: "" } }) },
  { type: "CHANNEL", kind: "condition", group: "Le message", label: "Commentaire ou message privé", text: "Continue seulement pour ce type de message", icon: MessagesSquare, tint: "#3B82F6", make: (id) => ({ id, type: "CHANNEL", config: { kind: "COMMENT" } }) },
  { type: "PLATFORM", kind: "condition", group: "Le message", label: "Facebook ou Instagram", text: "Continue seulement pour les comptes de ce réseau", icon: Globe, tint: "#0EA5E9", make: (id) => ({ id, type: "PLATFORM", config: { platform: "FACEBOOK" } }) },
  // ── Conditions · Lead
  { type: "MIN_SCORE", kind: "condition", group: "Le lead", label: "La note du lead est suffisante", text: "Continue seulement si le lead a au moins la note choisie", icon: Flame, tint: "#EF4444", make: (id) => ({ id, type: "MIN_SCORE", config: { min: 70 } }) },
  { type: "LEAD_STATUS", kind: "condition", group: "Le lead", label: "Le statut du lead", text: "Continue si le lead est dans l'un des statuts choisis", icon: ListChecks, tint: "#F59E0B", make: (id) => ({ id, type: "LEAD_STATUS", config: { statuses: ["NEW"] } }) },
  { type: "LEAD_INTENT", kind: "condition", group: "Le lead", label: "L'intention du lead", text: "Prix, commande, réclamation… : continue selon ce que veut le client", icon: Tags, tint: "#EC4899", make: (id) => ({ id, type: "LEAD_INTENT", config: { intents: ["prix"] } }) },
  { type: "LEAD_CONTACT", kind: "condition", group: "Le lead", label: "Le lead a laissé ses coordonnées", text: "Continue seulement s'il a donné un téléphone ou un e-mail", icon: Phone, tint: "#10B981", make: (id) => ({ id, type: "LEAD_CONTACT", config: {} }) },
  // ── Conditions · Temps
  { type: "BUSINESS_HOURS", kind: "condition", group: "Le moment", label: "Horaires d'ouverture", text: "Continue pendant, ou en dehors, de vos horaires (heure de Madagascar)", icon: Clock, tint: "#64748B", make: (id) => ({ id, type: "BUSINESS_HOURS", config: { mode: "OUTSIDE", from: "08:00", to: "18:00" } }) },
  // ── Actions · Répondre
  { type: "SEND_DM", kind: "action", group: "Répondre", label: "Envoyer un message privé", text: "Écrit à l'auteur ; {nom} et {page} sont remplacés", icon: Send, tint: "#3B82F6", make: (id) => ({ id, type: "SEND_DM", config: { text: "" } }) },
  { type: "SEND_PUBLIC_REPLY", kind: "action", group: "Répondre", label: "Répondre en public", text: "Publie une réponse sous le commentaire (sans effet sur un message privé)", icon: MessageCircleReply, tint: "#6366F1", make: (id) => ({ id, type: "SEND_PUBLIC_REPLY", config: { text: "" } }) },
  // ── Actions · Lead
  { type: "SET_LEAD_STATUS", kind: "action", group: "Le lead", label: "Changer le statut du lead", text: "Fait avancer le lead dans le pipeline commercial", icon: Target, tint: "#F59E0B", make: (id) => ({ id, type: "SET_LEAD_STATUS", config: { status: "CONTACTED" } }) },
  { type: "SET_LEAD_NOTE", kind: "action", group: "Le lead", label: "Ajouter une note au lead", text: "Complète la fiche du lead avec une note", icon: PenLine, tint: "#14B8A6", make: (id) => ({ id, type: "SET_LEAD_NOTE", config: { text: "" } }) },
  { type: "SET_LEAD_VALUE", kind: "action", group: "Le lead", label: "Estimer la valeur du lead", text: "Renseigne le montant estimé de la vente (Ar)", icon: Coins, tint: "#EAB308", make: (id) => ({ id, type: "SET_LEAD_VALUE", config: { value: 0 } }) },
  // ── Actions · Équipe
  { type: "ESCALATE", kind: "action", group: "L'équipe", label: "Escalader vers l'équipe", text: "Place le message dans « À traiter » pour qu'un humain le voie", icon: Hand, tint: "#f05a1a", make: (id) => ({ id, type: "ESCALATE", config: {} }) },
  { type: "NOTIFY", kind: "action", group: "L'équipe", label: "Noter dans l'historique", text: "Laisse une note visible de toute l'équipe", icon: StickyNote, tint: "#10B981", make: (id) => ({ id, type: "NOTIFY", config: { text: "" } }) },
  { type: "EMAIL_OWNER", kind: "action", group: "L'équipe", label: "M'envoyer un e-mail", text: "Prévient le propriétaire de l'espace par e-mail", icon: AtSign, tint: "#0EA5E9", make: (id) => ({ id, type: "EMAIL_OWNER", config: { text: "" } }) },
  { type: "IGNORE_MESSAGE", kind: "action", group: "L'équipe", label: "Ignorer le message", text: "Le retire de « À traiter » sans répondre", icon: EyeOff, tint: "#94A3B8", make: (id) => ({ id, type: "IGNORE_MESSAGE", config: {} }) },
  // ── Actions · Connexions
  { type: "WEBHOOK", kind: "action", group: "Connexions", label: "Envoyer à une adresse web", text: "Transmet l'événement à Zapier, Make ou à votre outil (https)", icon: Webhook, tint: "#7C3AED", make: (id) => ({ id, type: "WEBHOOK", config: { url: "" } }) },
];
export const stepMeta = (t: StepType) => STEP_TYPES.find((s) => s.type === t)!;

// Noms courts pour le schéma du workflow
export const STEP_SHORT: Record<StepType, string> = {
  MATCH_RULE: "Règle",
  MIN_SCORE: "Note du lead",
  SEND_DM: "Message privé",
  SET_LEAD_STATUS: "Statut du lead",
  ESCALATE: "Escalade",
  NOTIFY: "Note d'équipe",
  KEYWORD: "Mots du message",
  CHANNEL: "Canal",
  PLATFORM: "Réseau",
  LEAD_STATUS: "Statut du lead",
  LEAD_INTENT: "Intention du lead",
  LEAD_CONTACT: "Coordonnées",
  BUSINESS_HOURS: "Horaires",
  SEND_PUBLIC_REPLY: "Réponse publique",
  SET_LEAD_NOTE: "Note du lead",
  SET_LEAD_VALUE: "Valeur du lead",
  IGNORE_MESSAGE: "Ignorer",
  EMAIL_OWNER: "E-mail",
  WEBHOOK: "Adresse web",
};

export const newId = () => Math.random().toString(36).slice(2, 10);

// Résumé d'une étape, en une phrase
export function stepSummary(step: PipelineStep, rules: AutomationRule[]): string {
  switch (step.type) {
    case "MATCH_RULE": return `Règle « ${rules.find((r) => r.id === step.config.ruleId)?.name ?? "à choisir"} »`;
    case "MIN_SCORE": return `Note d'au moins ${step.config.min}`;
    case "SEND_DM": return step.config.text ? `« ${step.config.text.length > 48 ? `${step.config.text.slice(0, 47)}…` : step.config.text} »` : "Message à écrire";
    case "SET_LEAD_STATUS": return `Statut « ${LEAD_STATUSES.find((s) => s.id === step.config.status)?.label} »`;
    case "ESCALATE": return "Vers « À traiter »";
    case "NOTIFY": return step.config.text ? `« ${step.config.text} »` : "Note à écrire";
    case "KEYWORD": return step.config.keywords ? `${step.config.mode === "EXACT" ? "Exactement" : "Contient"} « ${step.config.keywords} »` : "Mots à choisir";
    case "CHANNEL": return step.config.kind === "DIRECT" ? "Message privé" : "Commentaire";
    case "PLATFORM": return step.config.platform === "INSTAGRAM" ? "Instagram" : "Facebook";
    case "LEAD_STATUS": return step.config.statuses.map((x) => LEAD_STATUSES.find((s) => s.id === x)?.label).join(" ou ") || "Statut à choisir";
    case "LEAD_INTENT": return step.config.intents.map((x) => LEAD_INTENTS.find((s) => s.id === x)?.label).join(" ou ") || "Intention à choisir";
    case "LEAD_CONTACT": return "Téléphone ou e-mail connu";
    case "BUSINESS_HOURS": return `${step.config.mode === "INSIDE" ? "Pendant" : "Hors"} ${step.config.from}–${step.config.to}`;
    case "SEND_PUBLIC_REPLY": return step.config.text ? `« ${step.config.text.length > 48 ? `${step.config.text.slice(0, 47)}…` : step.config.text} »` : "Réponse à écrire";
    case "SET_LEAD_NOTE": return step.config.text ? `« ${step.config.text} »` : "Note à écrire";
    case "SET_LEAD_VALUE": return `${step.config.value.toLocaleString("fr-FR")} Ar`;
    case "IGNORE_MESSAGE": return "Quitte « À traiter »";
    case "EMAIL_OWNER": return step.config.text ? `« ${step.config.text} »` : "Message à écrire";
    case "WEBHOOK": return step.config.url ? step.config.url.replace(/^https:\/\//, "") : "Adresse à indiquer";
  }
}

// Erreur de saisie d'une étape (null = valide) : même exigences que le serveur
export function stepError(step: PipelineStep): string | null {
  switch (step.type) {
    case "MATCH_RULE": return step.config.ruleId ? null : "Choisissez une règle";
    case "MIN_SCORE": return step.config.min >= 1 && step.config.min <= 100 ? null : "Note entre 1 et 100";
    case "SEND_DM": return step.config.text.trim() ? null : "Écrivez le message à envoyer";
    case "NOTIFY": return step.config.text.trim() ? null : "Écrivez la note";
    case "KEYWORD": return step.config.keywords.trim() ? null : "Indiquez au moins un mot";
    case "LEAD_STATUS": return step.config.statuses.length ? null : "Choisissez au moins un statut";
    case "LEAD_INTENT": return step.config.intents.length ? null : "Choisissez au moins une intention";
    case "BUSINESS_HOURS": return /^\d{2}:\d{2}$/.test(step.config.from) && /^\d{2}:\d{2}$/.test(step.config.to) ? null : "Indiquez les deux heures";
    case "SEND_PUBLIC_REPLY": return step.config.text.trim() ? null : "Écrivez la réponse";
    case "SET_LEAD_NOTE": return step.config.text.trim() ? null : "Écrivez la note";
    case "SET_LEAD_VALUE": return Number.isInteger(step.config.value) && step.config.value >= 0 ? null : "Indiquez un montant en Ar";
    case "EMAIL_OWNER": return step.config.text.trim() ? null : "Écrivez le message de l'e-mail";
    case "WEBHOOK": return /^https:\/\/\S+$/i.test(step.config.url.trim()) ? null : "Adresse https:// requise";
    default: return null;
  }
}

// Modèles pour démarrer vite
export const TEMPLATES: Array<{ id: string; name: string; description: string; trigger: PipelineTrigger; steps: () => PipelineStep[] }> = [
  {
    id: "hot",
    name: "Lead chaud → équipe",
    description: "Prévient l'équipe dès qu'un client très intéressé écrit.",
    trigger: "HOT_LEAD",
    steps: (): PipelineStep[] => [
      { id: newId(), type: "ESCALATE", config: {} },
      { id: newId(), type: "NOTIFY", config: { text: "Lead chaud : à rappeler rapidement" } },
    ],
  },
  {
    id: "welcome",
    name: "Nouveau lead → bienvenue",
    description: "Accueille chaque nouveau client potentiel en privé, puis le marque « Contacté ».",
    trigger: "NEW_LEAD",
    steps: (): PipelineStep[] => [
      { id: newId(), type: "SEND_DM", config: { text: "Bonjour {nom}, merci de votre intérêt pour {page} ! Je suis là pour répondre à vos questions." } },
      { id: newId(), type: "SET_LEAD_STATUS", config: { status: "CONTACTED" } },
    ],
  },
  {
    id: "price",
    name: "Question de prix → suivi privé",
    description: "Quand un commentaire déclenche une règle, envoie les détails en privé et suit le lead.",
    trigger: "NEW_COMMENT",
    steps: (): PipelineStep[] => [
      { id: newId(), type: "MATCH_RULE", config: { ruleId: "" } },
      { id: newId(), type: "SEND_DM", config: { text: "Bonjour {nom}, voici les détails que vous avez demandés : …" } },
      { id: newId(), type: "SET_LEAD_STATUS", config: { status: "CONTACTED" } },
    ],
  },
  {
    id: "after-hours",
    name: "Hors horaires → message d'absence",
    description: "En dehors de vos horaires, prévient le client en privé puis garde le message pour l'équipe.",
    trigger: "NEW_MESSAGE",
    steps: (): PipelineStep[] => [
      { id: newId(), type: "BUSINESS_HOURS", config: { mode: "OUTSIDE", from: "08:00", to: "18:00" } },
      { id: newId(), type: "SEND_DM", config: { text: "Bonjour {nom}, merci pour votre message ! Nous sommes fermés pour le moment, nous vous répondons dès demain matin." } },
      { id: newId(), type: "ESCALATE", config: {} },
    ],
  },
  {
    id: "complaint",
    name: "Réclamation → équipe et e-mail",
    description: "Dès qu'un client se plaint, le message passe en « À traiter » et vous recevez un e-mail.",
    trigger: "NEW_MESSAGE",
    steps: (): PipelineStep[] => [
      { id: newId(), type: "LEAD_INTENT", config: { intents: ["reclamation"] } },
      { id: newId(), type: "ESCALATE", config: {} },
      { id: newId(), type: "EMAIL_OWNER", config: { text: "Réclamation client à traiter en priorité" } },
    ],
  },
];
