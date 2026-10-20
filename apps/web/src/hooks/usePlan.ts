import { useAuth } from "@/context/AuthContext";
import type { Feature } from "@/lib/billing.api";

// Formule de l'utilisateur connecté. Tant qu'elle est inconnue, tout est permis :
// l'API reste seule juge (402 PLAN_REQUIRED / SUBSCRIPTION_INACTIVE).
export function usePlan() {
  const { user } = useAuth();
  const s = user?.subscription;
  return {
    subscription: s ?? null,
    plan: s?.plan ?? null,
    planName: s?.planName ?? "",
    status: s?.status ?? null,
    active: s?.active ?? true,
    daysLeft: s?.daysLeft ?? null,
    limits: s?.limits ?? null,
    can: (feature: Feature) => s?.features[feature] ?? true,
  };
}

// Montants et dates de facturation
export const fmtAr = (n: number) => `${n.toLocaleString("fr-FR").replace(/[  ,]/g, " ")} Ar`;
export const fmtNum = (n: number) => n.toLocaleString("fr-FR").replace(/[  ,]/g, " ");
export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
