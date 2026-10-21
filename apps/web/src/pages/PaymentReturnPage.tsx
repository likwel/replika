import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { theme } from "@/theme";
import { PAYMENT_CHANNEL, PAYMENT_MESSAGE } from "@/lib/payment";

// Retour de Papi (/paiement/retour?payment=success|failed&ref=…), dans la fenêtre de paiement :
// prévient la page principale puis se ferme. Ouverte sans fenêtre principale (redirection), elle
// renvoie vers Paramètres › Facturation qui affiche le résultat.
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const outcome = params.get("payment") === "success" ? "success" : "failed";
  const ref = params.get("ref") ?? "";
  const [stayed, setStayed] = useState(false);

  useEffect(() => {
    const message = { type: PAYMENT_MESSAGE, outcome, ref };
    let notified = false;
    try {
      const channel = new BroadcastChannel(PAYMENT_CHANNEL);
      channel.postMessage(message);
      channel.close();
      notified = true;
    } catch {
      // BroadcastChannel indisponible
    }
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      opener.postMessage(message, window.location.origin);
      notified = true;
    }
    if (notified && (opener || window.name === "suiteflow-papi")) {
      window.close();
      // Certains navigateurs refusent de fermer la fenêtre : message de repli
      const t = setTimeout(() => setStayed(true), 400);
      return () => clearTimeout(t);
    }
    nav(`/app/facturation?payment=${outcome}&ref=${encodeURIComponent(ref)}`, { replace: true });
  }, []);

  const ok = outcome === "success";
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: theme.canvas }}>
      <div className="max-w-xs text-center">
        {ok ? <CheckCircle2 size={40} className="mx-auto" style={{ color: theme.green }} /> : <XCircle size={40} className="mx-auto" style={{ color: theme.red }} />}
        <p className="mt-3 text-[15px] font-semibold" style={{ color: theme.text }}>{ok ? "Paiement terminé" : "Paiement non abouti"}</p>
        <p className="mt-1 text-[13px]" style={{ color: theme.textMuted }}>
          {stayed ? "Vous pouvez fermer cette fenêtre et revenir sur SuiteFlow." : "Retour sur SuiteFlow…"}
        </p>
        {stayed && (
          <button onClick={() => window.close()} className="mt-4 rounded-md px-3 py-1.5 text-[13px] font-medium" style={{ background: theme.gold, color: theme.onAccent }}>
            Fermer la fenêtre
          </button>
        )}
      </div>
    </div>
  );
}
