import { useSyncExternalStore } from "react";

// Ouvre la fenêtre d'achat d'heures de Live Manager depuis n'importe où (Live, en-tête, bandeau, facturation).
// Affichée par <BuyLiveHoursHost />, monté une fois dans AppLayout.

interface State {
  open: boolean;
  reason: string | null; // pourquoi la fenêtre s'ouvre (quota atteint, abonnement expiré…)
}

let state: State = { open: false, reason: null };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

export const liveHours = {
  open: (reason?: string) => set({ open: true, reason: reason ?? null }),
  close: () => set({ open: false, reason: null }),
};

export function useLiveHoursDialog() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
