import { useState } from "react";
import { AlertTriangle, Clock, Sparkles, X } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { fmtDate, usePlan } from "@/hooks/usePlan";

const DISMISS_KEY = "suiteflow:trialBanner";

const today = () => new Date().toISOString().slice(0, 10);

function dismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === today();
  } catch {
    return false;
  }
}

// Bandeau sous l'en-tête : essai en cours, échéance proche, ou abonnement expiré (automatisations en pause)
export function SubscriptionBanner({ onOpenBilling }: { onOpenBilling: () => void }) {
  const { subscription: s } = usePlan();
  const [hidden, setHidden] = useState(dismissedToday);
  if (!s || s.admin) return null;

  const days = s.daysLeft ?? 0;
  const dayLabel = `${days} jour${days > 1 ? "s" : ""}`;

  if (s.status === "EXPIRED") {
    return (
      <Bar tone="danger">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>{s.kind === "TRIAL" ? "Votre essai gratuit est terminé" : `Votre formule ${s.planName} a expiré`}</strong>
          <span className="hidden md:inline"> : réponses automatiques, IA, lives et publications programmées sont en pause. Les nouveaux messages arrivent toujours dans « À traiter ».</span>
        </p>
        <Button size="sm" variant="danger" onClick={onOpenBilling}>
          {s.kind === "TRIAL" ? "Choisir une formule" : "Renouveler"}
        </Button>
      </Bar>
    );
  }

  if (s.status === "TRIAL") {
    // Masquable pour la journée tant qu'il reste du temps ; les 3 derniers jours, toujours visible
    if (hidden && days > 3) return null;
    return (
      <Bar tone={days <= 3 ? "warning" : "info"}>
        <Sparkles size={16} className="flex-shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>Essai {s.planName} : {days > 0 ? `${dayLabel} restant${days > 1 ? "s" : ""}` : "dernier jour"}</strong>
          <span className="hidden md:inline"> — toutes les fonctionnalités sont ouvertes jusqu'au {fmtDate(s.periodEnd!)}.</span>
        </p>
        <Button size="sm" variant={days <= 3 ? "primary" : "soft"} onClick={onOpenBilling}>Choisir une formule</Button>
        {days > 3 && (
          <button
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem(DISMISS_KEY, today());
              } catch {
                // préférence non mémorisée : le bandeau revient au prochain chargement
              }
            }}
            className="rounded p-1 hover:bg-black/5"
            aria-label="Masquer pour aujourd'hui"
            title="Masquer pour aujourd'hui"
          >
            <X size={15} />
          </button>
        )}
      </Bar>
    );
  }

  // Formule payée : rappel les 5 derniers jours
  if (s.periodEnd && days <= 5) {
    return (
      <Bar tone="warning">
        <Clock size={16} className="flex-shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>Votre formule {s.planName} expire {days === 0 ? "aujourd'hui" : `le ${fmtDate(s.periodEnd)}`}</strong>
          <span className="hidden md:inline"> : renouvelez-la pour que l'assistant continue de répondre sans interruption.</span>
        </p>
        <Button size="sm" onClick={onOpenBilling}>Renouveler</Button>
      </Bar>
    );
  }
  return null;
}

const TONES = {
  info: { bg: theme.goldSoft, color: theme.goldDark },
  warning: { bg: theme.amberSoft, color: theme.amber },
  danger: { bg: theme.dangerBg, color: theme.red },
};

function Bar({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className="animate-fade-in flex flex-shrink-0 items-center gap-2.5 px-3 py-2 text-[13px] sm:px-4"
      style={{ background: t.bg, color: t.color, borderBottom: `1px solid ${theme.border}` }}
    >
      {children}
    </div>
  );
}
