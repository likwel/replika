import { useEffect, useRef, type ReactNode } from "react";
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

// Fenêtre par-dessus la page ; plein écran sur mobile, Échap pour fermer
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(28,24,19,0.55)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-h-[92vh] sm:rounded-2xl ${WIDTH[size]}`}
        style={{ background: theme.bgCard }}
      >
        <header className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="min-w-0 flex-1">
            <Title className="text-base">{title}</Title>
            {subtitle && <div className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5" aria-label="Fermer">
            <X size={18} style={{ color: theme.textMuted }} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
