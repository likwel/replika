import { useEffect } from "react";
import { BookOpen, CheckCircle2, AlertTriangle, ChevronRight, CreditCard, LogOut, Search, ShieldCheck, Sparkles, UserRound, Users, X, Moon, Monitor, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { MENUS } from "@/data/menus";
import { useAccess } from "@/hooks/useAccess";
import { usePlan } from "@/hooks/usePlan";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { THEME_LABELS } from "@/lib/themePref";

interface Props {
  active: string;
  sub: number;
  attention: number;
  tabIds: string[]; // modules déjà dans la barre d'onglets : absents de la feuille
  onNavigate: (menuId: string, sub: number) => void;
  onSearch: () => void;
  onClose: () => void;
}

interface Tile {
  key: string;
  icon: LucideIcon;
  label: string;
  on: boolean;
  go: () => void;
  badge?: number;
}

// Feuille « Plus » du mobile : le compte, la grille des autres modules, puis les réglages rapides
export function MoreSheet({ active, sub, attention, tabIds, onNavigate, onSearch, onClose }: Props) {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { canMenu } = useAccess();
  const { planName, status } = usePlan();
  const { pref, toggle } = useThemeToggle();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const go = (id: string, i: number) => () => {
    onClose();
    onNavigate(id, i);
  };

  const tiles: Tile[] = [];
  for (const m of MENUS) {
    if (m.hidden || tabIds.includes(m.id) || m.id === "set" || !canMenu(m.id)) continue;
    tiles.push({ key: m.id, icon: m.icon, label: m.short ?? m.label, on: active === m.id, go: go(m.id, 0), badge: m.id === "queue" ? attention : undefined });
  }
  if (canMenu("set")) tiles.push({ key: "profil", icon: UserRound, label: "Profil", on: active === "set" && sub < 3, go: go("set", 0) });
  if (canMenu("set", 3)) tiles.push({ key: "team", icon: Users, label: "Équipe", on: active === "set" && sub === 3, go: go("set", 3) });
  if (canMenu("set", 4)) tiles.push({ key: "billing", icon: CreditCard, label: "Facturation", on: active === "set" && sub === 4, go: go("set", 4) });
  if (user?.role === "ADMIN") tiles.push({ key: "admin", icon: ShieldCheck, label: "Admin", on: active === "admin", go: go("admin", 0) });

  const expired = status === "EXPIRED";
  const handleLogout = async () => {
    onClose();
    await logout();
    nav("/connexion");
  };

  return (
    <div className="back md:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="msheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="grab" />
        <div className="me">
          <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={36} />
          <span className="who">
            <b>{user?.name}</b>
            {expired ? <span className="warn"><AlertTriangle />Abonnement expiré</span> : <span className="ok"><CheckCircle2 />{user?.role === "ADMIN" ? "Administrateur" : "Compte actif"}</span>}
          </span>
          <button className="btn btn-sm btn-soft" onClick={handleLogout}>
            <LogOut size={15} className="mr-1.5 inline" />Quitter
          </button>
          <button className="xbtn" onClick={onClose} aria-label="Fermer"><X /></button>
        </div>

        <div className="mgrid">
          {tiles.map((t) => (
            <button key={t.key} className={`mi ${t.on ? "on" : ""}`} onClick={t.go} aria-current={t.on ? "page" : undefined}>
              <t.icon />
              {t.label}
              {t.badge ? <span className="cnt hot">{t.badge > 99 ? "99+" : t.badge}</span> : null}
            </button>
          ))}
        </div>

        <button className="mrow" onClick={() => { onClose(); onSearch(); }}>
          <Search />Rechercher<span className="v"><ChevronRight /></span>
        </button>
        <button className="mrow" onClick={go("set", 4)}>
          <Sparkles />Formule<span className="v">{planName}<ChevronRight /></span>
        </button>
        <button className="mrow" onClick={toggle} aria-label={`Thème : ${THEME_LABELS[pref]}. Changer`}>
          {pref === "auto" ? <Monitor /> : pref === "light" ? <Sun /> : <Moon />}Thème<span className="v">{THEME_LABELS[pref]}<ChevronRight /></span>
        </button>
        <a className="mrow" href="/guide" target="_blank" rel="noreferrer">
          <BookOpen />Guide d'utilisation<span className="v"><ChevronRight /></span>
        </a>
      </div>
    </div>
  );
}
