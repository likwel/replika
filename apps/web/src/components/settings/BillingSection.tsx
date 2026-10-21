import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check, Clock, CreditCard, ExternalLink, Loader2, Minus, Plug, Radio, RefreshCw, ShieldCheck, Smartphone, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { SettingsCard } from "@/components/settings/SettingsUi";
import { swal } from "@/lib/swal";
import {
  billingApi, fmtHours, paidText, PAYMENT_METHOD_LABEL,
  type BillingOverview, type BillingPeriod, type Quote, type Feature, type PaymentRow, type PaymentStatus, type PlanId, type PublicPlan,
} from "@/lib/billing.api";
import { MOBILE_MONEY } from "@/data/plans";
import { ContactDialog } from "@/components/marketing/ContactDialog";
import { liveHours } from "@/lib/liveHours";
import { BILLING_UPDATED, payment } from "@/lib/payment";
import { paymentSuccess } from "@/lib/paymentSuccess";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { fmtAr, fmtDate, fmtNum } from "@/hooks/usePlan";

const FEATURE_LABELS: Array<[Feature, string]> = [
  ["postAiRules", "Règles IA par publication"],
  ["leads", "Leads : détection et pipeline"],
  ["marketplace", "Marketplace et catalogue"],
  ["advancedStats", "Statistiques avancées"],
];

const EXTRAS: Partial<Record<PlanId, string[]>> = {
  BUSINESS: ["Mise en place accompagnée", "Support prioritaire"],
};

const STATUS_BADGE: Record<PaymentStatus, { label: string; bg: string; color: string }> = {
  PAID: { label: "Payé", bg: theme.greenSoft, color: theme.green },
  PENDING: { label: "En attente", bg: theme.amberSoft, color: theme.amber },
  FAILED: { label: "Échoué", bg: theme.dangerBg, color: theme.red },
  EXPIRED: { label: "Expiré", bg: theme.bg, color: theme.textMuted },
};

const PERIOD_LABEL: Record<BillingPeriod, string> = { MONTHLY: "mensuel", ANNUAL: "annuel" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Paiement en attente : son lien Papi rouvert dans la fenêtre de paiement
const resumePayment = (p: PaymentRow) =>
  payment
    .resume(p.reference, p.paymentLink!, {
      label: p.kind === "LIVE_HOURS" ? `${p.liveHours} h de Live Manager` : `Formule ${p.planName} · ${p.period === "ANNUAL" ? "annuel" : "mensuel"}`,
      amount: p.amount,
    })
    .catch((e: Error) => swal.alert({ variant: "error", title: "Paiement impossible", text: e.message }));


type Return = { kind: "confirming" | "paid" | "pending" | "failed"; payment?: PaymentRow };

// Paramètres › Facturation : formule en cours, consommation, paiement Papi.mg, historique
export function BillingSection() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [ret, setRet] = useState<Return | null>(null);
  const [checkout, setCheckout] = useState<{ plan: PublicPlan; quote: Quote } | null>(null);
  const [params, setParams] = useSearchParams();
  const plansRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () =>
      billingApi
        .overview()
        .then((d) => {
          setData(d);
          setLoadError(null);
          if (d.subscription.billingPeriod) setPeriod(d.subscription.billingPeriod);
        })
        .catch((e: Error) => setLoadError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
    // Paiement terminé dans la fenêtre Papi (PaymentHost) : formule et historique relus
    const onUpdated = () => void load();
    window.addEventListener(BILLING_UPDATED, onUpdated);
    return () => window.removeEventListener(BILLING_UPDATED, onUpdated);
  }, [load]);

  // Retour depuis la page de paiement Papi : seul le statut relu côté serveur fait foi
  useEffect(() => {
    const outcome = params.get("payment");
    const ref = params.get("ref");
    if (!outcome || !ref) return;
    setParams({}, { replace: true });
    let cancelled = false;

    const confirmed = async (r: Awaited<ReturnType<typeof billingApi.refresh>>) => {
      setRet({ kind: "paid", payment: r.payment });
      await refreshUser().catch(() => {});
      await load();
      await paymentSuccess.show({ payment: r.payment, subscription: r.subscription });
    };

    (async () => {
      setRet({ kind: outcome === "success" ? "confirming" : "failed" });
      // Échec annoncé : une seule vérification (un paiement réussi entre-temps reste accepté)
      const attempts = outcome === "success" ? 20 : 1;
      for (let i = 0; i < attempts && !cancelled; i++) {
        try {
          const r = await billingApi.refresh(ref);
          if (cancelled) return;
          if (r.payment.status === "PAID") return void (await confirmed(r));
          if (r.payment.status === "FAILED" || r.payment.status === "EXPIRED" || outcome !== "success") {
            setRet({ kind: "failed", payment: r.payment });
            return;
          }
        } catch {
          // réseau ou Papi indisponible : nouvel essai
        }
        await sleep(3000);
      }
      if (!cancelled && outcome === "success") setRet({ kind: "pending" });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Récapitulatif et numéro du payeur dans une fenêtre, puis paiement Papi (CheckoutDialog)
  const pay = async (plan: PublicPlan) => {
    setBusy(plan.id);
    try {
      setCheckout({ plan, quote: await billingApi.quote(plan.id, period) });
    } catch (e) {
      await swal.alert({ title: "Paiement impossible", text: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const verify = async (p: PaymentRow) => {
    try {
      const r = await billingApi.refresh(p.reference);
      if (r.payment.status === "PAID") {
        swal.toast({ title: "Paiement confirmé", text: paidText(r.payment, r.subscription.periodEnd) });
        await refreshUser().catch(() => {});
      } else if (r.payment.status === "PENDING") {
        swal.toast({ variant: "info", title: "Toujours en attente", text: r.payment.failureMessage ?? "Papi n'a pas encore reçu le paiement." });
      }
      await load();
    } catch (e) {
      swal.toast({ variant: "error", title: "Vérification impossible", text: (e as Error).message });
    }
  };

  if (loadError && !data) {
    return (
      <Alert variant="error" action={<Button size="sm" variant="ghost" onClick={() => void load()}>Réessayer</Button>}>
        {loadError}
      </Alert>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: theme.textMuted }}>
        <Loader2 size={16} className="animate-spin" /> Chargement de votre abonnement…
      </div>
    );
  }

  const sub = data.subscription;
  const scrollToPlans = () => plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const purchasable = data.plans.filter((p) => p.purchasable);
  const agency = data.plans.find((p) => p.id === "AGENCY");

  return (
    <div className="flex flex-col gap-5">
      <ReturnNotice ret={ret} onRetry={scrollToPlans} onClose={() => setRet(null)} />

      <SettingsCard title="Votre formule" description="Formule en cours, échéance et consommation du mois.">
        <CurrentPlan data={data} onChoose={scrollToPlans} />
      </SettingsCard>

      <div ref={plansRef} className="scroll-mt-4">
        <SettingsCard title="Changer ou renouveler" description="Paiement unique pour la période choisie : aucun prélèvement automatique.">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="w-full max-w-[260px]">
              <Segmented
                options={[
                  { value: "MONTHLY", label: "Mensuel" },
                  { value: "ANNUAL", label: "Annuel · -15 %" },
                ]}
                value={period}
                onChange={setPeriod}
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
              <Smartphone size={14} style={{ color: theme.goldDark }} /> {MOBILE_MONEY}
            </p>
          </div>

          {!data.papiConfigured && (
            <Alert variant="warning" className="mb-4">
              Le paiement en ligne n'est pas encore activé sur ce serveur (clés Papi manquantes). Contactez-nous pour souscrire.
            </Alert>
          )}
          {data.papiConfigured && data.testMode && (
            <Alert variant="info" className="mb-4">
              <strong>Mode test Papi</strong> : aucun débit réel. Numéros de test : MVola 034 12 300 01, Orange Money 032 12 300 01,
              Airtel Money 033 12 300 01 ; carte 4242 4242 4242 4242.
            </Alert>
          )}
          {sub.admin && (
            <Alert variant="info" className="mb-4">Compte administrateur : toutes les fonctionnalités sont ouvertes, sans limite.</Alert>
          )}

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            {purchasable.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                period={period}
                current={sub.plan === plan.id && !sub.admin}
                trial={sub.kind === "TRIAL"}
                active={sub.active}
                busy={busy === plan.id}
                disabled={!data.papiConfigured || (busy !== null && busy !== plan.id)}
                onPay={() => void pay(plan)}
              />
            ))}
          </div>
          {agency && <AgencyCard current={sub.plan === "AGENCY" && !sub.admin} />}
          <p className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: theme.textMuted }}>
            <ShieldCheck size={14} className="mt-px flex-shrink-0" style={{ color: theme.goldDark }} />
            Prolonger la même formule ajoute la période à votre échéance. Changer de formule convertit les jours restants en jours sur la nouvelle.
          </p>
        </SettingsCard>
      </div>

      {checkout && (
        <CheckoutDialog plan={checkout.plan} period={period} quote={checkout.quote} onClose={() => setCheckout(null)} />
      )}

      <SettingsCard title="Historique des paiements" description="Vos paiements Papi et leur statut.">
        <PaymentHistory payments={data.payments} onVerify={verify} />
      </SettingsCard>
    </div>
  );
}

// ─── Retour de paiement ──────────────────────────────────────────────────────

function ReturnNotice({ ret, onRetry, onClose }: { ret: Return | null; onRetry: () => void; onClose: () => void }) {
  if (!ret) return null;
  if (ret.kind === "confirming") {
    return (
      <Alert variant="info" icon={Loader2} className="[&>svg]:animate-spin">
        Confirmation de votre paiement auprès de Papi…
      </Alert>
    );
  }
  if (ret.kind === "paid" && ret.payment) {
    return (
      <Alert variant="success" onClose={onClose}>
        <strong>Paiement reçu, merci !</strong> {paidText(ret.payment, null)}
      </Alert>
    );
  }
  if (ret.kind === "pending") {
    return (
      <Alert variant="warning" onClose={onClose}>
        Paiement en cours de confirmation par Papi : votre formule sera activée automatiquement dans quelques minutes.
        Vous pouvez aussi cliquer sur « Vérifier » dans l'historique.
      </Alert>
    );
  }
  return (
    <Alert
      variant="error"
      onClose={onClose}
      action={
        ret.payment?.paymentLink ? (
          <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => void resumePayment(ret.payment!)}>
            Réessayer le paiement
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onRetry}>Choisir à nouveau</Button>
        )
      }
    >
      <strong>Paiement non abouti.</strong> Aucun montant n'a été débité.
      {ret.payment?.failureMessage ? ` (${ret.payment.failureMessage})` : ""}
    </Alert>
  );
}

// ─── Formule en cours et consommation ────────────────────────────────────────

function CurrentPlan({ data, onChoose }: { data: BillingOverview; onChoose: () => void }) {
  const s = data.subscription;
  const u = data.usage;
  const badge =
    s.status === "EXPIRED"
      ? { label: "Expirée", bg: theme.dangerBg, color: theme.red }
      : s.status === "TRIAL"
        ? { label: "Essai gratuit", bg: theme.goldSoft, color: theme.goldDark }
        : { label: "Active", bg: theme.greenSoft, color: theme.green };
  const days = s.daysLeft;

  let when: string;
  if (s.admin) when = "Accès administrateur, sans échéance.";
  else if (!s.periodEnd) when = "Sans échéance.";
  else if (s.status === "EXPIRED") when = `${s.kind === "TRIAL" ? "Essai terminé" : "Expirée"} depuis le ${fmtDate(s.periodEnd)}.`;
  else
    when = `${s.status === "TRIAL" ? "Essai jusqu'au" : "Valable jusqu'au"} ${fmtDate(s.periodEnd)} · ${days} jour${(days ?? 0) > 1 ? "s" : ""} restant${(days ?? 0) > 1 ? "s" : ""}${s.billingPeriod ? ` · ${PERIOD_LABEL[s.billingPeriod]}` : ""}`;

  return (
    <>
      {s.status === "EXPIRED" && (
        <Alert variant="error" className="mb-4">
          Réponses automatiques, IA, lives et publications programmées sont <strong>en pause</strong>. Vos données sont conservées et
          les nouveaux messages arrivent toujours dans « À traiter » : renouvelez pour tout réactiver.
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: theme.goldSoft }}>
          <CreditCard size={20} style={{ color: theme.goldDark }} />
        </div>
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold" style={{ color: theme.text }}>{s.planName}</p>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
          </div>
          <p className="text-[13px]" style={{ color: theme.textMuted }}>{when}</p>
        </div>
        {!s.admin && s.plan !== "AGENCY" && (
          <Button variant={s.active ? "soft" : "primary"} onClick={onChoose} className="w-full justify-center sm:w-auto">
            {s.status === "TRIAL" ? "Choisir une formule" : s.active ? "Prolonger ou changer" : "Renouveler"}
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Meter icon={Plug} label="Pages actives" used={u.pages} limit={s.limits.pages} format={fmtNum} />
        <Meter icon={Sparkles} label="Réponses IA ce mois-ci" used={u.aiReplies} limit={s.limits.aiReplies} format={fmtNum} />
        <Meter
          icon={Radio}
          label="Heures de live ce mois-ci"
          used={u.liveSeconds / 3600}
          limit={s.limits.liveHours}
          format={(n) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`}
        />
      </div>
      <LiveCreditRow credit={s.liveCreditSeconds ?? 0} used={u.liveCreditUsed ?? 0} price={data.liveHourPrice} />
      <p className="mt-2 text-[11.5px]" style={{ color: theme.textMuted }}>
        Les volumes repartent à zéro le 1er de chaque mois. Les réponses par mots-clés sont illimitées.
      </p>
    </>
  );
}

function Meter({ icon: Icon, label, used, limit, format }: { icon: LucideIcon; label: string; used: number; limit: number | null; format: (n: number) => string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const color = limit === null ? theme.green : pct >= 100 ? theme.red : pct >= 80 ? theme.amber : theme.gold;
  return (
    <div className="rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.textMuted }}>
        <Icon size={13} /> {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: theme.text }}>
        <strong className="text-base">{format(used)}</strong>
        <span style={{ color: theme.textMuted }}> / {limit === null ? "illimité" : format(limit)}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: theme.border }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: limit === null ? "100%" : `${Math.max(pct, used > 0 ? 3 : 0)}%`, background: color, opacity: limit === null ? 0.35 : 1 }}
        />
      </div>
    </div>
  );
}

// Heures de Live Manager à l'unité : solde et achat
function LiveCreditRow({ credit, used, price }: { credit: number; used: number; price: number }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3.5 py-3" style={{ background: theme.goldSoft }}>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: theme.bgCard }}>
        <Clock size={17} style={{ color: theme.goldDark }} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold" style={{ color: theme.text }}>
          Heures de live achetées : {fmtHours(credit)}
        </p>
        <p className="text-[12px]" style={{ color: theme.textMuted }}>
          {fmtAr(price)} l'heure, sans expiration. Utilisées après les heures de la formule, ou si l'abonnement est terminé
          {used > 0 ? ` · ${fmtHours(used)} utilisées ce mois-ci` : ""}.
        </p>
      </div>
      <Button size="sm" icon={Radio} onClick={() => liveHours.open()} className="w-full justify-center sm:w-auto">
        Acheter des heures
      </Button>
    </div>
  );
}

// ─── Formules ────────────────────────────────────────────────────────────────

function PlanCard({
  plan, period, current, trial, active, busy, disabled, onPay,
}: {
  plan: PublicPlan;
  period: BillingPeriod;
  current: boolean;
  trial: boolean;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  onPay: () => void;
}) {
  const annual = period === "ANNUAL";
  const perMonth = annual ? plan.annualMonthly! : plan.monthly!;
  const saving = plan.monthly! * 12 - (plan.annual ?? 0);
  const label = current && !trial ? (active ? "Prolonger" : "Renouveler") : `Choisir ${plan.name}`;
  const highlight = plan.id === "PRO";

  return (
    <div
      className="relative flex flex-col rounded-xl p-4"
      style={{
        background: theme.bgCard,
        border: `1px solid ${current ? theme.gold : theme.border}`,
        boxShadow: current ? `0 0 0 1px ${theme.gold}` : undefined,
      }}
    >
      {(current || highlight) && (
        <span
          className="absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={current ? { background: theme.gold, color: theme.onAccent } : { background: theme.bgDark, color: "#fff" }}
        >
          {current ? (trial ? "Votre essai" : "Votre formule") : "Populaire"}
        </span>
      )}
      <p className="text-[15px] font-semibold" style={{ color: theme.text }}>{plan.name}</p>
      <p className="mt-1.5">
        <span className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>{fmtNum(perMonth)}</span>
        <span className="text-[13px]" style={{ color: theme.textMuted }}> Ar/mois</span>
      </p>
      <p className="flex min-h-[20px] flex-wrap items-center gap-x-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
        {annual ? (
          <>
            {fmtAr(plan.annual!)} par an
            <span className="rounded-full px-1.5 font-semibold" style={{ background: theme.greenSoft, color: theme.green }}>
              -{fmtNum(saving)} Ar
            </span>
          </>
        ) : (
          "sans engagement"
        )}
      </p>

      <ul className="my-3 flex flex-col gap-1.5 text-[12.5px]" style={{ color: theme.text }}>
        <Line ok>{plan.limits.pages} Pages + Instagram</Line>
        <Line ok>{fmtNum(plan.limits.aiReplies!)} réponses IA/mois</Line>
        <Line ok>{plan.limits.liveHours} h de live/mois</Line>
        {FEATURE_LABELS.map(([f, l]) => (
          <Line key={f} ok={plan.features[f]}>{l}</Line>
        ))}
        {EXTRAS[plan.id]?.map((x) => <Line key={x} ok>{x}</Line>)}
      </ul>

      <Button
        className="mt-auto w-full justify-center"
        variant={current || highlight ? "primary" : "ghost"}
        disabled={disabled || busy}
        onClick={onPay}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}

// Agence : sur devis, activée par l'équipe SuiteFlow
function AgencyCard({ current }: { current: boolean }) {
  const [contact, setContact] = useState(false);
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-4 py-3"
      style={{ background: theme.bg, border: `1px ${current ? "solid" : "dashed"} ${current ? theme.gold : theme.border}` }}
    >
      <div className="min-w-0 flex-1 basis-60">
        <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: theme.text }}>
          Agence <span className="text-[13px] font-normal" style={{ color: theme.textMuted }}>· sur devis</span>
          {current && (
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ background: theme.gold, color: theme.onAccent }}>
              Votre formule
            </span>
          )}
        </p>
        <p className="text-[12.5px]" style={{ color: theme.textMuted }}>
          Pages illimitées, volume IA sur mesure, lives illimités, tarif dégressif par marque et accompagnement dédié.
        </p>
      </div>
      <Button variant="ghost" onClick={() => setContact(true)}>Nous contacter</Button>
      {contact && <ContactDialog subject="AGENCY" title="Formule Agence : demande de devis" onClose={() => setContact(false)} />}
    </div>
  );
}

function Line({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5" style={{ color: ok ? theme.text : theme.textMuted }}>
      {ok ? (
        <Check size={14} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
      ) : (
        <Minus size={14} className="mt-px flex-shrink-0" style={{ opacity: 0.6 }} />
      )}
      <span className={ok ? undefined : "line-through decoration-1 opacity-70"}>{children}</span>
    </li>
  );
}

// ─── Historique ──────────────────────────────────────────────────────────────

function PaymentHistory({ payments, onVerify }: { payments: PaymentRow[]; onVerify: (p: PaymentRow) => Promise<void> }) {
  const [checking, setChecking] = useState<string | null>(null);
  if (!payments.length) {
    return <p className="text-sm" style={{ color: theme.textMuted }}>Aucun paiement pour l'instant.</p>;
  }
  return (
    <ul className="-mx-1 flex flex-col">
      {payments.map((p, i) => {
        const b = STATUS_BADGE[p.status];
        return (
          <li
            key={p.reference}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg px-1 py-2.5"
            style={{ borderTop: i ? `1px solid ${theme.border}` : undefined }}
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm font-medium" style={{ color: theme.text }}>
                {p.kind === "LIVE_HOURS" ? `Live Manager · ${p.liveHours} h` : `${p.planName} · ${p.period ? PERIOD_LABEL[p.period] : ""}`}
              </p>
              <p className="truncate text-xs" style={{ color: theme.textMuted }}>
                {fmtDate(p.paidAt ?? p.createdAt)}
                {p.paymentMethod ? ` · ${PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}` : ""}
                {p.status === "PAID" && p.appliedPeriodEnd ? ` · jusqu'au ${fmtDate(p.appliedPeriodEnd)}` : ""}
                {p.status !== "PAID" && p.failureMessage ? ` · ${p.failureMessage}` : ""}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums" style={{ color: theme.text }}>{fmtAr(p.amount)}</p>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: b.bg, color: b.color }}>{b.label}</span>
            {p.status === "PENDING" && (
              <div className="flex gap-1.5">
                {p.paymentLink && (
                  <Button size="sm" variant="soft" icon={ExternalLink} onClick={() => void resumePayment(p)}>Payer</Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={checking === p.reference ? undefined : RefreshCw}
                  disabled={checking === p.reference}
                  onClick={async () => {
                    setChecking(p.reference);
                    await onVerify(p);
                    setChecking(null);
                  }}
                >
                  {checking === p.reference && <Loader2 size={14} className="animate-spin" />}
                  Vérifier
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
