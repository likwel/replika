import { useAuth } from "@/context/AuthContext";
import type { Access, TeamModule } from "@/lib/team.api";

// Menu → module de permission d'équipe (null : toujours accessible, comme Paramètres)
export const MENU_MODULE: Record<string, TeamModule | null> = {
  hub: "inbox",
  live: "live",
  market: "marketplace",
  leads: "leads",
  plan: "schedule",
  auto: "automation",
  stat: "stats",
  hist: "history",
  conn: "connections",
  set: null,
  admin: null,
};

const BILLING_SUB = 4; // Paramètres → Facturation

export function menuModule(menuId: string, sub?: number): TeamModule | null {
  return menuId === "set" && sub === BILLING_SUB ? "billing" : (MENU_MODULE[menuId] ?? null);
}

// Droits dans l'espace ouvert. Dans son propre espace, tout est permis ; dans celui d'une équipe,
// les droits du membre s'appliquent (l'API reste seule juge : 403 TEAM_FORBIDDEN).
export function useAccess() {
  const { user } = useAuth();
  const current = user?.workspace?.current ?? null;
  const can = (module: TeamModule | null, level: Access = "read") => {
    if (!current || !module) return true;
    const p = current.permissions[module];
    return p === "write" || (level === "read" && p === "read");
  };
  return {
    current,
    member: Boolean(current),
    can,
    canMenu: (menuId: string, sub?: number) => can(menuModule(menuId, sub)),
    readOnly: (module: TeamModule | null) => Boolean(current && module && current.permissions[module] === "read"),
  };
}
