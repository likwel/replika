import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useAttention } from "@/hooks/useAttention";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

// map id menu -> segment d'URL
const PATHS: Record<string, string> = {
  hub: "gestion", leads: "leads", plan: "planifier", stat: "statistiques", conn: "connexions", live: "lives", auto: "automatisation", hist: "historique", set: "parametres",
};

const QUEUE_SUB = 2; // Gestion → À traiter

export function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const [sub, setSub] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  const seg = loc.pathname.split("/")[2] || "gestion";
  const active = Object.keys(PATHS).find((k) => PATHS[k] === seg) || "hub";

  const setActive = (id: string) => {
    setSub(0);
    nav(`/app/${PATHS[id] || id}`);
  };

  // Ouvre directement un sous-menu (cloche → file d'attente, menu du compte → paramètres)
  const goTo = (id: string, subIndex: number) => {
    nav(`/app/${PATHS[id]}`);
    setSub(subIndex);
  };
  const openQueue = () => goTo("hub", QUEUE_SUB);
  // Chaque page / sous-menu s'ouvre en haut
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname, sub]);

  const attention = useAttention(user?.desktopNotifications ?? false, openQueue, loc.pathname);

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: theme.bg }}>
      <Sidebar active={active} setActive={setActive} sub={sub} setSub={setSub} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header attention={attention} onOpenQueue={openQueue} onOpenSettings={(i) => goTo("set", i)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 md:pb-5">
          <Outlet context={{ active, sub, setSub }} />
        </main>
      </div>
      <MobileNav active={active} setActive={setActive} sub={sub} setSub={setSub} />
    </div>
  );
}
