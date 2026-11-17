import type { PipelineStep } from "./pipeline.schema.js";
import { ruleMatchesText, type IncomingKind } from "../autoreply/autoreply.matcher.js";

// Logique pure du moteur (sans base ni réseau) : testée à part.

export const ACTION_TYPES = new Set<PipelineStep["type"]>(["SEND_DM", "SET_LEAD_STATUS", "ESCALATE", "NOTIFY"]);
export const isCondition = (t: PipelineStep["type"]) => !ACTION_TYPES.has(t);

export interface TraceEntry {
  stepId: string;
  type: PipelineStep["type"];
  label: string;
  status: "ok" | "skipped" | "failed";
  detail?: string;
}

// Libellé court d'une étape, tel qu'affiché dans la trace d'exécution
export function stepLabel(step: PipelineStep, ruleName?: string): string {
  switch (step.type) {
    case "MATCH_RULE": return `Le message correspond à la règle « ${ruleName ?? "?"} »`;
    case "MIN_SCORE": return `Note du lead d'au moins ${step.config.min}`;
    case "SEND_DM": return "Envoyer un message privé";
    case "SET_LEAD_STATUS": return `Passer le lead en « ${LEAD_STATUS_LABEL[step.config.status]} »`;
    case "ESCALATE": return "Escalader vers l'équipe";
    case "NOTIFY": return "Noter dans l'historique";
  }
}

export const LEAD_STATUS_LABEL = { NEW: "À contacter", CONTACTED: "Contacté", QUALIFIED: "Qualifié", WON: "Gagné", LOST: "Perdu" } as const;

// Une règle ne vise qu'un canal (ou les deux) : un commentaire ne déclenche pas une règle « messages privés »
export function ruleCoversKind(rule: { channel: "ALL" | "COMMENT" | "DIRECT" }, kind: IncomingKind): boolean {
  return rule.channel === "ALL" || rule.channel === kind;
}

export interface ConditionContext {
  text: string;
  kind: IncomingKind;
  leadScore: number | null;
  rules: Map<string, { name: string; channel: "ALL" | "COMMENT" | "DIRECT"; matchType: "CONTAINS" | "EXACT" | "ANY"; trigger: string }>;
}

// Résultat d'une condition : passe, ou raison de l'arrêt
export function checkCondition(step: PipelineStep, ctx: ConditionContext): { pass: true } | { pass: false; reason: string } {
  if (step.type === "MATCH_RULE") {
    const rule = ctx.rules.get(step.config.ruleId);
    if (!rule) return { pass: false, reason: "La règle de cette étape n'existe plus" };
    if (!ruleCoversKind(rule, ctx.kind)) return { pass: false, reason: `La règle « ${rule.name} » ne vise pas ce canal` };
    if (!ruleMatchesText(rule, ctx.text)) return { pass: false, reason: `Le message ne correspond pas à « ${rule.name} »` };
    return { pass: true };
  }
  if (step.type === "MIN_SCORE") {
    if (ctx.leadScore === null) return { pass: false, reason: "Aucun lead associé à ce message" };
    if (ctx.leadScore < step.config.min) return { pass: false, reason: `Note ${ctx.leadScore} : en dessous de ${step.config.min}` };
    return { pass: true };
  }
  return { pass: true };
}

// « Rasoa : Bonjour, c'est combien… » : sur quoi a porté l'exécution
export function subjectOf(author: string, text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return `${author} : ${t.length > 90 ? `${t.slice(0, 89)}…` : t}`;
}

// Un pipeline s'applique-t-il à cet événement ?
export function appliesTo(p: { isActive: boolean; trigger: string; accountId: string | null }, event: { trigger: string; accountId: string }): boolean {
  return p.isActive && p.trigger === event.trigger && (p.accountId === null || p.accountId === event.accountId);
}
