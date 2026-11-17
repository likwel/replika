import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "./Title";

interface Props {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}

const WIDTH = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

// Fenêtre par-dessus la page : feuille qui monte du bas sur mobile (poignée), boîte centrée qui apparaît
// en fondu dès sm ; Échap ou clic sur le fond pour fermer
export function Modal({ title, subtitle, onClose, children, footer, size = "md" }: Props) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Portail : la fenêtre n'est plus prisonnière de la carte de la page (isolation) et recouvre toute l'interface, en-tête compris
  return createPortal(
    <div
      className="scrim fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`sheet flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[26px] sm:max-h-[92vh] sm:rounded-[22px] ${WIDTH[size]}`}>
        <div className="grab sm:hidden" aria-hidden />
        <header className="flex items-start gap-3 px-5 pb-3.5 pt-2 sm:pt-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="min-w-0 flex-1">
            <Title className="text-[17px] !font-extrabold !tracking-[-0.02em]">{title}</Title>
            {subtitle && <div className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[11px] transition-colors hover:brightness-95"
            style={{ background: theme.bg, color: theme.textMuted }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
