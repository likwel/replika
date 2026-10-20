import { useEffect, useRef, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "./Button";
import { swalStore, type SwalDialog, type SwalToast, type SwalVariant, type ToastVariant } from "@/lib/swal";

const LOOK: Record<SwalVariant, { icon: LucideIcon; color: string; bg: string }> = {
  danger: { icon: AlertTriangle, color: theme.red, bg: theme.dangerBg },
  error: { icon: XCircle, color: theme.red, bg: theme.dangerBg },
  warning: { icon: AlertTriangle, color: theme.amber, bg: theme.amberSoft },
  question: { icon: HelpCircle, color: theme.goldDark, bg: theme.goldSoft },
  info: { icon: Info, color: theme.goldDark, bg: theme.goldSoft },
  success: { icon: CheckCircle2, color: theme.green, bg: theme.greenSoft },
};

const TOAST_LOOK: Record<ToastVariant, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: theme.green },
  error: { icon: XCircle, color: theme.red },
  warning: { icon: AlertTriangle, color: theme.amber },
  info: { icon: Info, color: theme.goldDark },
};

// Affiche les boîtes de dialogue et notifications demandées via `swal` (lib/swal.ts)
export function SwalHost() {
  const { dialogs, toasts } = useSyncExternalStore(swalStore.subscribe, swalStore.get);
  return (
    <>
      {dialogs[0] && <Dialog key={dialogs[0].id} dialog={dialogs[0]} />}
      {/* Toujours présente : une zone aria-live doit exister avant son contenu pour qu'il soit annoncé */}
      <div className="pointer-events-none fixed right-4 top-4 z-[110] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </div>
    </>
  );
}

function Dialog({ dialog }: { dialog: SwalDialog }) {
  const look = LOOK[dialog.variant];
  const panelRef = useRef<HTMLDivElement>(null);
  const isConfirm = dialog.kind === "confirm";
  // Alerte : la fermer vaut « OK » ; confirmation : la fermer vaut « Annuler »
  const close = (confirmed: boolean) => swalStore.close(dialog.id, confirmed);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Action destructrice : le focus part sur « Annuler », pour qu'un Entrée réflexe ne supprime rien
    const initial = dialog.variant === "danger" ? "[data-swal-cancel]" : "[data-swal-confirm]";
    panelRef.current?.querySelector<HTMLElement>(initial)?.focus();

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Phase de capture : la touche est traitée ici avant une fenêtre ouverte dessous (Modal se ferme aussi sur Échap)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(!isConfirm);
      } else if (e.key === "Tab") {
        const buttons = panelRef.current?.querySelectorAll<HTMLElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 15, 15, 0.5)" }}
      onMouseDown={(e) => e.target === e.currentTarget && close(!isConfirm)}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`swal-title-${dialog.id}`}
        aria-describedby={dialog.text ? `swal-text-${dialog.id}` : undefined}
        className="animate-swal-in w-full max-w-[400px] rounded-3xl px-6 pb-6 pt-7 text-center shadow-2xl"
        style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
      >
        <div className="relative mx-auto mb-4 h-14 w-14">
          <span className="animate-swal-ring absolute inset-0 rounded-full" style={{ background: look.bg }} />
          <span className="animate-swal-icon relative flex h-14 w-14 items-center justify-center rounded-full" style={{ background: look.bg }}>
            <look.icon size={26} strokeWidth={2.2} style={{ color: look.color }} />
          </span>
        </div>

        <h2 id={`swal-title-${dialog.id}`} className="text-lg font-semibold tracking-[-0.01em]" style={{ color: theme.text }}>
          {dialog.title}
        </h2>
        {dialog.text && (
          <p id={`swal-text-${dialog.id}`} className="mt-2 text-sm leading-relaxed" style={{ color: theme.textMuted }}>
            {dialog.text}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {isConfirm && (
            <Button data-swal-cancel variant="ghost" size="lg" className="w-full justify-center sm:w-auto sm:min-w-[128px]" onClick={() => close(false)}>
              {dialog.cancelText}
            </Button>
          )}
          <Button
            data-swal-confirm
            variant={dialog.variant === "danger" ? "danger" : "primary"}
            size="lg"
            className="w-full justify-center sm:w-auto sm:min-w-[128px]"
            onClick={() => close(true)}
          >
            {dialog.confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }: { toast: SwalToast }) {
  const look = TOAST_LOOK[toast.variant];
  return (
    <div
      role="status"
      className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg"
      style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
    >
      <look.icon size={18} className="mt-0.5 flex-shrink-0" style={{ color: look.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: theme.text }}>{toast.title}</p>
        {toast.text && <p className="mt-0.5 text-xs leading-relaxed" style={{ color: theme.textMuted }}>{toast.text}</p>}
      </div>
      <button onClick={() => swalStore.dismissToast(toast.id)} className="rounded-md p-0.5 hover:bg-black/5" aria-label="Fermer la notification">
        <X size={15} style={{ color: theme.textMuted }} />
      </button>
    </div>
  );
}
