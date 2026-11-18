import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Clock, CornerDownLeft, Search, SearchX, X } from "lucide-react";
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
// Tous les onglets : sert à retrouver les pages récentes
const ALL_HITS: MenuSearchHit[] = MENUS.flatMap((m) => m.sub.map((label, index) => ({ menuLabel: m.label, label: index === 0 ? m.label : label, menuId: m.id, index, icon: m.icon, color: m.color })));

const RECENT_KEY = "cmdk.recent";
const MAX_RECENT = 4;
const keyOf = (h: Pick<MenuSearchHit, "menuId" | "index">) => `${h.menuId}:${h.index}`;

const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const pushRecent = (h: MenuSearchHit) => {
  try {
    const next = [keyOf(h), ...readRecent().filter((k) => k !== keyOf(h))].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : les récents sont facultatifs */
  }
};

// Insensible à la casse et aux accents, comme la recherche
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Met en gras la partie du libellé qui correspond à la saisie
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const f = fold(text);
  const at = q && f.length === text.length ? f.indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-transparent font-bold" style={{ color: "var(--brand-ink)" }}>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-md px-1.5 text-[10.5px] font-semibold" style={{ background: "var(--surface-3)", color: theme.textMuted }}>{children}</kbd>
);

interface Section { title: string; items: MenuSearchHit[] }

// Recherche rapide façon Notion (Ctrl/⌘ K) : pages et onglets, au clavier
export function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { canMenu } = useAccess();
  const searching = query.trim().length > 0;

  // Membre d'équipe : seuls les modules autorisés sont proposés
  const sections = useMemo<Section[]>(() => {
    const allowed = (h: MenuSearchHit) => canMenu(h.menuId, h.index);
    if (searching) return [{ title: "Résultats", items: searchMenus(query).filter(allowed) }];
    const rec = recent.map((k) => ALL_HITS.find((h) => keyOf(h) === k)).filter((h): h is MenuSearchHit => !!h && allowed(h));
    const recKeys = new Set(rec.map(keyOf));
    const pages = ALL_PAGES.filter((h) => allowed(h) && !recKeys.has(keyOf(h)));
    return [...(rec.length ? [{ title: "Récents", items: rec }] : []), { title: rec.length ? "Toutes les pages" : "Pages", items: pages }];
  }, [query, searching, recent, canMenu]);

  const results = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setRecent(readRecent());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const go = (hit: MenuSearchHit | undefined) => {
    if (!hit) return;
    pushRecent(hit);
    onNavigate(hit.menuId, hit.index);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[index]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let n = -1; // rang continu des lignes, d'une section à l'autre

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[8vh] sm:px-4 sm:pt-[12vh]"
      style={{ background: "rgba(15, 15, 15, 0.45)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="animate-panel-in w-full max-w-[640px] overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher"
      >
        <div className="flex h-14 items-center gap-3 px-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <Search size={18} className="flex-shrink-0" style={{ color: "var(--brand-ink)" }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une page, un onglet…"
            aria-label="Rechercher une page ou un onglet"
            className="min-w-0 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-[var(--color-placeholder)]"
            style={{ color: theme.text }}
          />
          {searching ? (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              aria-label="Effacer la recherche"
              className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full"
              style={{ background: "var(--surface-3)", color: theme.textMuted }}
            >
              <X size={13} />
            </button>
          ) : (
            <span className="hidden flex-shrink-0 sm:inline"><Kbd>Échap</Kbd></span>
          )}
        </div>

        <div ref={listRef} className="max-h-[56vh] overflow-y-auto px-2 pb-2 pt-1" role="listbox">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: "var(--surface-3)", color: theme.textMuted }}><SearchX size={20} /></span>
              <p className="text-[14px] font-semibold" style={{ color: theme.text }}>Aucun résultat pour « {query.trim()} »</p>
              <p className="text-[13px]" style={{ color: theme.textMuted }}>Essayez un autre mot : « règles », « statistiques », « facturation »…</p>
            </div>
          ) : (
            sections.map((s) =>
              s.items.length === 0 ? null : (
                <Fragment key={s.title}>
                  <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: theme.textMuted }}>
                    {s.title === "Récents" && <Clock size={11} />}
                    {s.title}
                  </p>
                  {s.items.map((r) => {
                    const i = ++n;
                    const on = i === index;
                    const isTab = r.label !== r.menuLabel;
                    return (
                      <button
                        key={keyOf(r)}
                        role="option"
                        aria-selected={on}
                        data-index={i}
                        onMouseMove={() => setIndex(i)}
                        onClick={() => go(r)}
                        className="relative flex h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left"
                        style={{ background: on ? "color-mix(in srgb, var(--brand-2) 9%, var(--surface))" : "transparent", color: theme.text }}
                      >
                        {on && <span className="absolute inset-y-2.5 start-0 w-[3px] rounded-full" style={{ background: "var(--brand-2)" }} aria-hidden />}
                        <span className="ico-tile" style={{ width: 32, height: 32, borderRadius: 9 }}>
                          <r.icon size={16} strokeWidth={2.1} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold leading-tight"><Highlight text={r.label} query={query} /></span>
                          {searching && isTab && <span className="block truncate text-[12px] leading-tight" style={{ color: theme.textMuted }}>dans {r.menuLabel}</span>}
                        </span>
                        {searching && <span className="chip off flex-shrink-0 !text-[10.5px]">{isTab ? "Onglet" : "Page"}</span>}
                        {on && <CornerDownLeft size={14} className="flex-shrink-0" style={{ color: "var(--brand-ink)" }} />}
                      </button>
                    );
                  })}
                </Fragment>
              ),
            )
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 text-[12px]" style={{ borderTop: `1px solid ${theme.border}`, background: "var(--surface-2)", color: theme.textMuted }}>
          <span className="flex items-center gap-1.5"><Kbd><ArrowUp size={11} /></Kbd><Kbd><ArrowDown size={11} /></Kbd>naviguer</span>
          <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft size={11} /></Kbd>ouvrir</span>
          <span className="ms-auto hidden items-center gap-1.5 sm:flex"><Kbd>Échap</Kbd>fermer</span>
        </div>
      </div>
    </div>
  );
}
