import { useState } from "react";
import { theme } from "./theme";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { NewsPage } from "@/pages/NewsPage";
import { PlannerPage } from "@/pages/app/PlannerPage";
import { StatsPage } from "@/pages/app/StatsPage";
import { ConnectionsPage } from "@/pages/app/ConnectionsPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

export default function App() {
  const [active, setActive] = useState("dash");
  const [sub, setSub] = useState(0);
  const [tab, setTab] = useState("all");

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: theme.bg }}>
      <Sidebar active={active} setActive={setActive} sub={sub} setSub={setSub} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 md:pb-5">
          {active === "dash" ? <NewsPage tab={tab} setTab={setTab} sub={sub} />
            : active === "plan" ? <PlannerPage />
            : active === "stat" ? <StatsPage />
            : active === "conn" ? <ConnectionsPage />
            : <PlaceholderPage menu={active} sub={sub} />}
        </main>
      </div>
      <MobileNav active={active} setActive={setActive} sub={sub} setSub={setSub} />
    </div>
  );
}