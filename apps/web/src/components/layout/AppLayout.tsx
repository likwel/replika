import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAttention } from "@/hooks/useAttention";
import { useAccess } from "@/hooks/useAccess";
import { MENUS } from "@/data/menus";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MoreSheet } from "./MoreSheet";
import { CommandPalette } from "./CommandPalette";
import { SubscriptionBanner } from "@/components/billing/SubscriptionBanner";
import { BuyLiveHoursHost } from "@/components/billing/BuyLiveHoursDialog";
import { BuyReplyCreditsHost } from "@/components/billing/BuyReplyCreditsDialog";
import { PaymentHost } from "@/components/billing/PaymentHost";
import { PaymentSuccessHost } from "@/components/billing/PaymentSuccessModal";
import { WorkspaceBanner, WorkspaceGate } from "./WorkspaceGate";
import { AssociateAccountHost } from "@/components/connections/AssociateAccountModal";

// map id menu -> segment d'URL
const PATHS: Record<string, string> = {
  dash: "tableau-de-bord", hub: "gestion", queue: "a-traiter", leads: "leads", plan: "planifier", stat: "statistiques", conn: "connexions", live: "lives", market: "gescom", rules: "regles", auto: "automatisation", hist: "historique", set: "parametres", admin: "admin",
};

// Barre d'onglets mobile : les modules du quotidien, le reste dans le tiroir (onglet « Plus »)
const TAB_MENUS = ["dash", "hub", "queue", "live"];
const TAB_LABELS: Record<string, string> = {}; // libellés trop longs pour un onglet de 5 colonnes : voir `short` dans data/menus.ts

const RAIL_WIDTH = 72; // barre latérale réduite : icônes seules
const COLLAPSED_KEY = "replika:sidebarCollapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

export function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { canMenu } = useAccess();
  const [sub, setSub] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const seg = loc.pathname.split("/")[2] || "tableau-de-bord";
  const active = Object.keys(PATHS).find((k) => PATHS[k] === seg) || "dash";

  const goTo = (id: string, subIndex: number) => {
    nav(`/app/${PATHS[id] || id}`);
    setSub(subIndex);
  };
  const openQueue = () => goTo("queue", 0);

  const toggleCollapsed = (value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // Préférence non mémorisée (navigation privée…) : sans conséquence
    }
  };

  // Chaque page / sous-menu s'ouvre en haut
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname, sub]);

  // Recherche rapide : Ctrl/⌘ K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Halo des cartes en relief : suit le pointeur (--mx / --my lus par .card-s::after)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".card-s, .card-x");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  const attention = useAttention(user?.desktopNotifications ?? false, openQueue, loc.pathname);

  const sidebarProps = { active, sub, attention };
  const tabs = TAB_MENUS.map((id) => MENUS.find((m) => m.id === id)).filter((m) => m && !m.hidden && canMenu(m.id));

  return (
    <div className="flex h-screen h-dvh overflow-hidden">
      <div className="hidden flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out md:block" style={{ width: collapsed ? RAIL_WIDTH : 248 }}>
        <Sidebar {...sidebarProps} collapsed={collapsed} onNavigate={goTo} onToggle={() => toggleCollapsed(!collapsed)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          active={active}
          sub={sub}
          onNavigate={goTo}
          onOpenSettings={(i) => goTo("set", i)}
          onOpenSearch={() => setSearch(true)}
        />
        <WorkspaceBanner />
        <SubscriptionBanner onOpenBilling={() => goTo("set", 4)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {/* La clé relance l'entrée en fondu glissé à chaque changement de module */}
          <div key={active} className="page-in mx-auto w-full max-w-7xl px-3.5 pb-[calc(var(--tab-h)+env(safe-area-inset-bottom)+24px)] pt-3 sm:pt-4 md:px-8 md:pb-16">
            <WorkspaceGate menuId={active} sub={sub} onNavigate={goTo}>
              <Outlet context={{ active, sub, setSub, goTo }} />
            </WorkspaceGate>
          </div>
        </main>
      </div>

      {/* Mobile : barre d'onglets en bas ; l'onglet actif est un bloc en dégradé de marque */}
      <nav className="tabbar md:hidden" style={{ "--tabs": tabs.length + 1 } as React.CSSProperties} aria-label="Navigation principale">
        {tabs.map((m) => {
          if (!m) return null;
          const on = active === m.id;
          return (
            <button key={m.id} className={`tab ${on ? "on" : ""}`} onClick={() => goTo(m.id, 0)} aria-current={on ? "page" : undefined}>
              <i>
                <m.icon />
                {m.id === "queue" && attention > 0 && <b className="bd">{attention > 99 ? "99+" : attention}</b>}
              </i>
              <span>{TAB_LABELS[m.id] ?? m.short ?? m.label}</span>
            </button>
          );
        })}
        <button className={`tab ${drawer || !tabs.some((m) => m?.id === active) ? "on" : ""}`} onClick={() => setDrawer(true)} aria-label="Plus de modules">
          <i>
            <Ellipsis />
          </i>
          <span>Plus</span>
        </button>
      </nav>

      {drawer && (
        <MoreSheet
          active={active}
          sub={sub}
          attention={attention}
          tabIds={TAB_MENUS}
          onNavigate={goTo}
          onSearch={() => setSearch(true)}
          onClose={() => setDrawer(false)}
        />
      )}

      <AssociateAccountHost />
      <BuyLiveHoursHost />
      <BuyReplyCreditsHost />
      <PaymentHost />
      <PaymentSuccessHost />
      <CommandPalette
        open={search}
        onClose={() => setSearch(false)}
        onNavigate={(id, i) => {
          setSearch(false);
          goTo(id, i);
        }}
      />
    </div>
  );
}
