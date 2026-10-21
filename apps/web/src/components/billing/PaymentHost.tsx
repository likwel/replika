import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { swal } from "@/lib/swal";
import { billingApi, type PaymentRow, type SubscriptionSummary } from "@/lib/billing.api";
import { paymentSuccess } from "@/lib/paymentSuccess";
import { BILLING_UPDATED, PAYMENT_CHANNEL, PAYMENT_MESSAGE, payment, usePayment } from "@/lib/payment";
import { fmtAr } from "@/hooks/usePlan";
import { MOBILE_MONEY } from "@/data/plans";

const POLL_MS = 4000;
const CONFIRM_TIMEOUT_MS = 3 * 60_000; // Papi a dit « succès » mais la confirmation tarde

type Phase = "waiting" | "closed" | "confirming" | "slow";

// Suivi du paiement ouvert dans la fenêtre Papi : monté une fois dans AppLayout
export function PaymentHost() {
  const { open, reference } = usePayment();
  if (!open || !reference) return null;
  return <PaymentTracker key={reference} reference={reference} />;
}

function PaymentTracker({ reference }: { reference: string }) {
  const { info } = usePayment();
  const { refreshUser } = useAuth();
  const [phase, setPhase] = useState<Phase>("waiting");
  const [checking, setChecking] = useState(false);
  const settled = useRef(false);
  const successAt = useRef<number | null>(null);

  const settle = useCallback(
    async (p: PaymentRow, sub: SubscriptionSummary | null, failedHint = false) => {
      if (settled.current) return;
      if (p.status === "PAID") {
        settled.current = true;
        payment.finish();
        await refreshUser().catch(() => {});
        window.dispatchEvent(new Event(BILLING_UPDATED));
        await paymentSuccess.show({ payment: p, subscription: sub! });
        return;
      }
      if (p.status === "FAILED" || p.status === "EXPIRED" || failedHint) {
        settled.current = true;
        payment.finish();
        window.dispatchEvent(new Event(BILLING_UPDATED));
        const text = `${p.failureMessage ?? "Le paiement n'a pas été effectué."}\nAucun montant n'a été débité.`;
        if (!p.paymentLink) {
          await swal.alert({ variant: "error", title: "Paiement non abouti", text });
          return;
        }
        const retry = await swal.confirm({ variant: "warning", title: "Paiement non abouti", text, confirmText: "Réessayer", cancelText: "Fermer" });
        if (retry && info) void payment.resume(p.reference, p.paymentLink, info);
      }
    },
    [refreshUser, info],
  );

  const check = useCallback(
    async (failedHint = false) => {
      setChecking(true);
      try {
        const r = await billingApi.refresh(reference);
        await settle(r.payment, r.subscription, failedHint);
      } catch {
        // réseau : nouvel essai au prochain passage
      } finally {
        setChecking(false);
      }
    },
    [reference, settle],
  );

  // Vérification régulière + fenêtre fermée par la personne
  useEffect(() => {
    const poll = setInterval(() => void check(), POLL_MS);
    const watch = setInterval(() => {
      if (payment.popupClosed()) {
        setPhase((ph) => (ph === "waiting" ? "closed" : ph));
      }
      if (successAt.current && Date.now() - successAt.current > CONFIRM_TIMEOUT_MS) setPhase("slow");
    }, 800);
    return () => {
      clearInterval(poll);
      clearInterval(watch);
    };
  }, [check]);

  // Fenêtre fermée : une vérification immédiate (le paiement a pu aboutir juste avant)
  useEffect(() => {
    if (phase === "closed") void check();
  }, [phase, check]);

  // Retour de Papi : message de la page /paiement/retour
  useEffect(() => {
    const onResult = (data: unknown) => {
      const d = data as { type?: string; outcome?: string; ref?: string } | null;
      if (!d || d.type !== PAYMENT_MESSAGE || d.ref !== reference) return;
      if (d.outcome === "success") {
        successAt.current = Date.now();
        setPhase("confirming");
        void check();
      } else {
        void check(true);
      }
    };
    const onMessage = (e: MessageEvent) => e.origin === window.location.origin && onResult(e.data);
    window.addEventListener("message", onMessage);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(PAYMENT_CHANNEL);
      channel.onmessage = (e) => onResult(e.data);
    } catch {
      // navigateur sans BroadcastChannel : postMessage et vérification régulière suffisent
    }
    return () => {
      window.removeEventListener("message", onMessage);
      channel?.close();
    };
  }, [reference, check]);

  const cancel = async () => {
    if (phase === "confirming" || phase === "slow") return payment.finish();
    const ok = await swal.confirm({
      title: "Abandonner ce paiement ?",
      text: "Si vous avez déjà validé le paiement sur votre téléphone, il sera tout de même pris en compte automatiquement.",
      confirmText: "Abandonner",
      cancelText: "Continuer le paiement",
      variant: "warning",
    });
    if (ok) payment.finish();
  };

  const text = {
    waiting: "Terminez le paiement dans la fenêtre Papi. Cette page se met à jour toute seule dès que le paiement est confirmé.",
    closed: "La fenêtre de paiement a été fermée. Si le paiement n'est pas terminé, rouvrez-la ; s'il l'est, la confirmation arrive dans un instant.",
    confirming: "Papi a reçu votre paiement : confirmation en cours…",
    slow: "La confirmation prend plus de temps que prévu. Vous pouvez fermer : votre formule sera activée automatiquement dès réception.",
  }[phase];

  return (
    <Modal
      title="Paiement sécurisé"
      subtitle={info?.label}
      onClose={() => void cancel()}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => void cancel()}>
            {phase === "slow" || phase === "confirming" ? "Fermer" : "Annuler"}
          </Button>
          <Button variant="ghost" size="sm" icon={checking ? Loader2 : RefreshCw} onClick={() => void check()} disabled={checking} className={checking ? "[&>svg]:animate-spin" : ""}>
            J'ai payé, vérifier
          </Button>
          {(phase === "waiting" || phase === "closed") && (
            <Button size="sm" icon={ExternalLink} onClick={() => payment.reopen()}>
              {phase === "closed" ? "Rouvrir le paiement" : "Afficher la fenêtre"}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          {phase !== "closed" && (
            <span className="absolute inset-0 animate-spin rounded-full" style={{ border: `3px solid ${theme.goldSoft}`, borderTopColor: theme.gold }} />
          )}
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: theme.goldSoft }}>
            <Smartphone size={22} style={{ color: theme.goldDark }} />
          </span>
        </div>
        {info?.amount !== undefined && (
          <p className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>{fmtAr(info.amount)}</p>
        )}
        <p className="max-w-sm text-[13.5px] leading-relaxed" style={{ color: theme.text }}>{text}</p>
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: theme.textMuted }}>
          <ShieldCheck size={13} style={{ color: theme.green }} /> {MOBILE_MONEY} · paiement traité par Papi.mg
        </p>
      </div>
    </Modal>
  );
}
