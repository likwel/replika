import type { SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { graphClient, isRateLimited } from "./graph.client.js";

// debug_token se fait avec le jeton de l'app : chaque appel compte dans le plafond de l'app
// (200 appels par heure × utilisateurs actifs du jour, fenêtre glissante d'une heure). Le résultat est donc
// gardé en base 24 h : ni la relève, ni le diagnostic, ni un redémarrage du serveur ne relancent l'appel.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Au-delà de cette part du plafond consommée (en-tête X-App-Usage), on cesse d'appeler debug_token
const USAGE_PAUSE_AT = 75;
const PAUSE_MS = 30 * 60 * 1000;
// Plafond atteint : chaque appel pendant le blocage le prolonge (doc Meta), on attend donc sans insister
const BLOCKED_PAUSE_MS = 60 * 60 * 1000;

let pausedUntil = 0;

function pause(ms: number, why: string) {
  const until = Date.now() + ms;
  if (until <= pausedUntil) return;
  pausedUntil = until;
  console.warn(`⚠️ Facebook : ${why}. Vérifications des jetons suspendues jusqu'à ${new Date(until).toLocaleTimeString("fr-FR")}.`);
}

export interface TokenInfo {
  isValid: boolean | null; // null : jamais vérifié et vérification reportée (plafond)
  scopes: string[];
  error: string | null;
  checkedAt: Date | null;
}

type TokenFields = Pick<SocialAccount, "id" | "accessToken" | "tokenScopes" | "tokenValid" | "tokenCheckedAt">;

const stored = (acc: TokenFields): TokenInfo => ({ isValid: acc.tokenValid, scopes: acc.tokenScopes, error: null, checkedAt: acc.tokenCheckedAt });

// État du jeton d'un compte : relu chez Facebook seulement s'il date de plus de maxAgeMs
export async function tokenInfo(acc: TokenFields, maxAgeMs = MAX_AGE_MS): Promise<TokenInfo> {
  if (acc.tokenCheckedAt && Date.now() - acc.tokenCheckedAt.getTime() < maxAgeMs) return stored(acc);
  if (Date.now() < pausedUntil) {
    if (acc.tokenCheckedAt) return stored(acc);
    const min = Math.ceil((pausedUntil - Date.now()) / 60_000);
    throw new AppError(`Facebook limite temporairement les vérifications : réessayez dans ${min} min.`, 503, "FB_RATE_LIMIT");
  }
  try {
    const r = await graphClient.getTokenInfo(acc.accessToken);
    if (r.appUsage !== null && r.appUsage >= USAGE_PAUSE_AT) pause(PAUSE_MS, `${r.appUsage} % du plafond d'appels de l'app consommés`);
    const checkedAt = new Date();
    await prisma.socialAccount.update({ where: { id: acc.id }, data: { tokenScopes: r.scopes, tokenValid: r.isValid, tokenCheckedAt: checkedAt } });
    return { isValid: r.isValid, scopes: r.scopes, error: r.error, checkedAt };
  } catch (e) {
    if (isRateLimited(e)) {
      pause(BLOCKED_PAUSE_MS, "plafond d'appels atteint");
      if (acc.tokenCheckedAt) return stored(acc);
    }
    throw e;
  }
}
