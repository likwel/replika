// Suivi de la consommation du modèle IA : coût estimé, part du budget consommée, seuils d'alerte. Logique pure.

export interface TokenUsage { inputTokens: number; outputTokens: number; cachedTokens: number; reasoningTokens: number }

export interface AiUsageSettings {
  // Prix du fournisseur, en dollars par million de tokens (à saisir : ils changent d'un modèle à l'autre)
  inputPerM: number;
  outputPerM: number;
  cachedPerM: number | null; // null : le cache est facturé comme l'entrée
  usdToAr: number; // pour afficher le coût en ariary
  // Limites mensuelles (null : pas de limite)
  monthlyBudgetUsd: number | null;
  monthlyTokenLimit: number | null;
  alertPercent: number; // 1er seuil d'alerte par e-mail (le 2e est 100 %)
}

// Entrée non servie par le cache × prix d'entrée + cache × prix du cache + sortie × prix de sortie
export function costOf(u: TokenUsage, s: Pick<AiUsageSettings, "inputPerM" | "outputPerM" | "cachedPerM">): number {
  const cached = Math.min(u.cachedTokens, u.inputTokens);
  const fresh = u.inputTokens - cached;
  return (fresh * s.inputPerM + cached * (s.cachedPerM ?? s.inputPerM) + u.outputTokens * s.outputPerM) / 1_000_000;
}

export interface MonthTotals { inputTokens: number; outputTokens: number; costUsd: number }

// Part de la limite consommée : la plus avancée des deux limites (budget en dollars, tokens), en pourcentage
export function percentUsed(t: MonthTotals, s: Pick<AiUsageSettings, "monthlyBudgetUsd" | "monthlyTokenLimit">): number | null {
  const parts: number[] = [];
  if (s.monthlyBudgetUsd && s.monthlyBudgetUsd > 0) parts.push((t.costUsd / s.monthlyBudgetUsd) * 100);
  if (s.monthlyTokenLimit && s.monthlyTokenLimit > 0) parts.push(((t.inputTokens + t.outputTokens) / s.monthlyTokenLimit) * 100);
  return parts.length ? Math.max(...parts) : null;
}

// Seuil à signaler maintenant : le plus haut atteint (alertPercent, puis 100) s'il dépasse celui déjà envoyé ce mois-ci
export function nextAlertLevel(percent: number | null, alertPercent: number, lastSent: number): number | null {
  if (percent === null) return null;
  const levels = [...new Set([Math.min(99, Math.max(1, Math.round(alertPercent))), 100])].sort((a, b) => a - b);
  const reached = levels.filter((l) => percent >= l).pop();
  return reached !== undefined && reached > lastSent ? reached : null;
}

// Réponse d'une API compatible OpenAI → tokens (champs absents : zéro)
export function usageFromResponse(data: unknown): TokenUsage | null {
  const u = (data as { usage?: Record<string, unknown> } | null)?.usage;
  if (!u) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  const input = n(u.prompt_tokens ?? u.input_tokens);
  const output = n(u.completion_tokens ?? u.output_tokens);
  const inD = (u.prompt_tokens_details ?? u.input_tokens_details) as Record<string, unknown> | undefined;
  const outD = (u.completion_tokens_details ?? u.output_tokens_details) as Record<string, unknown> | undefined;
  if (!input && !output) return null;
  return { inputTokens: input, outputTokens: output, cachedTokens: n(inD?.cached_tokens), reasoningTokens: n(outD?.reasoning_tokens) };
}
