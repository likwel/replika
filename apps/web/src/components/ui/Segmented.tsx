import type { LucideIcon } from "lucide-react";

// Choix exclusif compact (ex. Tout / Commentaires / Messages privés) : piste en creux, choix en relief
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg flex-wrap" role="group">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={active} className={`seg-b ${active ? "on" : ""}`}>
            {o.icon && <o.icon size={13} style={{ color: active ? "var(--brand-ink)" : undefined }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
