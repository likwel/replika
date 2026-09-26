import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { theme } from "@/theme";
import type { Schedule } from "@/lib/schedule.api";
import { KIND_META, STATUS_META, dayKey, monthRange } from "./planner";

interface Props {
  month: Date; // 1er jour du mois affiché
  items: Schedule[];
  loading: boolean;
  onMonth: (d: Date) => void;
  onOpen: (s: Schedule) => void;
  onCreate: (day: Date) => void;
  onDay: (day: Date) => void; // plus de 3 éléments : liste du jour
}

const DOWS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function CalendarView({ month, items, loading, onMonth, onOpen, onCreate, onDay }: Props) {
  const { start } = monthRange(month);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = dayKey(new Date());
  const byDay = new Map<string, Schedule[]>();
  for (const s of items) {
    if (!s.scheduledAt) continue;
    const k = dayKey(new Date(s.scheduledAt));
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const shift = (n: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const title = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl p-3 sm:p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold capitalize" style={{ color: theme.text }}>{title}</span>
        {loading && <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: theme.gold }} />}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Mois précédent">
            <ChevronLeft size={17} style={{ color: theme.text }} />
          </button>
          <button
            onClick={() => onMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-black/5"
            style={{ border: `1px solid ${theme.border}`, color: theme.text }}
          >
            Aujourd'hui
          </button>
          <button onClick={() => shift(1)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Mois suivant">
            <ChevronRight size={17} style={{ color: theme.text }} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-7 gap-1 sm:gap-1.5">
          {DOWS.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-semibold" style={{ color: theme.textMuted }}>{d}</div>
          ))}
          {days.map((d) => {
            const key = dayKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const list = byDay.get(key) ?? [];
            const past = key < today;
            return (
              <div
                key={key}
                className="group relative min-h-[84px] rounded-lg p-1.5"
                style={{
                  background: inMonth ? theme.bg : "transparent",
                  border: `1px solid ${key === today ? theme.gold : inMonth ? theme.border : "transparent"}`,
                  opacity: inMonth ? 1 : 0.45,
                }}
              >
                <div className="flex items-center">
                  <span className="text-[11px] font-semibold" style={{ color: key === today ? theme.goldDark : theme.textMuted }}>{d.getDate()}</span>
                  {!past && (
                    <button
                      onClick={() => onCreate(d)}
                      className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Programmer le ${d.toLocaleDateString("fr-FR")}`}
                    >
                      <Plus size={13} style={{ color: theme.goldDark }} />
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {list.slice(0, 3).map((s) => {
                    const kind = KIND_META[s.kind];
                    const failed = s.status === "FAILED" || s.status === "PARTIAL";
                    return (
                      <button
                        key={s.id}
                        onClick={() => onOpen(s)}
                        className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium"
                        style={{
                          background: s.status === "DRAFT" ? theme.border : `${kind.color}1A`,
                          color: failed ? theme.red : s.status === "DRAFT" ? theme.textMuted : kind.color,
                          textDecoration: s.status === "DONE" ? "none" : undefined,
                        }}
                        title={`${kind.label} · ${STATUS_META[s.status].label} · ${s.text}`}
                      >
                        <kind.icon size={10} className="flex-shrink-0" />
                        {new Date(s.scheduledAt!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        <span className="truncate font-normal">{s.text}</span>
                      </button>
                    );
                  })}
                  {list.length > 3 && (
                    <button onClick={() => onDay(d)} className="text-left text-[10px] font-semibold" style={{ color: theme.textMuted }}>
                      +{list.length - 3} autre{list.length > 4 ? "s" : ""}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px]" style={{ color: theme.textMuted }}>
        {(["POST", "COMMENT", "MESSAGE"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_META[k].color }} /> {KIND_META[k].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: theme.border }} /> Brouillon
        </span>
      </div>
    </div>
  );
}
