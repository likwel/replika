import type { PipelineStep } from "./pipeline.schema.js";
import { ruleMatchesText, type IncomingKind } from "../autoreply/autoreply.matcher.js";

// Logique pure du moteur (sans base ni réseau) : testée à part.

export const ACTION_TYPES = new Set<PipelineStep["type"]>([
  "SEND_DM", "SEND_PUBLIC_REPLY", "SET_LEAD_STATUS", "SET_LEAD_NOTE", "SET_LEAD_VALUE", "ESCALATE", "IGNORE_MESSAGE", "NOTIFY", "EMAIL_OWNER", "WEBHOOK",
]);
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
    case "KEYWORD": return `Le message contient « ${step.config.keywords} »`;
    case "CHANNEL": return step.config.kind === "DIRECT" ? "C'est un message privé" : "C'est un commentaire";
    case "PLATFORM": return step.config.platform === "INSTAGRAM" ? "Le compte est sur Instagram" : "Le compte est sur Facebook";
    case "LEAD_STATUS": return `Le lead est « ${step.config.statuses.map((x) => LEAD_STATUS_LABEL[x]).join(" ou ")} »`;
    case "LEAD_INTENT": return `L'intention du lead : ${step.config.intents.join(" ou ")}`;
    case "LEAD_CONTACT": return "Le lead a laissé un téléphone ou un e-mail";
    case "BUSINESS_HOURS": return `${step.config.mode === "INSIDE" ? "Pendant" : "En dehors de"} ${step.config.from}–${step.config.to}`;
    case "SEND_PUBLIC_REPLY": return "Répondre publiquement";
    case "SET_LEAD_NOTE": return "Ajouter une note au lead";
    case "SET_LEAD_VALUE": return `Estimer le lead à ${step.config.value} Ar`;
    case "IGNORE_MESSAGE": return "Ignorer le message";
    case "EMAIL_OWNER": return "Envoyer un e-mail au propriétaire";
    case "WEBHOOK": return "Envoyer à une adresse web";
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
  platform?: "FACEBOOK" | "INSTAGRAM" | "TIKTOK";
  lead?: { status: string; intent: string | null; phone: string | null; email: string | null } | null;
  now?: Date;
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
  if (step.type === "KEYWORD") {
    return ruleMatchesText({ matchType: step.config.mode, trigger: step.config.keywords }, ctx.text) ? { pass: true } : { pass: false, reason: `Le message ne contient pas « ${step.config.keywords} »` };
  }
  if (step.type === "CHANNEL") {
    return ctx.kind === step.config.kind ? { pass: true } : { pass: false, reason: ctx.kind === "DIRECT" ? "C'est un message privé" : "C'est un commentaire" };
  }
  if (step.type === "PLATFORM") {
    return ctx.platform === step.config.platform ? { pass: true } : { pass: false, reason: "Ce compte n'est pas sur ce réseau" };
  }
  if (step.type === "LEAD_STATUS") {
    if (!ctx.lead) return { pass: false, reason: "Aucun lead associé à ce message" };
    return step.config.statuses.some((x) => x === ctx.lead!.status) ? { pass: true } : { pass: false, reason: `Le lead est « ${LEAD_STATUS_LABEL[ctx.lead.status as keyof typeof LEAD_STATUS_LABEL] ?? ctx.lead.status} »` };
  }
  if (step.type === "LEAD_INTENT") {
    if (!ctx.lead) return { pass: false, reason: "Aucun lead associé à ce message" };
    return ctx.lead.intent && step.config.intents.some((x) => x === ctx.lead!.intent) ? { pass: true } : { pass: false, reason: `Intention du lead : ${ctx.lead.intent ?? "inconnue"}` };
  }
  if (step.type === "LEAD_CONTACT") {
    if (!ctx.lead) return { pass: false, reason: "Aucun lead associé à ce message" };
    return ctx.lead.phone || ctx.lead.email ? { pass: true } : { pass: false, reason: "Le lead n'a laissé ni téléphone ni e-mail" };
  }
  if (step.type === "BUSINESS_HOURS") {
    const inside = withinHours(ctx.now ?? new Date(), step.config.from, step.config.to);
    const ok = step.config.mode === "INSIDE" ? inside : !inside;
    return ok ? { pass: true } : { pass: false, reason: inside ? "On est dans les horaires d'ouverture" : "On est en dehors des horaires d'ouverture" };
  }
  return { pass: true };
}

// Madagascar : UTC+3 toute l'année (pas d'heure d'été)
const MADAGASCAR_OFFSET_MIN = 3 * 60;
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// L'heure (de Madagascar) est-elle entre « from » et « to » ? Une plage qui passe minuit (22:00–06:00) est gérée.
export function withinHours(now: Date, from: string, to: string): boolean {
  const cur = (now.getUTCHours() * 60 + now.getUTCMinutes() + MADAGASCAR_OFFSET_MIN) % (24 * 60);
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a === b) return true; // même heure : toute la journée
  return a < b ? cur >= a && cur < b : cur >= a || cur < b;
}

// « Rasoa : Bonjour, c'est combien… » : sur quoi a porté l'exécution
export function subjectOf(author: string, text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return `${author} : ${t.length > 90 ? `${t.slice(0, 89)}…` : t}`;
}

// Un pipeline s'applique-t-il à cet événement ?
export function appliesTo(p: { isActive: boolean; trigger: string; accountIds: string[] }, event: { trigger: string; accountId: string }): boolean {
  return p.isActive && p.trigger === event.trigger && (p.accountIds.length === 0 || p.accountIds.includes(event.accountId));
}
