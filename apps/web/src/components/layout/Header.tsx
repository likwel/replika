import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Mail, User, ShieldCheck, SlidersHorizontal, LogOut, History as HistoryIcon, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/StatusDot";
import { useAuth } from "@/context/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { plural } from "@/lib/format";
import { searchMenus } from "@/lib/menu";

interface Props {
  attention: number; // messages à traiter
  onOpenQueue: () => void;
  onOpenMessages: () => void;
  onOpenHistory: () => void;
  onOpenSettings: (sub: number) => void;
  onNavigate: (menuId: string, sub: number) => void;
}

export function Header({ attention, onOpenQueue, onOpenMessages, onOpenHistory, onOpenSettings, onNavigate }: Props) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const online = useOnline();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    const main = document.querySelector("main");
    main?.addEventListener("scroll", onScroll);
    return () => main?.removeEventListener("scroll", onScroll);
  }, []);

  // Ferme les menus déroulants au clic à l'extérieur ou avec Échap
  useEffect(() => {
    if (!menuOpen && !query) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!searchRef.current?.contains(e.target as Node)) setQuery("");
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setMenuOpen(false), setQuery(""));
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, query]);

  const open = (sub: number) => {
    setMenuOpen(false);
    onOpenSettings(sub);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    nav("/login");
  };

  const items: Array<{ label: string; icon: LucideIcon; sub: number }> = [
    { label: "Mon profil", icon: User, sub: 0 },
    { label: "Sécurité", icon: ShieldCheck, sub: 1 },
    { label: "Préférences", icon: SlidersHorizontal, sub: 2 },
  ];

  const results = searchMenus(query);

  return (
    <header
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 transition-shadow"
      style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, boxShadow: scrolled ? "0 2px 10px rgba(28,24,19,0.05)" : "none" }}
    >
      <Logo />
      <div ref={searchRef} className="relative mx-auto flex-1 max-w-[420px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une page, un onglet…"
          className="w-full rounded-full py-[7px] pl-9 pr-3.5 text-[13px] outline-none focus:ring-2 focus:ring-gold/30"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
        />
        {query && (
          <div
            className="absolute left-0 right-0 top-11 z-[60] overflow-hidden rounded-2xl shadow-lg"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            {results.length === 0 ? (
              <p className="px-4 py-3 text-sm" style={{ color: theme.textMuted }}>Aucun résultat pour « {query} »</p>
            ) : (
              results.map((r) => (
                <button
                  key={`${r.menuId}-${r.index}`}
                  onClick={() => { onNavigate(r.menuId, r.index); setQuery(""); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-black/5"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${r.color}1F` }}>
                    <r.icon size={14} style={{ color: r.color }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span style={{ color: theme.text }}>{r.label}</span>
                    <span className="ml-1.5 text-[11px]" style={{ color: theme.textMuted }}>· {r.menuLabel}</span>
                  </span>
                  <ChevronRight size={14} className="flex-shrink-0" style={{ color: theme.textMuted }} />
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          onClick={onOpenMessages}
          className="hidden sm:block rounded-full p-2 hover:bg-black/5"
          title="Messages privés"
          aria-label="Messages privés"
        >
          <Mail size={17} style={{ color: theme.text }} />
        </button>
        <button onClick={onOpenHistory} className="rounded-full p-2 hover:bg-black/5" title="Historique" aria-label="Historique">
          <HistoryIcon size={17} style={{ color: theme.text }} />
        </button>
        <button
          onClick={onOpenQueue}
          className="relative rounded-full p-2 hover:bg-black/5"
          title={attention ? `${plural(attention, "message")} à traiter` : "Aucun message à traiter"}
          aria-label="Messages à traiter"
        >
          <Bell size={17} style={{ color: theme.text }} />
          {attention > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: theme.red }}
            >
              {attention > 99 ? "99+" : attention}
            </span>
          )}
        </button>

        <div ref={menuRef} className="relative ml-0.5 sm:ml-1.5">
          <button onClick={() => setMenuOpen((o) => !o)} className="relative flex rounded-full" aria-label="Menu du compte" aria-expanded={menuOpen}>
            <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={32} />
            {/* Pastille verte : session active sur cet appareil */}
            <span className="absolute -bottom-px -right-px">
              <StatusDot color={online ? theme.green : theme.textMuted} size={9} ring={theme.bgCard} />
            </span>
          </button>

          {menuOpen && user && (
            <div
              className="absolute right-0 top-11 z-[60] w-64 overflow-hidden rounded-2xl shadow-lg"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: theme.border }}>
                <Avatar name={user.name} src={user.avatarUrl} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{user.name}</p>
                  <p className="truncate text-xs" style={{ color: theme.textMuted }}>{user.email}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: online ? theme.green : theme.textMuted }}>
                    <StatusDot color={online ? theme.green : theme.textMuted} size={6} />
                    {online ? "Session en ligne" : "Hors ligne"}
                  </p>
                </div>
              </div>
              <div className="py-1">
                {items.map((it) => (
                  <button
                    key={it.label}
                    onClick={() => open(it.sub)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-black/5"
                    style={{ color: theme.text }}
                  >
                    <it.icon size={16} style={{ color: theme.textMuted }} /> {it.label}
                  </button>
                ))}
              </div>
              <div className="border-t py-1" style={{ borderColor: theme.border }}>
                <button onClick={handleLogout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-black/5" style={{ color: theme.red }}>
                  <LogOut size={16} /> Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
