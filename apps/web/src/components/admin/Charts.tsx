import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import type { DayPoint } from "@/lib/admin.api";
import { Panel, ProgressRow } from "@/components/ui/Dash";

// Graphiques du tableau de bord : une seule série par graphique (couleur d'accent), marques fines,
// valeur au survol de chaque colonne, maximum étiqueté, et vue tableau pour lire chaque valeur.

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const dayLabel = (d: string, long = false) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", long ? { weekday: "short", day: "numeric", month: "long" } : { day: "numeric", month: "short" });

// Courbe d'évolution compacte (carte héros) : une série, aire douce, dernier point marqué
export function Sparkline({ data, label }: { data: DayPoint[]; label: string }) {
  const gid = useId();
  if (data.length < 2) return null;
  const W = 400;
  const H = 64;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => [(i / (data.length - 1)) * W, H - 6 - (d.value / max) * (H - 14)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="#ffb27a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3.5" fill="#fff" stroke="#ff8a3d" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

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
  tint?: string; // couleur de la tuile d'icône
}

export function ColumnChart({ title, subtitle, data, format, icon: Icon, height = 220, loading, integer, tint }: ColumnProps) {
  const gid = `col${useId().replace(/:/g, "")}`;
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
    <Panel
      title={title}
      subtitle={subtitle}
      icon={Icon}
      tint={tint}
      action={
        <button
          onClick={() => setTable((t) => !t)}
          className="btn btn-soft btn-sm"
          aria-pressed={table}
        >
          <Table2 size={13} /> {table ? "Graphique" : "Tableau"}
        </button>
      }
    >

      {table ? (
        <div className="max-h-[260px] overflow-y-auto rounded-[14px]" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0" style={{ background: "var(--surface-3)" }}>
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
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--brand-1)" />
                <stop offset="1" stopColor="var(--brand-2)" />
              </linearGradient>
            </defs>
            {/* Grille : filets fins, discrets */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--line-2)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 5"} />
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
                  {h > 0 && (
                    <path
                      d={columnPath(x, y(d.value), barW, h)}
                      fill={`url(#${gid})`}
                      className="grow"
                      style={{ animationDelay: `${Math.min(i * 14, 420)}ms`, opacity: hover === null || hover === i ? 1 : 0.5, transition: "opacity .15s", filter: hover === i ? `drop-shadow(0 4px 8px var(--brand-glow))` : undefined }}
                    />
                  )}
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
              className="tip pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap px-2.5 py-1.5"
              style={{
                left: Math.min(width - 60, Math.max(60, pad.left + hover * band + band / 2)),
                top: Math.max(4, y(data[hover].value) - 8),
              }}
            >
              <p className="text-[13px] font-bold tabular-nums">{format(data[hover].value)}</p>
              <p className="text-[11px] opacity-60">{dayLabel(data[hover].date, true)}</p>
            </div>
          )}
        </div>
      )}
    </Panel>
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
    <ul className="stagger flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label} : ${format(r.value)}${r.detail ? ` · ${r.detail}` : ""}`}>
          <ProgressRow label={r.label} icon={r.icon} pct={(r.value / max) * 100} value={format(r.value)} detail={r.detail} />
        </li>
      ))}
    </ul>
  );
}
