import { useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

interface Ctx { setSub: (i: number) => void }

// Anciennes adresses (/app/actualites, /app/messages) → onglet correspondant de Gestion
export function HubRedirect({ tab }: { tab: number }) {
  const { setSub } = useOutletContext<Ctx>();
  const nav = useNavigate();
  useEffect(() => {
    setSub(tab);
    nav("/app/gestion", { replace: true });
  }, []);
  return null;
}
