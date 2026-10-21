import { useSyncExternalStore } from "react";
import type { PaymentRow, SubscriptionSummary } from "./billing.api";

// Fenêtre « Paiement réussi » (<PaymentSuccessHost /> dans AppLayout), ouverte depuis n'importe quel parcours de paiement

export interface PaymentSuccess {
  payment: PaymentRow;
  subscription: SubscriptionSummary;
}

let current: (PaymentSuccess & { resolve: () => void }) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const paymentSuccess = {
  // Résout quand la personne ferme la fenêtre
  show: (data: PaymentSuccess) =>
    new Promise<void>((resolve) => {
      current?.resolve();
      current = { ...data, resolve };
      emit();
    }),
  close: () => {
    const c = current;
    current = null;
    emit();
    c?.resolve();
  },
};

export function usePaymentSuccess() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
