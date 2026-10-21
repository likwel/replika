import { useSyncExternalStore } from "react";
import { ApiError } from "./api";
import { REPLY_CREDIT_CODES } from "./billing.api";

// Ouvre la fenêtre d'achat de crédits de réponses automatiques depuis n'importe où (en-tête, bandeau,
// facturation, automatisation, erreur de quota). Affichée par <BuyReplyCreditsHost />, monté une fois dans AppLayout.

interface State {
  open: boolean;
  reason: string | null; // pourquoi la fenêtre s'ouvre (quota du mois atteint, abonnement terminé…)
}

let state: State = { open: false, reason: null };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

export const replyCredits = {
  open: (reason?: string) => set({ open: true, reason: reason ?? null }),
  close: () => set({ open: false, reason: null }),
};

export function useReplyCreditsDialog() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// Erreur « plus de réponses IA » (quota du mois, abonnement terminé sans crédit) : propose la recharge
export function offerReplyCredits(e: unknown) {
  if (e instanceof ApiError && e.code && REPLY_CREDIT_CODES.includes(e.code)) replyCredits.open(e.message);
}
