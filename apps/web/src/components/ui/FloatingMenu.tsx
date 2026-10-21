import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

interface Props {
  anchor: HTMLElement | null; // bouton qui ouvre le menu
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

// Menu flottant rendu hors de la page (portail, position fixe) : jamais coupé par un tableau défilant
// ou une carte. S'ouvre sous le bouton, ou au-dessus s'il manque de place ; se ferme au clic extérieur,
// avec Échap, au défilement et au redimensionnement.
export function FloatingMenu({ anchor, onClose, children, width = 224 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const h = ref.current.offsetHeight;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    const top = below ? r.bottom + 4 : Math.max(8, r.top - h - 4);
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    setPos({ top, left });
  }, [anchor, width]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) close.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    const onMove = () => close.current();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true); // tout conteneur défilant
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="animate-panel-in fixed z-[90] rounded-xl p-1 shadow-xl"
      style={{
        width,
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
        background: theme.bgCard,
        border: `1px solid ${theme.border}`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

// Entrée de menu standard
export function MenuItem({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-black/5"
      style={{ color: danger ? theme.red : theme.text }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-1 my-1" style={{ borderTop: `1px solid ${theme.border}` }} />;
}
