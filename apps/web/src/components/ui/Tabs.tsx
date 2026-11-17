import type { LucideIcon } from "lucide-react";

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

// Onglets de vue : contrôle segmenté défilant (piste en creux, onglet actif en relief), comme pr.social
export function Tabs<T extends string | number>({ items, value, onChange, className = "" }: Props<T>) {
  return (
    <div role="tablist" className={`seg no-scrollbar overflow-x-auto ${className}`} style={{ width: "fit-content", maxWidth: "100%" }}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button key={String(t.id)} role="tab" aria-selected={active} onClick={() => onChange(t.id)} className={`seg-b flex-shrink-0 ${active ? "on" : ""}`}>
            {t.icon && <t.icon size={15} />}
            {t.label}
            {t.badge ? <span className="cnt hot !ml-0.5 !px-1.5">{t.badge > 99 ? "99+" : t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
