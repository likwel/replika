import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { theme } from "@/theme";

interface Props {
  children: ReactNode;
  label: string; // nom du groupe (lecteurs d'écran, info-bulles des flèches)
  activeKey?: string | null; // l'élément marqué data-active="true" est ramené dans la vue quand cette clé change
  className?: string;
}

// Rangée défilante horizontale : flèches gauche / droite (visibles seulement si tout ne tient pas),
// bords en fondu et élément actif toujours ramené à l'écran
export function ScrollRow({ children, label, activeKey, className = "" }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = scroller.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [activeKey]);

  const scroll = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.75, behavior: "smooth" });
  const overflow = edges.left || edges.right;
  const arrow = (dir: -1 | 1) => {
    const enabled = dir < 0 ? edges.left : edges.right;
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={() => scroll(dir)}
        disabled={!enabled}
        className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full shadow-sm transition-all hover:-translate-y-px disabled:opacity-30 disabled:hover:translate-y-0"
        style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
        aria-label={dir < 0 ? `${label} : précédents` : `${label} : suivants`}
      >
        <Icon size={17} style={{ color: theme.text }} />
      </button>
    );
  };
  const fade = `linear-gradient(to right, ${edges.left ? "transparent 0, #000 28px" : "#000 0"}, ${edges.right ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%"})`;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {overflow && arrow(-1)}
      <div
        ref={scroller}
        onScroll={measure}
        className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1"
        role="group"
        aria-label={label}
        style={overflow ? { WebkitMaskImage: fade, maskImage: fade } : undefined}
      >
        {children}
      </div>
      {overflow && arrow(1)}
    </div>
  );
}
