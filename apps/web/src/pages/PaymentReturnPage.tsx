import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { theme } from "@/theme";
import { PAYMENT_CHANNEL, PAYMENT_MESSAGE, SUCCESS_CLOSE_DELAY_MS } from "@/lib/payment";

// Retour du paiement (/paiement/retour?payment=success|failed&ref=…), dans la fenêtre de paiement :
// prévient la page principale puis se ferme. Ouverte sans fenêtre principale (redirection), elle
// renvoie vers Paramètres › Facturation qui affiche le résultat.
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const outcome = params.get("payment") === "success" ? "success" : "failed";
  const ref = params.get("ref") ?? "";
  const [stayed, setStayed] = useState(false);
  const [left, setLeft] = useState(Math.ceil(SUCCESS_CLOSE_DELAY_MS / 1000)); // secondes avant la fermeture (paiement réussi)

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
      // Succès : la page principale est prévenue tout de suite, mais la fenêtre reste affichée un instant, avec un compte à rebours
      const delay = outcome === "success" ? SUCCESS_CLOSE_DELAY_MS : 0;
      const tick = delay ? setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000) : null;
      const close = setTimeout(() => {
        window.close();
        // Certains navigateurs refusent de fermer la fenêtre : message de repli
        setTimeout(() => setStayed(true), 400);
      }, delay);
      return () => {
        clearTimeout(close);
        if (tick) clearInterval(tick);
      };
    }
    nav(`/app/facturation?payment=${outcome}&ref=${encodeURIComponent(ref)}`, { replace: true });
  }, []);

  const ok = outcome === "success";
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: theme.canvas }}>
      <div className="max-w-xs text-center">
        {ok ? <CheckCircle2 size={44} className="mx-auto" style={{ color: "#22C55E" }} /> : <XCircle size={40} className="mx-auto" style={{ color: theme.red }} />}
        <p className="mt-3 text-[15px] font-semibold" style={{ color: theme.text }}>{ok ? "Paiement réussi" : "Paiement non abouti"}</p>
        <p className="mt-1 text-[13px]" style={{ color: theme.textMuted }}>
          {stayed
            ? "Vous pouvez fermer cette fenêtre et revenir sur SuiteFlow."
            : ok
              ? `Merci ! Cette fenêtre se ferme dans ${left} s…`
              : "Retour sur SuiteFlow…"}
        </p>
        {ok && !stayed && (
          <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full" style={{ background: theme.border }} aria-hidden>
            <div className="h-full rounded-full" style={{ background: "#22C55E", animation: `closeBar ${SUCCESS_CLOSE_DELAY_MS}ms linear forwards` }} />
            <style>{"@keyframes closeBar{from{width:100%}to{width:0}}"}</style>
          </div>
        )}
        {stayed && (
          <button onClick={() => window.close()} className="mt-4 rounded-md px-3 py-1.5 text-[13px] font-medium" style={{ background: theme.gold, color: theme.onAccent }}>
            Fermer la fenêtre
          </button>
        )}
      </div>
    </div>
  );
}
