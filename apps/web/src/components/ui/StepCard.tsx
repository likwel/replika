import type { ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

export type StepTone = "ok" | "todo" | "info";

// Statut d'une étape en icône : coche verte (configuré), triangle ambre (à configurer), info grise (facultatif / par défaut)
export const STEP_STATUS: Record<StepTone, { icon: LucideIcon; cls: string; label: string }> = {
  ok: { icon: Check, cls: "ok-solid", label: "Configuré" },
  todo: { icon: AlertTriangle, cls: "warn", label: "À configurer" },
  info: { icon: Info, cls: "", label: "Facultatif" },
};

interface Props {
  n: number;
  icon: LucideIcon;
  title: string;
  summary: string; // état actuel en une ligne, visible même replié
  tone: StepTone;
  open: boolean;
  onToggle: () => void;
  optional?: boolean;
  children: ReactNode;
}

// Étape repliable : numéro, titre, résumé et statut en icône dans l'en-tête ; le réglage s'ouvre dessous
export function StepCard({ n, icon: Icon, title, summary, tone, open, onToggle, optional, children }: Props) {
  const s = STEP_STATUS[tone];
  return (
    <section className="overflow-hidden rounded-2xl card-x">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{n}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 text-[14.5px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>
            <Icon size={15} style={{ color: theme.textMuted }} className="flex-shrink-0" />
            {title}
            {optional && <span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>facultatif</span>}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] leading-snug" style={{ color: tone === "todo" ? theme.amber : theme.textMuted }}>{summary}</span>
        </span>
        <span className={`tr-ico ${s.cls} !h-6 !w-6 flex-shrink-0`} title={s.label} aria-label={s.label}><s.icon strokeWidth={tone === "ok" ? 3 : 2} /></span>
        <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && <div className="animate-fade-in flex flex-col gap-3 border-t px-4 py-4" style={{ borderColor: "var(--line)" }}>{children}</div>}
    </section>
  );
}
