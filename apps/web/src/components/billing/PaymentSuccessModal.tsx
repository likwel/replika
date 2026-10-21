import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Copy, Plug, Radio, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { BRAND_GRADIENT } from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { fmtHours, PAYMENT_METHOD_LABEL, type PaymentRow, type SubscriptionSummary } from "@/lib/billing.api";
import { paymentSuccess, usePaymentSuccess } from "@/lib/paymentSuccess";
import { fmtAr, fmtDate, fmtNum } from "@/hooks/usePlan";

// Monté une fois dans AppLayout
export function PaymentSuccessHost() {
  const data = usePaymentSuccess();
  if (!data) return null;
  return <PaymentSuccessModal key={data.payment.reference} payment={data.payment} subscription={data.subscription} />;
}

// Confettis : positions fixes (rendu stable), couleurs de la marque
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`,
  delay: `${(i % 6) * 0.12}s`,
  size: 5 + (i % 3) * 2,
  round: i % 3 === 0,
  color: ["#FFFFFF", "#FDE68A", "#A7F3D0", "#FFFFFFB0"][i % 4],
}));

function PaymentSuccessModal({ payment: p, subscription: s }: { payment: PaymentRow; subscription: SubscriptionSummary }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const primary = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const hours = p.kind === "LIVE_HOURS";
  const firstName = user?.name.split(" ")[0] ?? "";
  const method = p.paymentMethod ? PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod : null;
  const periodEnd = p.appliedPeriodEnd ?? s.periodEnd;

  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && paymentSuccess.close();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(p.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers indisponible : la référence reste lisible
    }
  };

  const rise = (i: number): CSSProperties => ({ animationDelay: `${0.25 + i * 0.07}s` });

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(10, 20, 26, 0.55)", backdropFilter: "blur(3px)" }}
      onClick={() => paymentSuccess.close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-ok-title"
        className="animate-success-card relative max-h-[94vh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl shadow-2xl sm:rounded-3xl"
        style={{ background: theme.bgCard }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bandeau de marque, coche animée et confettis */}
        <div className="relative h-36 overflow-hidden" style={{ background: BRAND_GRADIENT }}>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="animate-confetti absolute top-0"
              style={{
                left: c.left,
                width: c.size,
                height: c.round ? c.size : c.size * 1.8,
                borderRadius: c.round ? "50%" : 2,
                background: c.color,
                animationDelay: c.delay,
              }}
            />
          ))}
          <div className="absolute inset-x-0 -bottom-px h-10" style={{ background: `linear-gradient(to bottom, transparent, ${theme.bgCard})` }} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <span
              className="animate-success-badge flex h-[76px] w-[76px] items-center justify-center rounded-full"
              style={{ background: theme.bgCard, boxShadow: "0 10px 30px rgba(0,128,105,0.35)" }}
            >
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full" style={{ background: BRAND_GRADIENT }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path className="animate-check-draw" d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 text-center">
          <h2 id="pay-ok-title" className="animate-success-rise text-[22px] font-bold tracking-tight" style={{ ...rise(0), color: theme.text }}>
            Paiement réussi
          </h2>
          <p className="animate-success-rise mt-1 text-[14px]" style={{ ...rise(1), color: theme.textMuted }}>
            {firstName ? `Merci ${firstName} ! ` : "Merci ! "}
            {hours ? `Vos ${p.liveHours} h de Live Manager sont disponibles.` : `Votre formule ${p.planName} est active.`}
          </p>

          {/* Montant */}
          <div className="animate-success-rise mt-4 flex flex-col items-center gap-1.5" style={rise(2)}>
            <p className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: theme.text }}>{fmtAr(p.amount)}</p>
            {method && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: theme.greenSoft, color: theme.green }}>
                <ShieldCheck size={12} /> Payé via {method}
              </span>
            )}
          </div>

          {/* Reçu */}
          <dl
            className="animate-success-rise mt-5 rounded-2xl px-4 py-1 text-left text-[13px]"
            style={{ ...rise(3), background: theme.bg, border: `1px solid ${theme.border}` }}
          >
            <Row label="Achat">{hours ? `${p.liveHours} h de Live Manager` : `Formule ${p.planName} · ${p.period === "ANNUAL" ? "annuel" : "mensuel"}`}</Row>
            {hours ? (
              <Row label="Crédit d'heures">{fmtHours(s.liveCreditSeconds ?? 0)} disponibles</Row>
            ) : (
              periodEnd && (
                <Row label="Valable jusqu'au">
                  {fmtDate(periodEnd)}
                  {p.extraDays ? <span className="block text-[11.5px] font-normal" style={{ color: theme.green }}>dont {p.extraDays} jours convertis</span> : null}
                </Row>
              )
            )}
            <Row label="Date">
              {new Date(p.paidAt ?? Date.now()).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Row>
            <Row label="Référence" last>
              <button onClick={copyRef} className="inline-flex items-center gap-1.5 font-mono text-[12px] hover:underline" title="Copier la référence">
                {p.reference}
                {copied ? <Check size={12} style={{ color: theme.green }} /> : <Copy size={12} style={{ color: theme.textMuted }} />}
              </button>
            </Row>
          </dl>

          {/* Ce que la formule débloque */}
          {!hours && (
            <div className="animate-success-rise mt-4 grid grid-cols-3 gap-2" style={rise(4)}>
              <Perk icon={Plug} value={s.limits.pages === null ? "∞" : String(s.limits.pages)} label="Pages" />
              <Perk icon={Sparkles} value={s.limits.aiReplies === null ? "∞" : fmtNum(s.limits.aiReplies)} label="réponses IA / mois" />
              <Perk icon={Radio} value={s.limits.liveHours === null ? "∞" : `${s.limits.liveHours} h`} label="de live / mois" />
            </div>
          )}

          <div className="animate-success-rise mt-6 flex flex-col gap-2" style={rise(5)}>
            <button
              ref={primary}
              onClick={() => {
                paymentSuccess.close();
                if (hours && !pathname.startsWith("/app/lives")) nav("/app/lives");
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: "0 6px 18px rgba(0,128,105,0.3)" }}
            >
              {hours ? "Aller au Live Manager" : "C'est parti"} <ArrowRight size={16} />
            </button>
            {!pathname.startsWith("/app/parametres") && (
              <button
                onClick={() => {
                  paymentSuccess.close();
                  nav("/app/facturation");
                }}
                className="h-9 rounded-xl text-[13px] font-medium hover:bg-black/5"
                style={{ color: theme.textMuted }}
              >
                Voir la facturation
              </button>
            )}
            {hours && pathname.startsWith("/app/parametres") && (
              <button onClick={() => paymentSuccess.close()} className="h-9 rounded-xl text-[13px] font-medium hover:bg-black/5" style={{ color: theme.textMuted }}>
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: last ? undefined : `1px dashed ${theme.border}` }}>
      <dt style={{ color: theme.textMuted }}>{label}</dt>
      <dd className="text-right font-semibold" style={{ color: theme.text }}>{children}</dd>
    </div>
  );
}

function Perk({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-xl px-2 py-2.5" style={{ background: theme.goldSoft }}>
      <Icon size={15} className="mx-auto" style={{ color: theme.goldDark }} />
      <p className="mt-1 text-[15px] font-bold leading-tight" style={{ color: theme.text }}>{value}</p>
      <p className="text-[10.5px] leading-tight" style={{ color: theme.textMuted }}>{label}</p>
    </div>
  );
}
