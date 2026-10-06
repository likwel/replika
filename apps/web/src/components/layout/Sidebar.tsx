import { LogOut } from "lucide-react";
import { theme } from "@/theme";
import { LogoMark } from "@/components/ui/Logo";
import { MENUS } from "@/data/menus";
import { getRenderedSub } from "@/lib/menu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { StatusDot } from "@/components/ui/StatusDot";

interface Props {
  active: string;
  setActive: (id: string) => void;
  sub: number;
  setSub: (i: number) => void;
}

export function Sidebar({ active, setActive, sub, setSub }: Props) {
  const current = MENUS.find((m) => m.id === active) || MENUS[0];
  const rendered = getRenderedSub(current);
  const { logout } = useAuth();
  const nav = useNavigate();
  const online = useOnline();
  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="hidden md:flex h-full">
      <div className="flex w-[68px] flex-col items-center py-3" style={{ background: theme.bgDark }}>
        <LogoMark size={36} className="mb-3" />
        <nav className="no-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {MENUS.filter((m) => !m.hidden).map((m) => {
            const isActive = active === m.id || MENUS.find((x) => x.id === active)?.iconRailAlias === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setActive(m.id); setSub(0); }}
                className="group relative flex w-[60px] flex-col items-center gap-1 rounded-xl py-1.5 transition-colors"
                style={{ background: isActive ? "rgba(255,255,255,0.06)" : "transparent" }}
                title={m.label}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: m.color }} />
                )}
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all group-hover:scale-105"
                  style={{
                    background: isActive ? `${m.color}2E` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isActive ? `${m.color}66` : "transparent"}`,
                  }}
                >
                  <m.icon size={17} style={{ color: m.color, opacity: isActive ? 1 : 0.8 }} />
                </span>
                <span
                  className="max-w-[58px] truncate px-0.5 text-[8.5px] font-semibold leading-tight"
                  style={{ color: isActive ? "#FFFFFF" : "#FFFFFF66" }}
                >
                  {m.short ?? m.label}
                </span>
              </button>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="mt-2 rounded-xl p-2 transition-colors hover:bg-white/5"
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <LogOut size={18} color="#8A817899" />
        </button>
      </div>

      <div className="flex w-[198px] flex-col py-3.5" style={{ background: theme.bgDark2 }}>
        <div className="mb-2.5 flex items-center gap-2 px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${current.color}26` }}>
            <current.icon size={13} style={{ color: current.color }} />
          </span>
          <p className="truncate text-[11px] font-bold uppercase tracking-wider" style={{ color: "#FFFFFFDD" }}>
            {current.label}
          </p>
        </div>

        <nav className="no-scrollbar flex flex-1 flex-col gap-px overflow-y-auto px-2.5">
          {rendered.map((item) => {
            const isActive = item.menuId === active && item.index === sub;
            return (
              <div key={`${item.menuId}-${item.index}`}>
                {item.dividerLabel && (
                  <p className="mb-1 mt-3 px-2.5 text-[9.5px] font-bold uppercase tracking-wider first:mt-0" style={{ color: "#FFFFFF4D" }}>
                    {item.dividerLabel}
                  </p>
                )}
                <button
                  onClick={() => { setActive(item.menuId); setSub(item.index); }}
                  className="relative flex w-full items-center rounded-lg py-[7px] pl-3 pr-2.5 text-left text-[13px] transition-colors hover:bg-white/5"
                  style={{
                    color: isActive ? "#FFFFFF" : "#FFFFFF8C",
                    background: isActive ? `${current.color}24` : "transparent",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {isActive && (
                    <span className="absolute left-0.5 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: current.color }} />
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="mt-2 px-4 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="flex items-center gap-2 text-[10.5px] font-medium" style={{ color: online ? theme.greenLight : "#FFFFFF66" }}>
            <StatusDot color={online ? theme.greenLight : "#FFFFFF66"} size={7} pulse={online} />
            {online ? "En ligne" : "Hors ligne"}
          </span>
        </div>
      </div>
    </div>
  );
}
