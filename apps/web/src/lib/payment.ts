import { useSyncExternalStore } from "react";

// Paiement Papi dans une fenêtre à part : la page principale reste ouverte, suit le paiement
// (<PaymentHost /> dans AppLayout) et affiche le résultat. La fenêtre Papi revient sur /paiement/retour,
// qui prévient la page principale (postMessage + BroadcastChannel) puis se ferme.

export const PAYMENT_CHANNEL = "suiteflow-payment";
export const PAYMENT_MESSAGE = "suiteflow:payment";
export const BILLING_UPDATED = "suiteflow:billing-updated"; // événement window : formule ou crédit modifiés

export interface PaymentInfo {
  label: string; // « Formule Pro · mensuel », « 5 h de Live Manager »
  amount?: number;
}

interface State {
  open: boolean;
  reference: string | null;
  link: string | null;
  info: PaymentInfo | null;
}

let state: State = { open: false, reference: null, link: null, info: null };
let popup: Window | null = null;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

const WIDTH = 480;
const HEIGHT = 760;

function openPopup(url = "about:blank"): Window | null {
  const left = Math.max(0, window.screenX + (window.outerWidth - WIDTH) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - HEIGHT) / 2);
  return window.open(url, "suiteflow-papi", `popup=yes,width=${WIDTH},height=${HEIGHT},left=${left},top=${top}`);
}

function showLoading(win: Window) {
  try {
    win.document.title = "Paiement sécurisé…";
    win.document.body.innerHTML =
      '<div style="font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#54656F;background:#F7F8FA">' +
      '<div style="text-align:center"><div style="width:34px;height:34px;margin:0 auto 14px;border:3px solid #D1F4E0;border-top-color:#00A884;border-radius:50%;animation:s 0.8s linear infinite"></div>' +
      "Ouverture du paiement sécurisé Papi…</div></div><style>@keyframes s{to{transform:rotate(360deg)}}</style>";
  } catch {
    // fenêtre déjà passée sur un autre domaine : rien à afficher
  }
}

export const payment = {
  // À appeler directement dans le gestionnaire de clic : la fenêtre s'ouvre avant l'appel à l'API,
  // sinon le navigateur la bloque. Sans fenêtre possible (bloqueur), on bascule sur une redirection.
  async start(create: () => Promise<{ reference: string; paymentLink: string }>, info: PaymentInfo) {
    const win = openPopup();
    if (win) showLoading(win);
    let res: { reference: string; paymentLink: string };
    try {
      res = await create();
    } catch (e) {
      win?.close();
      throw e;
    }
    if (!win || win.closed) {
      window.location.href = res.paymentLink;
      return;
    }
    win.location.href = res.paymentLink;
    popup = win;
    set({ open: true, reference: res.reference, link: res.paymentLink, info });
  },

  // Lien déjà créé (paiement en attente) : rouvert dans la fenêtre
  resume(reference: string, link: string, info: PaymentInfo) {
    return payment.start(async () => ({ reference, paymentLink: link }), info);
  },

  reopen() {
    if (!state.link) return;
    if (popup && !popup.closed) return popup.focus();
    popup = openPopup(state.link);
    if (!popup) window.location.href = state.link;
  },

  popupClosed: () => !popup || popup.closed,

  finish() {
    if (popup && !popup.closed) popup.close();
    popup = null;
    set({ open: false, reference: null, link: null, info: null });
  },
};

export function usePayment() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
