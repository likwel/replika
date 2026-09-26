import type { AutomationRule } from "@prisma/client";

export type IncomingKind = "COMMENT" | "DIRECT";

type MatchableRule = Pick<
  AutomationRule,
  "id" | "matchType" | "trigger" | "channel" | "accountId" | "priority" | "createdAt"
>;

// Minuscules, sans accents, espaces compactés : "Prix ?" et "prix?" deviennent comparables
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseKeywords(trigger: string): string[] {
  return trigger.split(",").map(normalize).filter(Boolean);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stripEndPunctuation = (s: string) => s.replace(/[\s!?.,;:…]+$/u, "").trim();

// Mot-clé présent en tant que mot entier : "prix" trouve "le prix ?" mais pas "prixxx"
function containsWord(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword)}([^a-z0-9]|$)`).test(text);
}

export function ruleMatchesText(rule: Pick<AutomationRule, "matchType" | "trigger">, text: string): boolean {
  if (rule.matchType === "ANY") return true;
  const t = normalize(text);
  const keywords = parseKeywords(rule.trigger);
  if (rule.matchType === "EXACT") {
    const bare = stripEndPunctuation(t);
    return keywords.some((k) => stripEndPunctuation(k) === bare);
  }
  return keywords.some((k) => containsWord(t, k));
}

// Règles applicables à ce canal / compte, dans l'ordre d'évaluation :
// mots-clés d'abord (par priorité), puis les réponses par défaut (« tout message »)
export function candidateRules<R extends MatchableRule>(
  rules: R[],
  ctx: { kind: IncomingKind; accountId: string }
): R[] {
  return rules
    .filter((r) => r.channel === "ALL" || r.channel === ctx.kind)
    .filter((r) => !r.accountId || r.accountId === ctx.accountId)
    .sort((a, b) => b.priority - a.priority || +a.createdAt - +b.createdAt)
    .sort((a, b) => Number(a.matchType === "ANY") - Number(b.matchType === "ANY"));
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// Choisit une variante au hasard (séparateur ||) et remplace {nom} / {prenom} / {page}
export function renderReply(template: string, vars: { nom: string; page: string }): string {
  const variants = template.split("||").map((v) => v.trim()).filter(Boolean);
  const chosen = variants[Math.floor(Math.random() * variants.length)] ?? "";
  return chosen
    .replace(/\{\s*(nom|prenom|prénom|page)\s*\}/gi, (_, key: string) =>
      key.toLowerCase() === "page" ? vars.page : vars.nom
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
