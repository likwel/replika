import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { useAccess } from "@/hooks/useAccess";
import { searchMenus, type MenuSearchHit } from "@/lib/menu";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (menuId: string, sub: number) => void;
}

// Sans saisie : toutes les pages (y compris Historique et Paramètres, absents de la barre latérale)
const ALL_PAGES: MenuSearchHit[] = MENUS.map((m) => ({ menuLabel: m.label, label: m.label, menuId: m.id, index: 0, icon: m.icon, color: m.color }));

// Recherche rapide façon Notion (Ctrl/⌘ K) : pages et onglets, au clavier
export function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { canMenu } = useAccess();
  // Membre d'équipe : seuls les modules autorisés sont proposés
  const results = useMemo(() => (query.trim() ? searchMenus(query) : ALL_PAGES).filter((h) => canMenu(h.menuId, h.index)), [query, canMenu]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const go = (hit: MenuSearchHit | undefined) => hit && onNavigate(hit.menuId, hit.index);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[index]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: "rgba(15, 15, 15, 0.45)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="animate-panel-in w-full max-w-[620px] overflow-hidden rounded-xl shadow-2xl"
        style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher"
      >
        <div className="flex h-12 items-center gap-2.5 px-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <Search size={17} style={{ color: theme.textMuted }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une page, un onglet…"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: theme.text }}
          />
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
          <p className="px-4 pb-1 pt-1 text-[12px] font-medium" style={{ color: theme.textMuted }}>{query.trim() ? "Résultats" : "Pages"}</p>
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: theme.textMuted }}>Aucun résultat pour « {query} »</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.menuId}-${r.index}`}
                data-index={i}
                onMouseMove={() => setIndex(i)}
                onClick={() => go(r)}
                className="mx-1.5 flex h-9 w-[calc(100%-12px)] items-center gap-2.5 rounded-md px-2.5 text-left text-sm"
                style={{ background: i === index ? theme.hover : "transparent", color: theme.text }}
              >
                <r.icon size={16} className="flex-shrink-0" style={{ color: r.color }} />
                <span className="min-w-0 flex-1 truncate">
                  {r.label}
                  {query.trim() && r.label !== r.menuLabel && <span style={{ color: theme.textMuted }}> · {r.menuLabel}</span>}
                </span>
                {i === index && <CornerDownLeft size={14} className="flex-shrink-0" style={{ color: theme.textMuted }} />}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 text-[11.5px]" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textMuted }}>
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>Échap fermer</span>
        </div>
      </div>
    </div>
  );
}
