import { Flame, Hand, Mail, MessageCircle, MessageSquareText, Send, StickyNote, Target, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AutomationRule } from "@/lib/automation.api";
import type { LeadStatusValue, PipelineStep, PipelineTrigger, StepType } from "@/lib/pipeline.api";

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

export interface StepMeta {
  type: StepType;
  kind: "condition" | "action";
  label: string;
  text: string;
  icon: LucideIcon;
  tint: string;
  make: (id: string) => PipelineStep;
}

// Conditions : si elles ne sont pas remplies, le pipeline s'arrête. Actions : elles font quelque chose.
export const STEP_TYPES: StepMeta[] = [
  { type: "MATCH_RULE", kind: "condition", label: "Le message correspond à une règle", text: "Continue seulement si le message déclenche la règle choisie", icon: MessageSquareText, tint: "#8B5CF6", make: (id) => ({ id, type: "MATCH_RULE", config: { ruleId: "" } }) },
  { type: "MIN_SCORE", kind: "condition", label: "La note du lead est suffisante", text: "Continue seulement si le lead a au moins la note choisie", icon: Flame, tint: "#EF4444", make: (id) => ({ id, type: "MIN_SCORE", config: { min: 70 } }) },
  { type: "SEND_DM", kind: "action", label: "Envoyer un message privé", text: "Écrit à l'auteur ; {nom} et {page} sont remplacés", icon: Send, tint: "#3B82F6", make: (id) => ({ id, type: "SEND_DM", config: { text: "" } }) },
  { type: "SET_LEAD_STATUS", kind: "action", label: "Changer le statut du lead", text: "Fait avancer le lead dans le pipeline commercial", icon: Target, tint: "#F59E0B", make: (id) => ({ id, type: "SET_LEAD_STATUS", config: { status: "CONTACTED" } }) },
  { type: "ESCALATE", kind: "action", label: "Escalader vers l'équipe", text: "Place le message dans « À traiter » pour qu'un humain le voie", icon: Hand, tint: "#f05a1a", make: (id) => ({ id, type: "ESCALATE", config: {} }) },
  { type: "NOTIFY", kind: "action", label: "Noter dans l'historique", text: "Laisse une note visible de toute l'équipe", icon: StickyNote, tint: "#10B981", make: (id) => ({ id, type: "NOTIFY", config: { text: "" } }) },
];
export const stepMeta = (t: StepType) => STEP_TYPES.find((s) => s.type === t)!;

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
  }
}

// Erreur de saisie d'une étape (null = valide) : même exigences que le serveur
export function stepError(step: PipelineStep): string | null {
  switch (step.type) {
    case "MATCH_RULE": return step.config.ruleId ? null : "Choisissez une règle";
    case "MIN_SCORE": return step.config.min >= 1 && step.config.min <= 100 ? null : "Note entre 1 et 100";
    case "SEND_DM": return step.config.text.trim() ? null : "Écrivez le message à envoyer";
    case "NOTIFY": return step.config.text.trim() ? null : "Écrivez la note";
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
];
