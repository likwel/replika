import { useEffect } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";

interface Ctx { setSub: (i: number) => void }

// Adresses directes vers un onglet : anciennes adresses de Gestion (/app/actualites, /app/messages),
// et /app/facturation (retour de paiement Papi) → Paramètres › Facturation, paramètres d'URL conservés
export function HubRedirect({ tab, to = "/app/gestion" }: { tab: number; to?: string }) {
  const { setSub } = useOutletContext<Ctx>();
  const nav = useNavigate();
  const { search } = useLocation();
  useEffect(() => {
    setSub(tab);
    nav(`${to}${search}`, { replace: true });
  }, []);
  return null;
}
