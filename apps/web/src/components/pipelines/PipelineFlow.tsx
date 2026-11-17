import { ChevronRight, Zap } from "lucide-react";
import type { CSSProperties } from "react";
import type { Pipeline } from "@/lib/pipeline.api";
import { stepMeta, triggerOf } from "./meta";

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
