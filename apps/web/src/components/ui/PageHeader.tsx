import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { Tabs } from "./Tabs";

interface Ctx {
  active?: string;
  sub?: number;
  setSub?: (i: number) => void;
}

interface Props {
  title?: string; // par défaut : nom du menu courant
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  tabs?: boolean; // onglets des sous-menus (défaut : affichés s'il y en a plusieurs)
  badges?: Partial<Record<number, number>>; // compteur par index de sous-menu
  className?: string;
}

// En-tête de page façon Notion : icône, grand titre, description, actions, puis onglets de vue
export function PageHeader({ title, description, actions, icon, tabs = true, badges, className = "mb-5" }: Props) {
  const ctx = useOutletContext<Ctx | undefined>();
  const menu = MENUS.find((m) => m.id === ctx?.active);
  const Icon = icon ?? menu?.icon;
  const tint = menu?.color ?? "#787774";
  const setSub = ctx?.setSub;
  const subs = tabs && menu && menu.sub.length > 1 ? menu.sub : null;

  return (
    <header className={className}>
      {/* Mobile : titre, description, actions. Dès sm : actions à droite du titre, description dessous */}
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${tint}17` }}>
              <Icon size={19} style={{ color: tint }} />
            </span>
          )}
          <h1 className="min-w-0 truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[24px]" style={{ color: theme.text }}>
            {title ?? menu?.label}
          </h1>
        </div>
        {/* Alignée sous le titre : largeur de l'icône + espacement */}
        {description && (
          <p
            className={`order-2 max-w-2xl text-[13px] italic leading-relaxed sm:order-none sm:col-start-1 sm:row-start-2 ${Icon ? "sm:pl-12" : ""}`}
            style={{ color: theme.textMuted }}
          >
            {description}
          </p>
        )}
        {actions && (
          <div className="order-3 mt-3 flex flex-wrap items-center gap-2 sm:order-none sm:col-start-2 sm:row-start-1 sm:mt-0">{actions}</div>
        )}
      </div>
      {subs && setSub && (
        <Tabs
          className="mt-4"
          items={subs.map((label, i) => ({ id: i, label, badge: badges?.[i] }))}
          value={ctx?.sub ?? 0}
          onChange={setSub}
        />
      )}
    </header>
  );
}
