import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleHelp, CreditCard, LogOut, Plus, Search, ShieldCheck, SlidersHorizontal, User, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { UsageBadge } from "@/components/billing/UsageBadge";
import { openAssociate } from "@/lib/associate";
import { StatusDot } from "@/components/ui/StatusDot";
import { useAuth } from "@/context/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { useAccess } from "@/hooks/useAccess";
import { MENUS } from "@/data/menus";
import { NotificationBell } from "./NotificationBell";
import { SECTIONS } from "./Sidebar";
import { PageHelpModal } from "./PageHelpModal";
import type { SubscriptionSummary } from "@/lib/billing.api";

interface Props {
  active: string;
  sub: number;
  onNavigate: (menuId: string, sub: number) => void;
  onOpenSettings: (sub: number) => void;
  onOpenSearch: () => void;
}

const ACCOUNT_ITEMS: Array<{ label: string; icon: LucideIcon; sub: number }> = [
  { label: "Mon profil", icon: User, sub: 0 },
  { label: "Sécurité", icon: ShieldCheck, sub: 1 },
  { label: "Préférences", icon: SlidersHorizontal, sub: 2 },
  { label: "Équipe", icon: Users, sub: 3 },
  { label: "Facturation", icon: CreditCard, sub: 4 },
];

// Barre du haut façon pr.social : fil d'Ariane (module + page) à gauche, actions et compte à droite
export function Header({ active, onNavigate, onOpenSettings, onOpenSearch }: Props) {
  const { user, logout } = useAuth();
  const { can, canMenu } = useAccess();
  const nav = useNavigate();
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const menu = MENUS.find((m) => m.id === active) ?? MENUS[0];
  // Fil d'Ariane : groupe de la barre latérale en petit, module en grand (le titre de page n'est pas répété dessous)
  const group = SECTIONS.find((g) => g.ids.includes(menu.id))?.label ?? "SuiteFlow";

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

  return (
    <header
      className="top-surface z-20 h-14 flex-shrink-0 px-3.5 md:h-[70px] md:px-8"
      style={{ boxShadow: scrolled ? "0 1px 0 var(--line)" : "0 1px 0 transparent", transition: "box-shadow 0.2s var(--ease)" }}
    >
      <div className="mx-auto flex h-full w-full max-w-[76rem] items-center gap-2">
        {/* Mobile : marque (la navigation passe par la barre d'onglets) */}
        <div className="flex min-w-0 items-center gap-2.5 md:hidden">
          <LogoMark size={32} />
          <Wordmark size={16} />
        </div>
        {/* Bureau : fil d'Ariane — groupe en petit, module en grand */}
        <nav className="hidden min-w-0 flex-1 flex-col md:flex" aria-label="Fil d'Ariane">
          <span className="truncate text-[12px] font-medium" style={{ color: theme.textMuted }}>{group}</span>
          <p key={menu.id} className="page-in mt-px truncate text-[21px] font-extrabold leading-[1.15] tracking-[-0.025em]" style={{ color: theme.text }}>
            {menu.label}
          </p>
        </nav>
        <div className="flex-1 md:hidden" />

        {/* Droite : outils (recherche, aide) · action principale (associer un compte) · formule */}
        <div className="flex items-center gap-2">
          {/* Recherche : un champ à partir de lg, une icône en dessous */}
          <button
            className="field-in hidden h-[38px] w-52 items-center gap-2 rounded-xl px-3 text-left text-[13px] font-medium lg:flex xl:w-60"
            onClick={onOpenSearch}
            aria-label="Rechercher (Ctrl K)"
            style={{ color: theme.textMuted }}
          >
            <Search size={15} className="flex-shrink-0" />
            <span className="flex-1 truncate">Rechercher…</span>
            <kbd className="rounded-md px-1.5 py-px text-[10.5px] font-semibold" style={{ background: "var(--surface-3)", color: theme.textMuted }}>Ctrl K</kbd>
          </button>
          <span className="hidden md:contents lg:hidden">
            <button className="ibtn hdr-ctl rounded-xl" onClick={onOpenSearch} aria-label="Rechercher (Ctrl K)" title="Rechercher (Ctrl K)">
              <Search size={17} />
            </button>
          </span>

          {/* Notifications : bulle des nouveaux messages à traiter */}
          {can("inbox") && <NotificationBell onNavigate={onNavigate} />}

          {/* Aide de la page : icône seule, avec libellé sur grand écran */}
          <button className="btn btn-soft hdr-ctl rounded-xl" onClick={() => setHelpOpen(true)} aria-label="Comment fonctionne cette page" title="Comment fonctionne cette page">
            <CircleHelp size={17} />
            <span className="hidden xl:inline">Aide</span>
          </button>

          <span className="mx-0.5 hidden h-6 w-px md:block" style={{ background: "var(--line-2)" }} aria-hidden />

          {/* Action principale : associer un compte */}
          {can("connections", "write") && (
            <button
              onClick={openAssociate}
              className="btn btn-brand hdr-ctl rounded-xl"
              title="Associer un compte"
              aria-label="Associer un compte"
            >
              <Plus size={17} strokeWidth={2.6} />
              <span className="hidden lg:inline">Associer un compte</span>
            </button>
          )}
          {can("billing") && <UsageBadge />}
          {helpOpen && <PageHelpModal menuId={active} onClose={() => setHelpOpen(false)} />}

          {/* Le compte vit dans la barre latérale sur bureau : le menu du compte ne sert qu'au mobile */}
          <div ref={menuRef} className="relative md:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="relative flex rounded-full p-0.5 transition-transform duration-150 ease-brand active:scale-95"
              style={{ boxShadow: menuOpen ? "0 0 0 2px var(--color-gold)" : "0 0 0 2px transparent" }}
              aria-label="Menu du compte"
              aria-expanded={menuOpen}
            >
              <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={34} />
              <span className="absolute bottom-0 right-0">
                <StatusDot color={online ? theme.greenLight : theme.textMuted} size={9} ring={theme.bgCard} />
              </span>
            </button>

            {menuOpen && user && (
              <div className="pop absolute right-0 top-12 z-[60] w-72 overflow-hidden rounded-[18px] p-1.5">
                <div className="flex items-center gap-3 px-2.5 py-2.5">
                  <Avatar name={user.name} src={user.avatarUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: theme.text }}>{user.name}</p>
                    <p className="truncate text-xs" style={{ color: theme.textMuted }}>{user.email}</p>
                  </div>
                  {user.subscription && <PlanBadge sub={user.subscription} />}
                </div>
                <div className="mx-1 my-1" style={{ borderTop: "1px solid var(--line)" }} />
                {ACCOUNT_ITEMS.filter((it) => canMenu("set", it.sub)).map((it) => (
                  <button
                    key={it.label}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSettings(it.sub);
                    }}
                    className="flex h-10 w-full items-center gap-3 rounded-[11px] px-2.5 text-[13.5px] font-medium transition-colors hover:bg-[var(--surface-3)]"
                    style={{ color: theme.text }}
                  >
                    <it.icon size={17} style={{ color: theme.textMuted }} /> {it.label}
                  </button>
                ))}
                {user.role === "ADMIN" && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate("admin", 0);
                    }}
                    className="flex h-10 w-full items-center gap-3 rounded-[11px] px-2.5 text-[13.5px] font-medium transition-colors hover:bg-[var(--surface-3)]"
                    style={{ color: theme.text }}
                  >
                    <ShieldCheck size={17} /> Administration
                  </button>
                )}
                <div className="mx-1 my-1" style={{ borderTop: "1px solid var(--line)" }} />
                <button
                  onClick={handleLogout}
                  className="flex h-10 w-full items-center gap-3 rounded-[11px] px-2.5 text-[13.5px] font-semibold transition-colors hover:bg-[var(--color-dangerBg)]"
                  style={{ color: theme.red }}
                >
                  <LogOut size={17} /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Formule en cours, sous le nom dans le menu du compte
function PlanBadge({ sub }: { sub: SubscriptionSummary }) {
  const expired = sub.status === "EXPIRED";
  const label = sub.status === "TRIAL" ? `Essai ${sub.planName}` : sub.planName;
  return (
    <span className={`chip ${expired ? "bad" : "brand"} flex-shrink-0 self-start !text-[10.5px]`} title={expired ? "Abonnement expiré" : undefined}>
      {label}
    </span>
  );
}
