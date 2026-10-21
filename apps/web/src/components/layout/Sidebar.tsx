import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, ChevronRight, ChevronsLeft, History, Inbox, Search, Settings, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { StatusDot } from "@/components/ui/StatusDot";
import { MENUS } from "@/data/menus";
import { getRenderedSub } from "@/lib/menu";
import { useOnline } from "@/hooks/useOnline";
import type { Menu } from "@/types";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const SECTIONS: Array<{ label: string; ids: string[] }> = [
  { label: "Espace de travail", ids: ["hub", "conn"] },
  { label: "Ventes", ids: ["live", "market", "leads"] },
  { label: "Automatisation", ids: ["plan", "auto"] },
  { label: "Analyse", ids: ["stat"] },
];

interface Props {
  active: string;
  sub: number;
  attention: number;
  onNavigate: (menuId: string, sub: number) => void;
  onOpenSearch: () => void;
  onCollapse: () => void;
}

export function Sidebar({ active, sub, attention, onNavigate, onOpenSearch, onCollapse }: Props) {
  const online = useOnline();
  const isAdmin = useAuth().user?.role === "ADMIN";
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([active]));

  // Le menu ouvert est toujours déplié
  useEffect(() => {
    setExpanded((s) => (s.has(active) ? s : new Set(s).add(active)));
  }, [active]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const byId = (id: string) => MENUS.find((m) => m.id === id && !m.hidden);
  const listed = new Set(SECTIONS.flatMap((s) => s.ids));
  const others = MENUS.filter((m) => !m.hidden && !listed.has(m.id));
  const sections = [
    ...SECTIONS.map((s) => ({ label: s.label, menus: s.ids.map(byId).filter((m): m is Menu => Boolean(m)) })),
    ...(others.length ? [{ label: "Autres", menus: others }] : []),
  ];

  return (
    <aside className="group flex h-full w-[248px] flex-col" style={{ background: theme.sidebar, borderRight: `1px solid ${theme.border}` }}>
      {/* Espace de travail */}
      <div className="flex items-center gap-1 px-2 pb-1 pt-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
          <LogoMark size={22} />
          <Wordmark size={15} />
        </div>
        <button
          onClick={onCollapse}
          className="rounded-md p-1 transition-opacity hover:bg-black/5 md:opacity-0 md:group-hover:opacity-100"
          title="Masquer la barre latérale"
          aria-label="Masquer la barre latérale"
        >
          <ChevronsLeft size={17} style={{ color: theme.textMuted }} />
        </button>
      </div>

      {/* Accès rapides */}
      <div className="flex flex-col gap-px px-2">
        <Row icon={Search} label="Rechercher" onClick={onOpenSearch} trailing={<Kbd>{IS_MAC ? "⌘K" : "Ctrl K"}</Kbd>} />
        <Row
          icon={Inbox}
          label="À traiter"
          active={active === "hub" && sub === 2}
          onClick={() => onNavigate("hub", 2)}
          trailing={
            attention > 0 && (
              <span className="rounded px-1.5 text-[11px] font-semibold leading-[18px]" style={{ background: theme.red, color: "#fff" }}>
                {attention > 99 ? "99+" : attention}
              </span>
            )
          }
        />
        <Row icon={History} label="Historique" active={active === "hist"} onClick={() => onNavigate("hist", 0)} />
      </div>

      {/* Arborescence */}
      <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
        {sections.map((section) => (
          <div key={section.label} className="mt-3">
            <p className="mb-0.5 px-2 text-[12px] font-medium" style={{ color: theme.textMuted }}>{section.label}</p>
            {section.menus.map((m) => (
              <TreeItem
                key={m.id}
                menu={m}
                active={active}
                sub={sub}
                expanded={expanded.has(m.id)}
                onToggle={() => toggle(m.id)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-px px-2 py-2" style={{ borderTop: `1px solid ${theme.border}` }}>
        {isAdmin && <Row icon={ShieldCheck} label="Administration" active={active === "admin"} onClick={() => onNavigate("admin", 0)} />}
        <Row icon={Settings} label="Paramètres" active={active === "set"} onClick={() => onNavigate("set", 0)} />
        <a href="/guide" target="_blank" rel="noreferrer" className="block">
          <Row icon={BookOpen} label="Guide d'utilisation" />
        </a>
        <p className="flex items-center gap-2 px-2.5 py-1 text-[12px]" style={{ color: online ? theme.green : theme.textMuted }}>
          <StatusDot color={online ? theme.greenLight : theme.textMuted} size={7} pulse={online} />
          {online ? "En ligne" : "Hors ligne"}
        </p>
      </div>
    </aside>
  );
}

// Raccourci clavier : inutile sur écran tactile (tiroir mobile), masqué en petit écran
function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="hidden rounded px-1 text-[10.5px] font-medium md:inline" style={{ color: theme.textMuted, boxShadow: `inset 0 0 0 1px ${theme.border}` }}>
      {children}
    </span>
  );
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}

function Row({ icon: Icon, label, active, onClick, trailing }: RowProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-[30px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[14px] transition-colors hover:bg-black/5"
      style={{ background: active ? theme.active : undefined, color: active ? theme.text : theme.textMuted, fontWeight: active ? 500 : 400 }}
    >
      <Icon size={17} className="flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

interface TreeItemProps {
  menu: Menu;
  active: string;
  sub: number;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (menuId: string, sub: number) => void;
}

function TreeItem({ menu, active, sub, expanded, onToggle, onNavigate }: TreeItemProps) {
  const isActive = active === menu.id;
  const items = getRenderedSub(menu);
  const leaf = items.length <= 1; // une seule vue : pas de sous-pages à déplier
  const open = expanded && !leaf;
  // Ouvert et déplié : la sous-page courante porte la surbrillance, pas le parent
  const highlight = isActive && !open;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate(menu.id, 0)}
        onKeyDown={(e) => e.key === "Enter" && onNavigate(menu.id, 0)}
        className="flex h-[30px] cursor-pointer items-center gap-1 rounded-md pl-1 pr-2 text-[14px] transition-colors hover:bg-black/5"
        style={{ background: highlight ? theme.active : undefined, color: isActive ? theme.text : theme.textMuted, fontWeight: isActive ? 500 : 400 }}
      >
        {leaf ? (
          <span className="h-5 w-5 flex-shrink-0" />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-black/5"
            aria-label={open ? `Replier ${menu.label}` : `Déplier ${menu.label}`}
            aria-expanded={open}
          >
            <ChevronRight size={13} className="transition-transform duration-150" style={{ transform: open ? "rotate(90deg)" : undefined }} />
          </button>
        )}
        <menu.icon size={17} className="flex-shrink-0" style={{ color: isActive ? menu.color : undefined }} />
        <span className="ml-1 min-w-0 flex-1 truncate">{menu.label}</span>
      </div>

      {open && (
        <div className="flex flex-col gap-px pb-1">
          {items.map((item) => {
            const subActive = item.menuId === active && item.index === sub;
            return (
              <button
                key={`${item.menuId}-${item.index}`}
                onClick={() => onNavigate(item.menuId, item.index)}
                className="flex h-[28px] w-full items-center rounded-md pl-[38px] pr-2 text-left text-[13.5px] transition-colors hover:bg-black/5"
                style={{ background: subActive ? theme.active : undefined, color: subActive ? theme.text : theme.textMuted, fontWeight: subActive ? 500 : 400 }}
              >
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
