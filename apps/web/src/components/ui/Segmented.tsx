import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

// Choix exclusif compact (ex. Tout / Commentaires / Messages privés)
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
    <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{
              background: active ? theme.bgCard : "transparent",
              color: active ? theme.text : theme.textMuted,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {o.icon && <o.icon size={13} style={{ color: active ? theme.gold : theme.textMuted }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
