// Revenus d'une période ventilés par source : abonnements, crédits de réponses IA, heures de live.
// Chaque paiement porte sa propre commission, donc le net de chaque source est exact ; le coût IA et les dépenses restent globaux.

export type RevenueKind = "SUBSCRIPTION" | "REPLY_CREDITS" | "LIVE_HOURS";
export const REVENUE_KINDS: RevenueKind[] = ["SUBSCRIPTION", "REPLY_CREDITS", "LIVE_HOURS"];

export interface SourceTotals { gross: number; fees: number; net: number; count: number }

export function revenueBySource<P extends { kind: RevenueKind; amount: number }>(paid: P[], feeOf: (p: P) => number): Record<RevenueKind, SourceTotals> {
  const out = Object.fromEntries(REVENUE_KINDS.map((k) => [k, { gross: 0, fees: 0, net: 0, count: 0 }])) as Record<RevenueKind, SourceTotals>;
  for (const p of paid) {
    const t = out[p.kind];
    if (!t) continue;
    const fee = feeOf(p);
    t.gross += p.amount;
    t.fees += fee;
    t.net += p.amount - fee;
    t.count++;
  }
  return out;
}
