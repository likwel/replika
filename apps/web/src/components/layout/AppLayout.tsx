import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useAttention } from "@/hooks/useAttention";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

// map id menu -> segment d'URL
const PATHS: Record<string, string> = {
  hub: "gestion", leads: "leads", plan: "planifier", stat: "statistiques", conn: "connexions", live: "lives", market: "gescom", auto: "automatisation", hist: "historique", set: "parametres",
};

const QUEUE_SUB = 2; // Gestion → À traiter
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
  const [sub, setSub] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const seg = loc.pathname.split("/")[2] || "gestion";
  const active = Object.keys(PATHS).find((k) => PATHS[k] === seg) || "hub";

  const goTo = (id: string, subIndex: number) => {
    nav(`/app/${PATHS[id] || id}`);
    setSub(subIndex);
  };
  const openQueue = () => goTo("hub", QUEUE_SUB);

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

  const attention = useAttention(user?.desktopNotifications ?? false, openQueue, loc.pathname);

  const sidebarProps = { active, sub, attention };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: theme.canvas }}>
      <div className="hidden flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out md:block" style={{ width: collapsed ? 0 : 248 }}>
        <Sidebar {...sidebarProps} onNavigate={goTo} onOpenSearch={() => setSearch(true)} onCollapse={() => toggleCollapsed(true)} />
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div className="animate-fade-in absolute inset-0" style={{ background: "rgba(15, 15, 15, 0.45)" }} onClick={() => setDrawer(false)} />
          <div className="animate-slide-in absolute inset-y-0 left-0 shadow-2xl">
            <Sidebar
              {...sidebarProps}
              onNavigate={(id, i) => {
                setDrawer(false);
                goTo(id, i);
              }}
              onOpenSearch={() => {
                setDrawer(false);
                setSearch(true);
              }}
              onCollapse={() => setDrawer(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          active={active}
          sub={sub}
          attention={attention}
          sidebarCollapsed={collapsed}
          onExpandSidebar={() => toggleCollapsed(false)}
          onOpenDrawer={() => setDrawer(true)}
          onNavigate={goTo}
          onOpenSettings={(i) => goTo("set", i)}
        />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-3 sm:px-8 sm:pt-4 lg:px-12">
            <Outlet context={{ active, sub, setSub }} />
          </div>
        </main>
      </div>

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
