import { Fragment, type CSSProperties } from "react";
import { ChevronRight, Flag, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { ScrollRow } from "@/components/ui/ScrollRow";
import type { AutomationRule } from "@/lib/automation.api";
import type { Pipeline } from "@/lib/pipeline.api";
import { STEP_SHORT, stepMeta, stepSummary, triggerOf } from "./meta";

const tile = (tint: string): CSSProperties => ({ "--a": `color-mix(in srgb, ${tint} 78%, #fff)`, "--b": tint, color: "#fff" }) as CSSProperties;

// Le pipeline en une ligne : déclencheur → étapes (pastilles d'icône). Les conditions sont reconnaissables à leur contour.
export function PipelineFlow({ pipeline, max = 6 }: { pipeline: Pick<Pipeline, "trigger" | "steps">; max?: number }) {
  const t = triggerOf(pipeline.trigger);
  const shown = pipeline.steps.slice(0, max);
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`${t.label}, puis ${pipeline.steps.length} étape${pipeline.steps.length > 1 ? "s" : ""}`}>
      <span className="chip off !gap-1.5 !pl-1" title={t.label}>
        <span className="ico-tile" style={{ ...tile(t.tint), width: 22, height: 22, borderRadius: 7 }}><Zap size={12} strokeWidth={2.4} /></span>
        {t.short}
      </span>
      {shown.map((s) => {
        const m = stepMeta(s.type);
        return (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <ChevronRight size={13} className="opacity-40" />
            <span
              className="ico-tile"
              title={m.label}
              style={{ ...tile(m.tint), width: 26, height: 26, borderRadius: 8, ...(m.kind === "condition" ? { boxShadow: "0 0 0 2px var(--surface), 0 0 0 3.5px " + m.tint } : {}) }}
            >
              <m.icon size={14} strokeWidth={2.1} />
            </span>
          </span>
        );
      })}
      {pipeline.steps.length > max && <span className="text-[11.5px] font-semibold" style={{ color: "var(--ink-3)" }}>+{pipeline.steps.length - max}</span>}
    </div>
  );
}

// ─── Schéma de workflow : des nœuds reliés par des flèches ────────────────────────

interface NodeProps {
  kind: "trigger" | "condition" | "action" | "end";
  icon: LucideIcon;
  tint: string;
  caption: string; // « Quand », « Si », « Alors », « Fin »
  title: string;
  sub?: string;
}

function FlowNode({ kind, icon: Icon, tint, caption, title, sub }: NodeProps) {
  const style: CSSProperties =
    kind === "trigger"
      ? { background: `color-mix(in srgb, ${tint} 12%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${tint} 55%, transparent)` }
      : kind === "condition"
        ? { background: "var(--surface)", outline: `1.5px dashed color-mix(in srgb, ${tint} 60%, transparent)`, outlineOffset: -1.5 }
        : kind === "end"
          ? { background: "var(--surface-3)" }
          : { background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)" };
  return (
    <div className="flex min-w-[8.75rem] max-w-[13.5rem] flex-shrink-0 items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3" style={style}>
      <span className="ico-tile sm" style={{ ...tile(kind === "end" ? "#94A3B8" : tint), width: 30, height: 30, borderRadius: 9 }}><Icon size={15} strokeWidth={2.2} /></span>
      <span className="min-w-0 leading-tight">
        <small className="block text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>{caption}</small>
        <b className="block truncate text-[12.5px] font-bold" style={{ color: theme.text }}>{title}</b>
        {sub && <small className="block truncate text-[11px]" style={{ color: theme.textMuted }}>{sub}</small>}
      </span>
    </div>
  );
}

// Lien entre deux nœuds ; après une condition, « oui » rappelle que le flux ne continue que si elle est remplie
function FlowLink({ yes }: { yes?: boolean }) {
  return (
    <span className="flex flex-shrink-0 flex-col items-center self-center">
      {yes && <small className="-mb-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: theme.green }}>oui</small>}
      <span className="flex items-center" style={{ color: "var(--ink-3)" }}>
        <span className="h-px w-3" style={{ background: "currentColor" }} />
        <ChevronRight size={13} className="-ml-1.5" />
      </span>
    </span>
  );
}

// Le workflow en entier : déclencheur → étapes → fin. Défile avec des flèches quand il dépasse la largeur.
export function PipelineDiagram({ pipeline, rules = [] }: { pipeline: Pick<Pipeline, "trigger" | "steps">; rules?: AutomationRule[] }) {
  const t = triggerOf(pipeline.trigger);
  return (
    <ScrollRow label="Étapes du pipeline">
      <FlowNode kind="trigger" icon={Zap} tint={t.tint} caption="Quand" title={t.short} />
      {pipeline.steps.map((s, i) => {
        const m = stepMeta(s.type);
        return (
          <Fragment key={s.id}>
            <FlowLink yes={i > 0 && stepMeta(pipeline.steps[i - 1].type).kind === "condition"} />
            <FlowNode kind={m.kind} icon={m.icon} tint={m.tint} caption={m.kind === "condition" ? "Si" : "Alors"} title={STEP_SHORT[s.type]} sub={stepSummary(s, rules)} />
          </Fragment>
        );
      })}
      <FlowLink yes={pipeline.steps.length > 0 && stepMeta(pipeline.steps[pipeline.steps.length - 1].type).kind === "condition"} />
      <FlowNode kind="end" icon={Flag} tint="#94A3B8" caption="Fin" title="Terminé" />
    </ScrollRow>
  );
}
