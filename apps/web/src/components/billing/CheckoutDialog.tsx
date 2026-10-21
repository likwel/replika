import { useState } from "react";
import { AlertTriangle, CalendarCheck, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { billingApi, type BillingPeriod, type PublicPlan, type Quote } from "@/lib/billing.api";
import { payment } from "@/lib/payment";
import { fmtAr, fmtDate } from "@/hooks/usePlan";
import { MOBILE_MONEY } from "@/data/plans";

interface Props {
  plan: PublicPlan;
  period: BillingPeriod;
  quote: Quote;
  onClose: () => void;
}

// Récapitulatif avant paiement d'une formule : montant, échéance, puis fenêtre Papi
export function CheckoutDialog({ plan, period, quote, onClose }: Props) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      // Fenêtre Papi ouverte dans ce clic ; le résultat s'affiche sur la page (PaymentHost)
      await payment.start(() => billingApi.checkout(plan.id, period), {
        label: `Formule ${plan.name} · ${period === "ANNUAL" ? "annuel" : "mensuel"}`,
        amount: quote.amount,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setPaying(false);
    }
  };

  return (
    <Modal
      title={`Formule ${plan.name}`}
      subtitle={period === "ANNUAL" ? "Abonnement annuel · 12 mois" : "Abonnement mensuel · 1 mois"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={pay} disabled={paying}>
            {paying && <Loader2 size={14} className="animate-spin" />}
            Payer {fmtAr(quote.amount)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between rounded-xl px-4 py-3" style={{ background: theme.goldSoft }}>
          <div>
            <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: theme.goldDark }}>
              <CalendarCheck size={14} /> Valable jusqu'au {fmtDate(quote.periodEnd)}
            </p>
            {quote.extraDays > 0 && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
                <Sparkles size={12} /> dont {quote.extraDays} jours convertis depuis votre formule actuelle
              </p>
            )}
          </div>
          <p className="whitespace-nowrap text-2xl font-bold tracking-tight" style={{ color: theme.text }}>{fmtAr(quote.amount)}</p>
        </div>

        {quote.pagesToDeactivate > 0 && (
          <Alert variant="warning" icon={AlertTriangle}>
            {quote.pagesToDeactivate} Page{quote.pagesToDeactivate > 1 ? "s seront désactivées" : " sera désactivée"} : cette formule en permet {plan.limits.pages}.
          </Alert>
        )}

        <p className="flex items-start gap-1.5 text-[12px]" style={{ color: theme.textMuted }}>
          <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
          Paiement sécurisé sur Papi.mg ({MOBILE_MONEY}), dans une fenêtre à part. Aucun prélèvement automatique.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
