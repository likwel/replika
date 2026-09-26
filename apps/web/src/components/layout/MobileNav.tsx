import { useState } from "react";
import { Menu, X, ChevronRight } from "lucide-react";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { Logo } from "@/components/ui/Logo";

interface Props {
  active: string;
  setActive: (id: string) => void;
  sub: number;
  setSub: (i: number) => void;
}

export function MobileNav({ active, setActive, sub, setSub }: Props) {
  const [open, setOpen] = useState(false);
  const quick = MENUS.slice(0, 4);
  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-[70] flex flex-col justify-end" style={{ background: "rgba(28,24,19,0.55)" }} onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] overflow-y-auto rounded-t-3xl pb-6" style={{ background: theme.bgDark }} onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4" style={{ background: theme.bgDark }}>
              <Logo dark />
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X size={18} color="#fff" />
              </button>
            </div>
            <div className="px-3">
              {MENUS.map((m) => {
                const isActive = active === m.id;
                return (
                  <div key={m.id} className="mb-1">
                    <button
                      onClick={() => { setActive(m.id); setSub(0); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                      style={{ background: isActive ? "rgba(229,172,95,0.15)" : "transparent" }}
                    >
                      <m.icon size={20} style={{ color: isActive ? theme.goldLight : "#8A8178" }} />
                      <span className="text-sm font-medium" style={{ color: isActive ? "#fff" : "#FFFFFFcc" }}>{m.label}</span>
                    </button>
                    {isActive && (
                      <div className="ml-9 mt-1 flex flex-col gap-0.5 pb-2">
                        {m.sub.map((s, i) => (
                          <button
                            key={s}
                            onClick={() => { setSub(i); setOpen(false); }}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
                            style={{ color: i === sub ? theme.goldLight : "#FFFFFF99", background: i === sub ? "rgba(255,255,255,0.05)" : "transparent" }}
                          >
                            <ChevronRight size={13} opacity={0.6} />{s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around py-2 px-2 z-50" style={{ background: theme.bgDark, borderTop: `1px solid ${theme.bgDark2}` }}>
        {quick.map((m) => (
          <button key={m.id} onClick={() => { setActive(m.id); setSub(0); }} className="flex flex-col items-center gap-0.5 px-2 py-1">
            <m.icon size={20} style={{ color: active === m.id ? theme.goldLight : "#8A817880" }} />
            <span className="text-[9px]" style={{ color: active === m.id ? theme.goldLight : "#8A817880" }}>{m.label}</span>
          </button>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 px-2 py-1">
          <Menu size={20} style={{ color: open ? theme.goldLight : "#8A817880" }} />
          <span className="text-[9px]" style={{ color: open ? theme.goldLight : "#8A817880" }}>Menu</span>
        </button>
      </div>
    </>
  );
}