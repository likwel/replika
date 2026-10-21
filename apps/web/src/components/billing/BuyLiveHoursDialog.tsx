import { useEffect, useState } from "react";
import { Clock, Loader2, Minus, Plus, Radio, ShieldCheck, Smartphone } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { billingApi, fmtHours, liveHoursLeft, type BillingOverview } from "@/lib/billing.api";
import { liveHours, useLiveHoursDialog } from "@/lib/liveHours";
import { payment } from "@/lib/payment";
import { fmtAr, fmtNum } from "@/hooks/usePlan";
import { MOBILE_MONEY } from "@/data/plans";
import { PhoneField, displayPhone, normalizePhone } from "./PhoneField";

const PACKS = [2, 5, 10, 20];
const MAX_HOURS = 200;

// Fenêtre d'achat d'heures de Live Manager à l'unité : montée une fois dans AppLayout
export function BuyLiveHoursHost() {
  const { open, reason } = useLiveHoursDialog();
  if (!open) return null;
  return <BuyLiveHoursDialog reason={reason} onClose={liveHours.close} />;
}

function BuyLiveHoursDialog({ reason, onClose }: { reason: string | null; onClose: () => void }) {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hours, setHours] = useState(5);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    billingApi
      .overview()
      .then((o) => {
        setData(o);
        setPhone((p) => p || displayPhone(o.paymentPhone));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const price = data?.liveHourPrice ?? 0;
  const total = hours * price;
  const left = data ? liveHoursLeft(data) : null;
  const clamp = (n: number) => Math.min(MAX_HOURS, Math.max(1, Math.round(n) || 1));

  const pay = async () => {
    setTouched(true);
    const p = normalizePhone(phone);
    if (!p) return;
    setPaying(true);
    setError(null);
    try {
      // Fenêtre Papi à part : la page reste ouverte et affiche le résultat
      await payment.start(() => billingApi.buyLiveHours(hours, p), { label: `${hours} h de Live Manager`, amount: total });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setPaying(false);
    }
  };

  return (
    <Modal
      title="Acheter des heures de Live Manager"
      subtitle="Des heures à l'unité, utilisables quand votre formule n'en a plus ce mois-ci ou après la fin de votre abonnement."
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
              icon={Radio}
              label="Formule, ce mois-ci"
              value={left!.quota === null ? "Illimité" : data.subscription.active ? fmtHours(left!.quota) : "Expirée"}
              muted={!data.subscription.active || left!.quota === 0}
            />
            <Balance icon={Clock} label="Heures achetées" value={fmtHours(left!.credit)} muted={left!.credit === 0} />
          </div>

          {/* Choix */}
          <div>
            <p className="mb-2 text-[13px] font-semibold" style={{ color: theme.text }}>Combien d'heures ?</p>
            <div className="grid grid-cols-4 gap-2">
              {PACKS.map((h) => {
                const on = hours === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className="rounded-xl py-2.5 text-center transition-colors"
                    style={{ background: on ? theme.goldSoft : theme.bg, border: `1.5px solid ${on ? theme.gold : theme.border}` }}
                    aria-pressed={on}
                  >
                    <span className="block text-[15px] font-semibold" style={{ color: on ? theme.goldDark : theme.text }}>{h} h</span>
                    <span className="block text-[11px]" style={{ color: theme.textMuted }}>{fmtNum(h * price)} Ar</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <span className="text-[13px]" style={{ color: theme.textMuted }}>Autre nombre d'heures</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setHours((h) => clamp(h - 1))} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Une heure de moins">
                  <Minus size={14} style={{ color: theme.text }} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_HOURS}
                  value={hours}
                  onChange={(e) => setHours(clamp(Number(e.target.value)))}
                  className="w-14 rounded-lg px-2 py-1 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-gold/40"
                  style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
                  aria-label="Nombre d'heures"
                />
                <button type="button" onClick={() => setHours((h) => clamp(h + 1))} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Une heure de plus">
                  <Plus size={14} style={{ color: theme.text }} />
                </button>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-end justify-between rounded-xl px-4 py-3" style={{ background: theme.goldSoft }}>
            <div>
              <p className="text-[12px]" style={{ color: theme.goldDark }}>{hours} h × {fmtAr(price)} par heure</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>Paiement unique · {MOBILE_MONEY}</p>
            </div>
            <p className="whitespace-nowrap text-xl font-bold tracking-tight" style={{ color: theme.text }}>{fmtAr(total)}</p>
          </div>

          <PhoneField value={phone} onChange={setPhone} touched={touched} />

          <ul className="flex flex-col gap-1.5 text-[12px]" style={{ color: theme.textMuted }}>
            <li className="flex items-start gap-1.5">
              <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
              Les heures de votre formule sont utilisées d'abord ; les heures achetées prennent le relais, sans date d'expiration.
            </li>
            <li className="flex items-start gap-1.5">
              <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
              Abonnement terminé : Live Manager continue (capture des JP, messages aux clients, factures) tant qu'il reste des heures.
            </li>
          </ul>

          {!data.papiConfigured && <Alert variant="warning">Le paiement en ligne n'est pas encore activé : contactez-nous.</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}

function Balance({ icon: Icon, label, value, muted }: { icon: typeof Clock; label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
        <Icon size={12} /> {label}
      </p>
      <p className="mt-0.5 text-base font-semibold" style={{ color: muted ? theme.textMuted : theme.text }}>{value}</p>
    </div>
  );
}
