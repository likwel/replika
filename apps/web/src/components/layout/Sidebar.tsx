import { Zap, ChevronRight, LogOut } from "lucide-react";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface Props {
  active: string;
  setActive: (id: string) => void;
  sub: number;
  setSub: (i: number) => void;
}

export function Sidebar({ active, setActive, sub, setSub }: Props) {
  const current = MENUS.find((m) => m.id === active) || MENUS[0];
  const { logout } = useAuth();
  const nav = useNavigate();
  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="hidden md:flex h-full">
      <div className="flex w-20 flex-col items-center py-5" style={{ background: theme.bgDark }}>
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: theme.gold }}>
          <Zap size={22} color="#1A1410" />
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {MENUS.map((m) => {
            const isActive = active === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setActive(m.id); setSub(0); }}
                className="group flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 transition-all"
                style={{ background: isActive ? `${theme.gold}22` : "transparent" }}
              >
                <m.icon size={20} style={{ color: isActive ? theme.goldLight : "#8A817880" }} />
                <span className="text-[9px] font-medium" style={{ color: isActive ? theme.goldLight : "#8A817880" }}>{m.label}</span>
              </button>
            );
          })}
        </nav>
        <button onClick={handleLogout} className="mt-auto rounded-xl p-2.5"><LogOut size={20} color="#8A817880" /></button>
      </div>
      <div className="w-56 py-6 px-4" style={{ background: theme.bgDark2 }}>
        <p className="px-2 mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: theme.goldLight }}>{current.label}</p>
        <nav className="flex flex-col gap-1">
          {current.sub.map((s, i) => (
            <button
              key={s}
              onClick={() => setSub(i)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all hover:bg-white/5"
              style={{ color: i === sub ? "#fff" : "#FFFFFF99", background: i === sub ? "rgba(229,172,95,0.15)" : "transparent" }}
            >
              {s}<ChevronRight size={14} opacity={0.5} />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}