import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { Tabs } from "./Tabs";
import { IconTile } from "./Dash";

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
  bare?: boolean; // sans carte propre : l'en-tête d'une carte plus grande (ex. Gestion)
}

// En-tête de page façon Notion : icône, grand titre, description, actions, puis onglets de vue
export function PageHeader({ title, description, actions, icon, tabs = true, badges, className = "mb-5", bare = false }: Props) {
  const ctx = useOutletContext<Ctx | undefined>();
  const menu = MENUS.find((m) => m.id === ctx?.active);
  const Icon = icon ?? menu?.icon;
  const tint = menu?.color ?? "#787774";
  const setSub = ctx?.setSub;
  const subs = tabs && menu && menu.sub.length > 1 ? menu.sub : null;

  return (
    <header className={className}>
      {/* Carte d'introduction : même en-tête que toutes les cartes (tuile 40 px, titre 16 px en gras, description 13 px dessous,
          action à droite), puis les onglets sous un filet */}
      <div className={`px-4 py-3.5 sm:px-5 sm:py-4 ${bare ? "" : "card-x rounded-2xl"}`}>
        <div className={`flex flex-wrap items-center gap-3 ${subs ? "hd-line pb-3.5" : ""}`}>
          {Icon && <IconTile icon={Icon} tint={tint} size="md" />}
          <div className="min-w-0 flex-1 basis-40">
            <h1 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>{title ?? menu?.label}</h1>
            {description && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {subs && setSub && (
          <Tabs
            className="mt-3.5"
            items={subs.map((label, i) => ({ id: i, label, badge: badges?.[i] }))}
            value={ctx?.sub ?? 0}
            onChange={setSub}
          />
        )}
      </div>
    </header>
  );
}
