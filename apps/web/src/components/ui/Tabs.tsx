import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

export interface TabItem<T> {
  id: T;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface Props<T> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

// Onglets de vue soulignés, façon Notion
export function Tabs<T extends string | number>({ items, value, onChange, className = "" }: Props<T>) {
  return (
    <div role="tablist" className={`no-scrollbar flex gap-1 overflow-x-auto ${className}`} style={{ borderBottom: `1px solid ${theme.border}` }}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={String(t.id)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="-mb-px flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 pb-2 pt-1.5 text-sm transition-colors hover:bg-black/5"
            style={{
              color: active ? theme.text : theme.textMuted,
              fontWeight: active ? 500 : 400,
              borderBottom: `2px solid ${active ? theme.text : "transparent"}`,
            }}
          >
            {t.icon && <t.icon size={15} />}
            {t.label}
            {t.badge ? (
              <span className="rounded px-1.5 text-[11px] font-semibold leading-[18px]" style={{ background: theme.gold, color: theme.onAccent }}>
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
