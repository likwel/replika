import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsRight, LogOut, Menu as MenuIcon, ShieldCheck, SlidersHorizontal, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/StatusDot";
import { useAuth } from "@/context/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { MENUS } from "@/data/menus";

interface Props {
  active: string;
  sub: number;
  attention: number; // messages à traiter : pastille sur le bouton de menu quand la barre latérale est masquée
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenDrawer: () => void;
  onNavigate: (menuId: string, sub: number) => void;
  onOpenSettings: (sub: number) => void;
}

const ACCOUNT_ITEMS: Array<{ label: string; icon: LucideIcon; sub: number }> = [
  { label: "Mon profil", icon: User, sub: 0 },
  { label: "Sécurité", icon: ShieldCheck, sub: 1 },
  { label: "Préférences", icon: SlidersHorizontal, sub: 2 },
];

// Barre du haut façon Notion : fil d'Ariane à gauche, compte à droite
export function Header({ active, sub, attention, sidebarCollapsed, onExpandSidebar, onOpenDrawer, onNavigate, onOpenSettings }: Props) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const menu = MENUS.find((m) => m.id === active) ?? MENUS[0];
  const subLabel = menu.sub.length > 1 ? menu.sub[sub] : undefined;

  useEffect(() => {
    const main = document.querySelector("main");
    const onScroll = () => setScrolled((main?.scrollTop ?? 0) > 4);
    main?.addEventListener("scroll", onScroll);
    return () => main?.removeEventListener("scroll", onScroll);
  }, []);

  // Ferme le menu du compte au clic à l'extérieur ou avec Échap
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    nav("/connexion");
  };

  const dot = attention > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: theme.red, boxShadow: `0 0 0 2px ${theme.canvas}` }} />;

  return (
    <header
      className="flex h-12 flex-shrink-0 items-center gap-1 px-2 transition-colors sm:px-3"
      style={{ background: theme.canvas, borderBottom: `1px solid ${scrolled ? theme.border : "transparent"}` }}
    >
      <button onClick={onOpenDrawer} className="relative rounded-md p-1.5 hover:bg-black/5 md:hidden" aria-label="Ouvrir le menu">
        <MenuIcon size={18} style={{ color: theme.textMuted }} />
        {dot}
      </button>
      {sidebarCollapsed && (
        <button onClick={onExpandSidebar} className="relative hidden rounded-md p-1.5 hover:bg-black/5 md:block" title="Afficher la barre latérale" aria-label="Afficher la barre latérale">
          <ChevronsRight size={18} style={{ color: theme.textMuted }} />
          {dot}
        </button>
      )}

      <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-[14px]" aria-label="Fil d'Ariane">
        <button onClick={() => onNavigate(menu.id, 0)} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-black/5" style={{ color: theme.textMuted }}>
          <menu.icon size={15} className="flex-shrink-0" style={{ color: menu.color }} />
          <span className="truncate">{menu.label}</span>
        </button>
        {subLabel && (
          <>
            <span className="flex-shrink-0" style={{ color: theme.border }}>/</span>
            <span className="truncate px-1.5 py-1" style={{ color: theme.text }}>{subLabel}</span>
          </>
        )}
      </nav>

      <div ref={menuRef} className="relative">
        <button onClick={() => setMenuOpen((o) => !o)} className="relative flex rounded-full p-0.5 hover:bg-black/5" aria-label="Menu du compte" aria-expanded={menuOpen}>
          <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={28} />
          <span className="absolute bottom-0 right-0">
            <StatusDot color={online ? theme.greenLight : theme.textMuted} size={8} ring={theme.canvas} />
          </span>
        </button>

        {menuOpen && user && (
          <div
            className="animate-panel-in absolute right-0 top-10 z-[60] w-64 overflow-hidden rounded-xl py-1 shadow-xl"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <Avatar name={user.name} src={user.avatarUrl} size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: theme.text }}>{user.name}</p>
                <p className="truncate text-xs" style={{ color: theme.textMuted }}>{user.email}</p>
              </div>
            </div>
            <div className="mx-1 my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
            {ACCOUNT_ITEMS.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings(it.sub);
                }}
                className="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 text-sm hover:bg-black/5"
                style={{ color: theme.text }}
              >
                <it.icon size={16} style={{ color: theme.textMuted }} /> {it.label}
              </button>
            ))}
            <div className="mx-1 my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
            <button
              onClick={handleLogout}
              className="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 text-sm hover:bg-black/5"
              style={{ color: theme.red }}
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
