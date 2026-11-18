import { prisma } from "../../config/prisma.js";

export interface RuleAccount {
  id: string;
  name: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK";
  isActive: boolean;
  syncError: string | null;
}

// Résout les `accountIds` des règles en comptes (une seule requête). Un compte supprimé disparaît de la liste.
export async function attachAccounts<R extends { accountIds: string[] }>(rules: R[]): Promise<Array<R & { accounts: RuleAccount[] }>> {
  const ids = [...new Set(rules.flatMap((r) => r.accountIds))];
  const found = ids.length
    ? await prisma.socialAccount.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, platform: true, isActive: true, syncError: true } })
    : [];
  const byId = new Map(found.map((a) => [a.id, a]));
  return rules.map((r) => ({ ...r, accounts: r.accountIds.map((id) => byId.get(id)).filter((a): a is RuleAccount => !!a) }));
}
