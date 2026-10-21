import { useEffect, useState } from "react";
import { Coins, Loader2, Minus, Plus, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { billingApi, repliesLeft, type BillingOverview } from "@/lib/billing.api";
import { replyCredits, useReplyCreditsDialog } from "@/lib/replyCredits";
import { payment } from "@/lib/payment";
import { fmtAr, fmtNum } from "@/hooks/usePlan";
import { MOBILE_MONEY } from "@/data/plans";

const PACKS = [1, 3, 5, 10];
const MAX_PACKS = 50;

// Fenêtre d'achat de crédits de réponses automatiques : montée une fois dans AppLayout
export function BuyReplyCreditsHost() {
  const { open, reason } = useReplyCreditsDialog();
  if (!open) return null;
  return <BuyReplyCreditsDialog reason={reason} onClose={replyCredits.close} />;
}

function BuyReplyCreditsDialog({ reason, onClose }: { reason: string | null; onClose: () => void }) {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [packs, setPacks] = useState(1);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi
      .overview()
      .then(setData)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const size = data?.replyPack.size ?? 0;
  const price = data?.replyPack.price ?? 0;
  const credits = packs * size;
  const total = packs * price;
  const left = data ? repliesLeft(data) : null;
  const clamp = (n: number) => Math.min(MAX_PACKS, Math.max(1, Math.round(n) || 1));

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      // Fenêtre Papi à part : la page reste ouverte et affiche le résultat
      await payment.start(() => billingApi.buyReplyCredits(packs), { label: `${fmtNum(credits)} réponses automatiques`, amount: total });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setPaying(false);
    }
  };

  return (
    <Modal
      title="Recharger des réponses automatiques"
      subtitle="Des crédits de réponses, utilisés quand le quota IA de votre formule est épuisé ou après la fin de votre abonnement."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={pay} disabled={!data || paying || !data.papiConfigured}>
            {paying ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
            {data ? `Payer ${fmtAr(total)}` : "Payer"}
          </Button>
        </>
      }
    >
      {reason && <Alert variant="warning" className="mb-4">{reason}</Alert>}
      {loadError && <Alert variant="error" className="mb-4">{loadError}</Alert>}

      {!data ? (
        !loadError && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: theme.textMuted }}>
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {/* Solde */}
          <div className="grid grid-cols-2 gap-2">
            <Balance
              icon={Sparkles}
              label="Réponses IA de la formule"
              value={left!.quota === null ? "Illimité" : data.subscription.active ? `${fmtNum(left!.quota)} restantes` : "Expirée"}
              muted={!data.subscription.active || left!.quota === 0}
            />
            <Balance icon={Coins} label="Crédits achetés" value={fmtNum(left!.credit)} muted={left!.credit === 0} />
          </div>

          {/* Choix */}
          <div>
            <p className="mb-2 text-[13px] font-semibold" style={{ color: theme.text }}>Combien de réponses ?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PACKS.map((n) => {
                const on = packs === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPacks(n)}
                    className="rounded-xl py-2.5 text-center transition-colors"
                    style={{ background: on ? theme.goldSoft : theme.bg, border: `1.5px solid ${on ? theme.gold : theme.border}` }}
                    aria-pressed={on}
                  >
                    <span className="block text-[15px] font-semibold tabular-nums" style={{ color: on ? theme.goldDark : theme.text }}>{fmtNum(n * size)}</span>
                    <span className="block text-[11px] tabular-nums" style={{ color: theme.textMuted }}>{fmtNum(n * price)} Ar</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <span className="text-[13px]" style={{ color: theme.textMuted }}>Packs de {fmtNum(size)} réponses</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPacks((p) => clamp(p - 1))} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Un pack de moins">
                  <Minus size={14} style={{ color: theme.text }} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_PACKS}
                  value={packs}
                  onChange={(e) => setPacks(clamp(Number(e.target.value)))}
                  className="w-14 rounded-lg px-2 py-1 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-gold/40"
                  style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
                  aria-label="Nombre de packs"
                />
                <button type="button" onClick={() => setPacks((p) => clamp(p + 1))} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Un pack de plus">
                  <Plus size={14} style={{ color: theme.text }} />
                </button>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-end justify-between rounded-xl px-4 py-3" style={{ background: theme.goldSoft }}>
            <div>
              <p className="text-[12px]" style={{ color: theme.goldDark }}>
                {fmtNum(credits)} réponses · {packs} pack{packs > 1 ? "s" : ""} × {fmtAr(price)}
              </p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>Paiement unique · {MOBILE_MONEY}</p>
            </div>
            <p className="whitespace-nowrap text-xl font-bold tracking-tight" style={{ color: theme.text }}>{fmtAr(total)}</p>
          </div>

          <ul className="flex flex-col gap-1.5 text-[12px]" style={{ color: theme.textMuted }}>
            <li className="flex items-start gap-1.5">
              <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
              Les réponses IA de votre formule sont utilisées d'abord ; les crédits prennent le relais, sans date d'expiration.
            </li>
            <li className="flex items-start gap-1.5">
              <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
              Abonnement terminé : vos règles et l'assistant IA continuent de répondre, 1 crédit par réponse envoyée.
            </li>
            <li className="flex items-start gap-1.5">
              <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
              Formule active : les réponses par mots-clés restent illimitées et ne consomment aucun crédit.
            </li>
          </ul>

          {!data.papiConfigured && <Alert variant="warning">Le paiement en ligne n'est pas encore activé : contactez-nous.</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}

function Balance({ icon: Icon, label, value, muted }: { icon: LucideIcon; label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
        <Icon size={12} /> {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums" style={{ color: muted ? theme.textMuted : theme.text }}>{value}</p>
    </div>
  );
}
