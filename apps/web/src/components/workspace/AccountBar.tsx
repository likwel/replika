import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { theme } from "@/theme";
import { PlatIcon } from "@/components/ui/PlatIcon";
import type { MetaPlatform, WsAccount } from "@/lib/workspace.api";
import { AccountAvatar } from "./AccountAvatar";

interface Props {
  accounts: WsAccount[];
  selected: string[]; // vide = tous les comptes
  onChange: (ids: string[]) => void;
}

// Filtre multi-comptes : un clic ajoute ou retire un compte de la sélection
export function AccountBar({ accounts, selected, onChange }: Props) {
  const all = selected.length === 0;
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Flèches : visibles quand toutes les Pages ne tiennent pas sur la largeur
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
    return () => ro.disconnect();
  }, [accounts.length]);
  const scroll = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });
  const overflow = edges.left || edges.right;
  const arrow = (dir: -1 | 1) => {
    const enabled = dir < 0 ? edges.left : edges.right;
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={() => scroll(dir)}
        disabled={!enabled}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full shadow-sm transition-opacity disabled:opacity-30"
        style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
        aria-label={dir < 0 ? "Pages précédentes" : "Pages suivantes"}
      >
        <Icon size={16} style={{ color: theme.text }} />
      </button>
    );
  };

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    // Tout cocher revient à « Tous les comptes »
    onChange(next.length === accounts.length ? [] : next);
  };

  // Raccourcis par réseau, proposés seulement quand les deux sont connectés
  const platforms: Array<{ id: MetaPlatform; label: string; icon: "fb" | "ig" }> = [
    { id: "FACEBOOK", label: "Facebook", icon: "fb" },
    { id: "INSTAGRAM", label: "Instagram", icon: "ig" },
  ];
  const idsOf = (p: MetaPlatform) => accounts.filter((a) => a.platform === p).map((a) => a.id);
  const showPlatforms = platforms.every((p) => idsOf(p.id).length > 0);
  const isPlatform = (p: MetaPlatform) => {
    const ids = idsOf(p);
    return !all && selected.length === ids.length && ids.every((id) => selected.includes(id));
  };

  const chip = (active: boolean) => ({
    background: active ? theme.bgDark : theme.bgCard,
    color: active ? "#fff" : theme.text,
    border: `1px solid ${active ? theme.bgDark : theme.border}`,
  });

  return (
    <div className="flex items-center gap-1.5">
      {overflow && arrow(-1)}
      <div ref={scroller} onScroll={measure} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5" role="group" aria-label="Comptes affichés">
        <button
          onClick={() => onChange([])}
          className="flex flex-shrink-0 items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-sm font-medium transition-all"
          style={chip(all)}
          aria-pressed={all}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: all ? "rgba(255,255,255,0.12)" : theme.bg }}>
            <Layers size={13} style={{ color: all ? theme.goldLight : theme.textMuted }} />
          </span>
          Tous les comptes
        </button>

        {showPlatforms &&
          platforms.map((p) => {
            const active = isPlatform(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onChange(active ? [] : idsOf(p.id))}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                style={chip(active)}
                aria-pressed={active}
                title={`Tous les comptes ${p.label}`}
              >
                <PlatIcon p={p.icon} size={14} />
                {p.label}
              </button>
            );
          })}
        {showPlatforms && <span className="my-1.5 w-px flex-shrink-0" style={{ background: theme.border }} aria-hidden />}

        {accounts.map((a) => {
          const active = !all && selected.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className="flex flex-shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-all"
              style={chip(active)}
              aria-pressed={active}
              title={a.syncError ?? a.accountName}
            >
              <AccountAvatar name={a.accountName} src={a.accountAvatar} platform={a.platform} size={26} />
              <span className="max-w-[140px] truncate">{a.accountName}</span>
              {a.syncError && <AlertTriangle size={13} style={{ color: active ? "#F5A097" : theme.red }} />}
              {a.pending > 0 && (
                <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: theme.gold, color: "#1A1410" }}>
                  {a.pending}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {overflow && arrow(1)}
    </div>
  );
}
