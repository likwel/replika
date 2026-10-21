import { useEffect, useRef, useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import type { DayPoint } from "@/lib/admin.api";

// Graphiques du tableau de bord : une seule série par graphique (couleur d'accent), marques fines,
// valeur au survol de chaque colonne, maximum étiqueté, et vue tableau pour lire chaque valeur.

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const dayLabel = (d: string, long = false) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", long ? { weekday: "short", day: "numeric", month: "long" } : { day: "numeric", month: "short" });

// Maximum d'axe « rond » (1, 2, 2.5, 5 × 10^n)
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Colonne : bout arrondi de 4 px, base carrée
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

interface ColumnProps {
  title: string;
  subtitle?: ReactNode;
  data: DayPoint[];
  format: (n: number) => string;
  icon?: LucideIcon;
  height?: number;
  loading?: boolean;
  integer?: boolean; // comptage : graduations entières seulement
}

export function ColumnChart({ title, subtitle, data, format, icon: Icon, height = 220, loading, integer }: ColumnProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { left: 44, right: 8, top: 22, bottom: 24 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const band = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(24, band - 2)); // jamais plus de 24 px, 2 px d'air entre colonnes
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max].filter((t) => !integer || Number.isInteger(t));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0);
  const empty = data.every((d) => d.value === 0);
  const xLabels = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <section className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mb-3 flex items-start gap-2">
        {Icon && <Icon size={16} className="mt-0.5" style={{ color: theme.textMuted }} />}
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold" style={{ color: theme.text }}>{title}</h3>
          {subtitle && <p className="text-[12px]" style={{ color: theme.textMuted }}>{subtitle}</p>}
        </div>
        <button
          onClick={() => setTable((t) => !t)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] hover:bg-black/5"
          style={{ color: theme.textMuted }}
          aria-pressed={table}
        >
          <Table2 size={13} /> {table ? "Graphique" : "Tableau"}
        </button>
      </div>

      {table ? (
        <div className="max-h-[260px] overflow-y-auto rounded-lg" style={{ border: `1px solid ${theme.border}` }}>
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0" style={{ background: theme.bg }}>
              <tr>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: theme.textMuted }}>Jour</th>
                <th className="px-3 py-1.5 text-right font-medium" style={{ color: theme.textMuted }}>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} style={{ borderTop: `1px solid ${theme.border}` }}>
                  <td className="px-3 py-1.5" style={{ color: theme.text }}>{dayLabel(d.date, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: theme.text }}>{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative" style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
          <svg width={width} height={height} role="img" aria-label={`${title} : ${format(total)} au total sur ${data.length} jours`} className="block">
            {/* Grille : filets fins, discrets */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={theme.border} strokeWidth={1} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={theme.textMuted}>
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const h = Math.max(0, pad.top + innerH - y(d.value));
              const x = pad.left + i * band + (band - barW) / 2;
              return (
                <g key={d.date}>
                  {h > 0 && <path d={columnPath(x, y(d.value), barW, h)} fill={hover === i ? theme.goldDark : theme.gold} />}
                  {/* Zone de survol : toute la hauteur de la bande, plus large que la colonne */}
                  <rect
                    x={pad.left + i * band}
                    y={pad.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover((h2) => (h2 === i ? null : h2))}
                  />
                </g>
              );
            })}
            {/* Étiquette directe : le maximum seulement */}
            {!empty && hover === null && (
              <text
                x={pad.left + peak * band + band / 2}
                y={y(data[peak].value) - 6}
                textAnchor={peak > data.length * 0.85 ? "end" : peak < data.length * 0.15 ? "start" : "middle"}
                fontSize={11}
                fontWeight={600}
                fill={theme.text}
              >
                {format(data[peak].value)}
              </text>
            )}
            {xLabels.map((i) => (
              <text
                key={i}
                x={pad.left + i * band + band / 2}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize={11}
                fill={theme.textMuted}
              >
                {data[i] ? dayLabel(data[i].date) : ""}
              </text>
            ))}
          </svg>
          {empty && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px]" style={{ color: theme.textMuted }}>
              Aucune donnée sur la période
            </p>
          )}
          {hover !== null && data[hover] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 shadow-lg"
              style={{
                left: Math.min(width - 60, Math.max(60, pad.left + hover * band + band / 2)),
                top: Math.max(4, y(data[hover].value) - 8),
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
              }}
            >
              <p className="text-[13px] font-semibold tabular-nums" style={{ color: theme.text }}>{format(data[hover].value)}</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>{dayLabel(data[hover].date, true)}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Barres horizontales : une grandeur par ligne, même teinte, valeur au bout
export interface BarRow {
  key: string;
  label: string;
  value: number;
  icon?: LucideIcon;
  detail?: string;
}

export function BarList({ rows, format, empty = "Aucune donnée" }: { rows: BarRow[]; format: (n: number) => string; empty?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length || max === 0) return <p className="py-4 text-center text-[13px]" style={{ color: theme.textMuted }}>{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label} : ${format(r.value)}${r.detail ? ` · ${r.detail}` : ""}`}>
          <div className="mb-1 flex items-center gap-1.5 text-[12.5px]">
            {r.icon && <r.icon size={13} style={{ color: theme.textMuted }} />}
            <span className="min-w-0 flex-1 truncate" style={{ color: theme.text }}>{r.label}</span>
            <span className="font-semibold tabular-nums" style={{ color: theme.text }}>{format(r.value)}</span>
            {r.detail && <span className="text-[11.5px]" style={{ color: theme.textMuted }}>{r.detail}</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: theme.goldSoft }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: theme.gold }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
