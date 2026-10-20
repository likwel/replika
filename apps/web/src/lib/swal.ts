// Boîtes de dialogue et notifications de l'application (à la place de window.alert / window.confirm).
// Appelables depuis n'importe où, y compris hors d'un composant : `if (!(await swal.confirm({...}))) return;`
// L'affichage est assuré par <SwalHost />, monté une seule fois (main.tsx).

export type SwalVariant = "danger" | "warning" | "question" | "info" | "success" | "error";
export type ToastVariant = "success" | "error" | "warning" | "info";

export interface SwalDialog {
  id: number;
  kind: "confirm" | "alert";
  variant: SwalVariant;
  title: string;
  text?: string;
  confirmText: string;
  cancelText: string;
  resolve: (confirmed: boolean) => void;
}

export interface SwalToast {
  id: number;
  variant: ToastVariant;
  title: string;
  text?: string;
}

interface State {
  dialogs: SwalDialog[]; // file d'attente : une seule boîte affichée à la fois
  toasts: SwalToast[];
}

let state: State = { dialogs: [], toasts: [] };
const listeners = new Set<() => void>();
let seq = 0;

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const swalStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  close(id: number, confirmed: boolean) {
    const dialog = state.dialogs.find((d) => d.id === id);
    if (!dialog) return;
    set({ ...state, dialogs: state.dialogs.filter((d) => d.id !== id) });
    dialog.resolve(confirmed);
  },
  dismissToast(id: number) {
    set({ ...state, toasts: state.toasts.filter((t) => t.id !== id) });
  },
};

const open = (dialog: Omit<SwalDialog, "id" | "resolve">) =>
  new Promise<boolean>((resolve) => set({ ...state, dialogs: [...state.dialogs, { ...dialog, id: ++seq, resolve }] }));

interface ConfirmOptions {
  title: string;
  text?: string;
  confirmText?: string; // préférer le verbe de l'action (« Supprimer ») à « OK »
  cancelText?: string;
  variant?: "danger" | "warning" | "question";
}

interface AlertOptions {
  title: string;
  text?: string;
  confirmText?: string;
  variant?: "info" | "success" | "warning" | "error";
}

interface ToastOptions {
  title: string;
  text?: string;
  variant?: ToastVariant;
  duration?: number; // ms
}

export const swal = {
  // Résout true si la personne confirme ; false si elle annule (bouton, Échap, clic à côté)
  confirm: (o: ConfirmOptions) =>
    open({
      kind: "confirm",
      variant: o.variant ?? "question",
      title: o.title,
      text: o.text,
      confirmText: o.confirmText ?? "Confirmer",
      cancelText: o.cancelText ?? "Annuler",
    }),

  alert: (o: AlertOptions) =>
    open({ kind: "alert", variant: o.variant ?? "info", title: o.title, text: o.text, confirmText: o.confirmText ?? "OK", cancelText: "" }).then(
      () => undefined
    ),

  // Notification discrète en haut à droite, qui disparaît seule
  toast: (o: ToastOptions) => {
    const id = ++seq;
    set({ ...state, toasts: [...state.toasts, { id, variant: o.variant ?? "success", title: o.title, text: o.text }] });
    setTimeout(() => swalStore.dismissToast(id), o.duration ?? 3500);
  },
};
