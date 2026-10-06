import { useState } from "react";
import { Menu, X } from "lucide-react";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { getRenderedSub } from "@/lib/menu";
import { Logo } from "@/components/ui/Logo";
import { StatusDot } from "@/components/ui/StatusDot";
import { useOnline } from "@/hooks/useOnline";

interface Props {
  active: string;
  setActive: (id: string) => void;
  sub: number;
  setSub: (i: number) => void;
}

// Les 4 destinations les plus utilisées, fixes (indépendantes de l'ordre de MENUS)
const QUICK_IDS = ["hub", "live", "leads", "auto"];

export function MobileNav({ active, setActive, sub, setSub }: Props) {
  const [open, setOpen] = useState(false);
  const online = useOnline();
  const quick = QUICK_IDS.map((id) => MENUS.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const visible = MENUS.filter((m) => !m.hidden);

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-[70] flex flex-col justify-end" style={{ background: "rgba(28,24,19,0.55)" }} onClick={() => setOpen(false)}>
          <div className="max-h-[82vh] overflow-y-auto rounded-t-3xl pb-6" style={{ background: theme.bgDark }} onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5" style={{ background: theme.bgDark }}>
              <div className="flex items-center gap-2.5">
                <Logo dark />
                <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(34,197,94,0.14)", color: online ? theme.greenLight : "#FFFFFF66" }}>
                  <StatusDot color={online ? theme.greenLight : "#FFFFFF66"} size={6} pulse={online} />
                  {online ? "En ligne" : "Hors ligne"}
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X size={18} color="#fff" />
              </button>
            </div>
            <div className="px-3">
              {visible.map((m) => {
                const isActive = active === m.id || MENUS.find((x) => x.id === active)?.iconRailAlias === m.id;
                return (
                  <div key={m.id} className="mb-0.5">
                    <button
                      onClick={() => { setActive(m.id); setSub(0); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left"
                      style={{ background: isActive ? "rgba(255,255,255,0.06)" : "transparent" }}
                    >
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
                        style={{ background: isActive ? `${m.color}2E` : "rgba(255,255,255,0.05)", border: `1px solid ${isActive ? `${m.color}66` : "transparent"}` }}
                      >
                        <m.icon size={17} style={{ color: m.color, opacity: isActive ? 1 : 0.8 }} />
                      </span>
                      <span className="text-[13.5px] font-medium" style={{ color: isActive ? "#fff" : "#FFFFFFB3" }}>{m.label}</span>
                    </button>
                    {isActive && (
                      <div className="ml-[42px] mt-0.5 flex flex-col gap-px pb-1.5">
                        {getRenderedSub(m).map((item) => {
                          const subActive = item.menuId === active && item.index === sub;
                          return (
                            <div key={`${item.menuId}-${item.index}`}>
                              {item.dividerLabel && (
                                <p className="mb-0.5 mt-2 px-3 text-[9.5px] font-bold uppercase tracking-wider first:mt-0" style={{ color: "#FFFFFF4D" }}>
                                  {item.dividerLabel}
                                </p>
                              )}
                              <button
                                onClick={() => { setActive(item.menuId); setSub(item.index); setOpen(false); }}
                                className="relative flex w-full items-center rounded-lg py-2 pl-3 pr-2.5 text-left text-[13px]"
                                style={{
                                  color: subActive ? "#fff" : "#FFFFFF8C",
                                  background: subActive ? `${m.color}24` : "transparent",
                                  fontWeight: subActive ? 600 : 400,
                                }}
                              >
                                {subActive && <span className="absolute left-0.5 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: m.color }} />}
                                {item.label}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around px-2 pb-1 pt-1.5" style={{ background: theme.bgDark, borderTop: `1px solid ${theme.bgDark2}` }}>
        {quick.map((m) => {
          const isActive = active === m.id || MENUS.find((x) => x.id === active)?.iconRailAlias === m.id;
          return (
            <button key={m.id} onClick={() => { setActive(m.id); setSub(0); }} className="flex flex-col items-center gap-0.5 px-2 py-1">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[9px]"
                style={{ background: isActive ? `${m.color}2E` : "transparent" }}
              >
                <m.icon size={17} style={{ color: m.color, opacity: isActive ? 1 : 0.65 }} />
              </span>
              <span className="max-w-[62px] truncate text-[8.5px] font-semibold" style={{ color: isActive ? "#fff" : "#FFFFFF66" }}>{m.short ?? m.label}</span>
            </button>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 px-2 py-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: open ? "rgba(229,172,95,0.18)" : "transparent" }}>
            <Menu size={17} style={{ color: theme.gold, opacity: open ? 1 : 0.65 }} />
          </span>
          <span className="text-[8.5px] font-semibold" style={{ color: open ? "#fff" : "#FFFFFF66" }}>Menu</span>
        </button>
      </div>
    </>
  );
}
