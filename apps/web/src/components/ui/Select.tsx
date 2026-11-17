import {
  Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ChangeEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEventHandler, type ReactElement, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { theme } from "@/theme";

// Remplaçant de <select> avec recherche : mêmes <option> en enfants, même onChange (e.target.value), mêmes classes.
// Le bouton garde l'apparence et la taille du champ qu'il remplace ; la liste s'ouvre dans un portail (jamais coupée par
// une carte ou un tableau défilant), avec un champ de recherche insensible à la casse et aux accents.

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

interface Props {
  value: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode; // <option value="…">Libellé</option>
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
  name?: string;
  title?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>; // ex. stopPropagation quand le champ est dans une ligne cliquable
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : ""))
    .join("");

function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  const walk = (nodes: ReactNode) =>
    Children.forEach(nodes, (n) => {
      if (!isValidElement(n)) return;
      const el = n as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
      if (el.type === "option") {
        const label = textOf(el.props.children);
        out.push({ value: el.props.value !== undefined ? String(el.props.value) : label, label, disabled: Boolean(el.props.disabled) });
      } else if (el.props?.children) walk(el.props.children); // optgroup, fragment…
    });
  walk(children);
  return out;
}

export function Select({ value, onChange, children, className = "", style, disabled, id, name, title, onClick, placeholder = "Rechercher…", ...rest }: Props) {
  const options = useMemo(() => readOptions(children), [children]);
  const selected = options.find((o) => o.value === String(value));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);

  const shown = useMemo(() => {
    const f = fold(q.trim());
    return f ? options.filter((o) => fold(o.label).includes(f)) : options;
  }, [options, q]);

  const close = (focus = false) => {
    setOpen(false);
    setQ("");
    if (focus) btn.current?.focus();
  };

  const pick = (o: Opt) => {
    if (o.disabled) return;
    onChange?.({ target: { value: o.value, name: name ?? "" }, currentTarget: { value: o.value, name: name ?? "" } } as unknown as ChangeEvent<HTMLSelectElement>);
    close(true);
  };

  // Position : sous le bouton, ou au-dessus s'il manque de la place ; au moins aussi large que le bouton
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 220), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const below = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    const maxH = Math.max(160, Math.min(360, below ? spaceBelow : spaceAbove));
    setPos({ left, width, maxH, top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - Math.min(maxH, 360)) });
  }, [open, options.length]);

  // Ouverture : l'option choisie est active et visible
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, shown.findIndex((o) => o.value === String(value)));
    setActive(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, pos]);

  // Fermeture : clic extérieur, redimensionnement, défilement hors de la liste
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const onScroll = (e: Event) => {
      if (pop.current && e.target instanceof Node && pop.current.contains(e.target)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const onKeys = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, shown.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Tab") close();
  };

  const listId = `${id ?? "sel"}-list`;

  return (
    <>
      <button
        ref={btn}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest["aria-label"]}
        onClick={(e) => {
          onClick?.(e);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex min-h-[2.25rem] min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        style={style}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ""}</span>
        <ChevronDown size={15} className={`flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} style={{ color: theme.textMuted }} />
      </button>

      {open &&
        createPortal(
          <div
            ref={pop}
            className="pop fixed z-[95] flex flex-col overflow-hidden rounded-[14px]"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? 220, maxHeight: pos?.maxH ?? 320, visibility: pos ? "visible" : "hidden", transformOrigin: "top left" }}
            onKeyDown={(e) => {
              e.stopPropagation();
              onKeys(e);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-none p-2" style={{ borderBottom: "1px solid var(--line)" }}>
              {/* Champ sans cadre ni halo au focus : le curseur clignote simplement dans la zone grise */}
              <label className="flex h-9 items-center gap-2 rounded-[11px] px-2.5" style={{ background: "var(--surface-2)" }}>
                <Search size={14} className="flex-shrink-0" style={{ color: theme.textMuted }} />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                  }}
                  placeholder={placeholder}
                  aria-label="Rechercher dans la liste"
                  role="searchbox"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px]"
                  style={{ color: theme.text, outline: "none", boxShadow: "none" }}
                />
              </label>
            </div>
            <ul ref={list} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {shown.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px]" style={{ color: theme.textMuted }}>Aucun résultat</li>
              ) : (
                shown.map((o, i) => {
                  const on = o.value === String(value);
                  return (
                    <li key={`${o.value}-${i}`} data-i={i} role="option" aria-selected={on} aria-disabled={o.disabled || undefined}>
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={o.disabled}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(o)}
                        className="flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[13px] transition-colors disabled:opacity-40"
                        style={{
                          background: i === active ? "var(--surface-3)" : "transparent",
                          color: on ? "var(--brand-ink)" : theme.text,
                          fontWeight: on ? 700 : 500,
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {on && <Check size={15} strokeWidth={2.6} className="flex-shrink-0" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
