import type { LucideIcon } from "lucide-react";
import { MENUS } from "@/data/menus";
import type { Menu } from "@/types";

export interface RenderedSub {
  label: string;
  menuId: string; // menu réel à activer (peut différer du menu affiché, via mergeGroups)
  index: number; // index local dans le sous-menu de menuId
  dividerLabel?: string; // en-tête de section à afficher juste avant cet item
}

// Aplatit les sous-items d'un menu, puis ceux de ses mergeGroups (avec séparateur visuel)
export function getRenderedSub(menu: Menu): RenderedSub[] {
  const own: RenderedSub[] = menu.sub.map((label, index) => ({ label, menuId: menu.id, index }));
  const merged = (menu.mergeGroups ?? []).flatMap((group) => {
    const target = MENUS.find((m) => m.id === group.menuId);
    if (!target) return [];
    return target.sub.map((label, index) => ({
      label,
      menuId: target.id,
      index,
      ...(index === 0 ? { dividerLabel: group.label } : {}),
    }));
  });
  return [...own, ...merged];
}

// Résultats de recherche rapide (en-tête) : menus + sous-items correspondant au texte saisi
export interface MenuSearchHit {
  menuLabel: string;
  label: string;
  menuId: string;
  index: number;
  icon: LucideIcon;
  color: string;
}

export function searchMenus(query: string): MenuSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: MenuSearchHit[] = [];
  for (const m of MENUS) {
    m.sub.forEach((label, index) => {
      if (label.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) {
        hits.push({ menuLabel: m.label, label, menuId: m.id, index, icon: m.icon, color: m.color });
      }
    });
  }
  return hits.slice(0, 8);
}
