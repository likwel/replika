import type { ReactNode } from "react";
import {
  BookOpen, ChevronDown, ChevronsLeft, ChevronsRight, CreditCard, ExternalLink, LogOut, Monitor, Moon, ShieldCheck, Sparkles, Sun, Users, Lock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { MENUS } from "@/data/menus";
import { useAccess } from "@/hooks/useAccess";
import { usePlan } from "@/hooks/usePlan";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { THEME_LABELS } from "@/lib/themePref";
import { useSidebarCounts, type SidebarCount } from "@/hooks/useSidebarCounts";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import type { Menu } from "@/types";
import type { Feature } from "@/lib/billing.api";

// Groupes de la navigation (même découpage que pr.social : un lien par module, pas d'arborescence ;
// les sous-pages s'ouvrent par les onglets de la page)
export const SECTIONS: Array<{ label: string; ids: string[] }> = [
  { label: "Espace de travail", ids: ["hub", "queue", "conn"] },
  { label: "Ventes", ids: ["live", "market", "leads"] },
  { label: "Automatisation", ids: ["plan", "rules", "auto"] },
  { label: "Analyse", ids: ["stat", "hist"] },
];

// Modules réservés à certaines formules : pastille cadenas tant qu'elle n'est pas souscrite
const NEEDS_FEATURE: Record<string, Feature> = { leads: "leads", market: "marketplace" };

interface Props {
  active: string;
  sub: number;
  attention: number;
  collapsed: boolean; // rail d'icônes : libellés masqués, infobulle au survol
  onNavigate: (menuId: string, sub: number) => void;
  onToggle: () => void;
}

export function Sidebar({ active, sub, attention, collapsed, onNavigate, onToggle }: Props) {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { canMenu } = useAccess();
  const { can: planCan, planName, status } = usePlan();
  const { pref, toggle } = useThemeToggle();
  const isAdmin = user?.role === "ADMIN";
  const counts = useSidebarCounts();
  // Badge de statistique à droite d'une entrée (rien tant que le compteur est à zéro ou inconnu)
  const badge = (c?: SidebarCount) => (c && c.n > 0 ? <span className={`cnt ${c.tone ?? ""}`} title={c.label}>{c.n > 99 ? "99+" : c.n}</span> : null);

  const byId = (id: string) => MENUS.find((m) => m.id === id && !m.hidden && canMenu(m.id));
  const groups = SECTIONS.map((s) => ({ label: s.label, menus: s.ids.map(byId).filter((m): m is Menu => Boolean(m)) })).filter((g) => g.menus.length);

  const lockOf = (id: string) => (NEEDS_FEATURE[id] && !planCan(NEEDS_FEATURE[id]) ? <span className="cnt vio"><Lock /></span> : null);

  const handleLogout = async () => {
    await logout();
    nav("/connexion");
  };

  const expired = status === "EXPIRED";

  return (
    <aside className={`side-surface group flex h-full w-full flex-col whitespace-nowrap ${collapsed ? "side-rail" : ""}`} style={{ borderRight: "1px solid var(--line)" }}>
      {/* Marque : logo seul dans le rail, avec le bouton pour développer juste dessous */}
      <div className={collapsed ? "flex flex-col items-center gap-2 pb-3 pt-[18px]" : "flex items-center gap-1 px-[18px] pb-3 pt-[18px]"}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <LogoMark size={34} />
          {!collapsed && <Wordmark size={16} />}
        </div>
        <button
          onClick={onToggle}
          className={`grid h-8 w-8 place-items-center rounded-[10px] transition-all hover:bg-black/5 ${collapsed ? "" : "md:opacity-0 md:group-hover:opacity-100"}`}
          title={collapsed ? "Développer la barre latérale" : "Réduire la barre latérale"}
          aria-label={collapsed ? "Développer la barre latérale" : "Réduire la barre latérale"}
        >
          {collapsed ? <ChevronsRight size={17} style={{ color: theme.textMuted }} /> : <ChevronsLeft size={17} style={{ color: theme.textMuted }} />}
        </button>
      </div>

      <WorkspaceSwitcher compact={collapsed} onOpenTeam={() => onNavigate("set", 3)} onOpenProfile={() => onNavigate("set", 0)} />

      <nav className={`flex flex-1 flex-col gap-px overflow-y-auto pb-3 pt-0.5 ${collapsed ? "px-2" : "px-2.5"}`}>
        <Item rail={collapsed} icon={MENUS[0].icon} label={MENUS[0].label} on={active === "dash"} onClick={() => onNavigate("dash", 0)} />

        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-px">
            <p className="side-grp">{g.label}</p>
            {g.menus.map((m) => (
              <Item
                key={m.id}
                rail={collapsed}
                icon={m.icon}
                label={m.label}
                on={active === m.id}
                onClick={() => onNavigate(m.id, 0)}
                trailing={m.id === "queue" ? (attention > 0 ? <span className="cnt hot" title={`${attention} à traiter`}>{attention > 99 ? "99+" : attention}</span> : null) : (lockOf(m.id) ?? badge(counts[m.id as keyof typeof counts]))}
              />
            ))}
          </div>
        ))}

        <p className="side-grp">Compte</p>
        {canMenu("set") && <Item rail={collapsed} icon={MENUS.find((m) => m.id === "set")!.icon} label="Profil et sécurité" on={active === "set" && sub < 3} onClick={() => onNavigate("set", 0)} />}
        {canMenu("set", 3) && <Item rail={collapsed} icon={Users} label="Équipe" on={active === "set" && sub === 3} onClick={() => onNavigate("set", 3)} trailing={badge(counts.team)} />}
        {canMenu("set", 4) && <Item rail={collapsed} icon={CreditCard} label="Facturation" on={active === "set" && sub === 4} onClick={() => onNavigate("set", 4)} />}
        {isAdmin && <Item rail={collapsed} icon={ShieldCheck} label="Administration" on={active === "admin"} onClick={() => onNavigate("admin", 0)} />}

        <p className="side-grp">Aide</p>
        <a href="/guide" target="_blank" rel="noreferrer" className="side-item" title={collapsed ? "Guide d'utilisation" : undefined} aria-label="Guide d'utilisation">
          <BookOpen />
          {!collapsed && <span className="min-w-0 flex-1 truncate">Guide d'utilisation</span>}
          {!collapsed && <ExternalLink className="!h-[13px] !w-[13px] opacity-50" />}
        </a>
      </nav>

      {/* Pied : formule et thème, puis le compte */}
      <div className="side-foot">
        <div className="foot-row">
          {!collapsed && (
            <button className="lang" onClick={() => onNavigate("set", 4)} aria-label={`Formule ${planName} : ouvrir la facturation`}>
              <Sparkles />
              <span>{planName ? `Formule ${planName}` : "Formule"}</span>
              <ChevronDown />
            </button>
          )}
          <button className="ibtn" onClick={toggle} aria-label={`Thème : ${THEME_LABELS[pref]}. Cliquer pour changer`} title={`Thème : ${THEME_LABELS[pref]} (cliquer pour changer)`}>
            {pref === "auto" ? <Monitor size={17} /> : pref === "light" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        <div className="me">
          <button className="flex min-w-0 flex-1 items-center gap-2.5" onClick={() => onNavigate("set", 0)} aria-label="Ouvrir mon profil" title={collapsed ? user?.name : undefined}>
            <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={34} />
            {!collapsed && (
              <span className="who">
                <b>{user?.name}</b>
                {expired ? (
                  <span className="warn"><AlertTriangle />Abonnement expiré</span>
                ) : (
                  <span className="ok"><CheckCircle2 />{user?.role === "ADMIN" ? "Administrateur" : "Compte actif"}</span>
                )}
              </span>
            )}
          </button>
          <button className="ibtn" onClick={handleLogout} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}

interface ItemProps {
  icon: LucideIcon;
  label: string;
  on?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
  rail?: boolean; // rail d'icônes : le libellé passe en infobulle, le badge se pose sur l'icône
}

function Item({ icon: Icon, label, on, onClick, trailing, rail }: ItemProps) {
  return (
    <button onClick={onClick} className={`side-item ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} aria-label={label} title={rail ? label : undefined}>
      <Icon />
      {!rail && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {trailing}
    </button>
  );
}
