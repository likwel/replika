import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Mail, User, ShieldCheck, SlidersHorizontal, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { plural } from "@/lib/format";

interface Props {
  attention: number; // messages à traiter
  onOpenQueue: () => void;
  onOpenSettings: (sub: number) => void;
}

export function Header({ attention, onOpenQueue, onOpenSettings }: Props) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ferme le menu au clic à l'extérieur ou avec Échap
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  return (
    <header className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3" style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}` }}>
      <Logo />
      <div className="relative flex-1 max-w-md mx-auto">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
        <input
          placeholder="Rechercher…"
          className="w-full rounded-full py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
        />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onOpenQueue}
          className="relative rounded-full p-2 sm:p-2.5 hover:bg-black/5"
          title={attention ? `${plural(attention, "message")} à traiter` : "Aucun message à traiter"}
          aria-label="Messages à traiter"
        >
          <Bell size={18} style={{ color: theme.text }} />
          {attention > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: theme.red }}
            >
              {attention > 99 ? "99+" : attention}
            </span>
          )}
        </button>
        <button className="hidden sm:block rounded-full p-2.5 hover:bg-black/5">
          <Mail size={18} style={{ color: theme.text }} />
        </button>

        <div ref={menuRef} className="relative ml-1">
          <button onClick={() => setMenuOpen((o) => !o)} className="flex rounded-full" aria-label="Menu du compte" aria-expanded={menuOpen}>
            <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={36} />
          </button>

          {menuOpen && user && (
            <div
              className="absolute right-0 top-12 z-[60] w-64 overflow-hidden rounded-2xl shadow-lg"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: theme.border }}>
                <Avatar name={user.name} src={user.avatarUrl} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{user.name}</p>
                  <p className="truncate text-xs" style={{ color: theme.textMuted }}>{user.email}</p>
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
