import { useOutletContext } from "react-router-dom";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { BillingSection } from "@/components/settings/BillingSection";
import { TeamSection } from "@/components/settings/TeamSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { fmtDate, usePlan } from "@/hooks/usePlan";

interface Ctx { sub: number; goTo?: (id: string, sub: number) => void }

// Bandeau du compte, au-dessus de chaque section : qui je suis, ma formule, mon rôle
function AccountStrip({ onBilling }: { onBilling?: () => void }) {
  const { user } = useAuth();
  const { subscription: sub, planName, status, daysLeft } = usePlan();
  if (!user) return null;
  const expired = status === "EXPIRED";
  const planLabel = !planName ? null : status === "TRIAL" ? `Essai ${planName}` : `Formule ${planName}`;
  const detail = expired
    ? "expirée"
    : status === "TRIAL" && daysLeft !== null
      ? `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`
      : sub?.periodEnd
        ? `jusqu'au ${fmtDate(sub.periodEnd)}`
        : null;
  return (
    <div className="card-x flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-4 py-3.5 sm:px-5">
      <Avatar name={user.name} src={user.avatarUrl} size={48} />
      <div className="min-w-0 flex-1 basis-52">
        <p className="truncate text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: "var(--ink)" }}>{user.name}</p>
        <p className="truncate text-[13px]" style={{ color: "var(--ink-3)" }}>{user.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip brand">{user.role === "ADMIN" ? "Administrateur" : "Compte actif"}</span>
        {planLabel && (
          <button onClick={onBilling} className={`chip ${expired ? "bad" : "ok"} cursor-pointer`} title="Ouvrir la facturation">
            {planLabel}{detail ? ` · ${detail}` : ""}
          </button>
        )}
      </div>
    </div>
  );
}

// Sous-menus : Profil, Sécurité, Préférences, Équipe, Facturation
export function SettingsPage() {
  const { sub, goTo } = useOutletContext<Ctx>();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        className="mb-1"
        description={
          sub === 4
            ? "Votre formule SuiteFlow, votre consommation du mois et vos paiements."
            : sub === 3
              ? "Vos collaborateurs, leurs droits module par module, et les équipes que vous avez rejointes."
              : "Votre compte, la sécurité de vos connexions et vos préférences d'affichage."
        }
      />
      <AccountStrip onBilling={goTo ? () => goTo("set", 4) : undefined} />
      {sub === 1 ? (
        <SecuritySection />
      ) : sub === 2 ? (
        <PreferencesSection />
      ) : sub === 3 ? (
        <TeamSection />
      ) : sub === 4 ? (
        <BillingSection />
      ) : (
        <ProfileSection />
      )}
    </div>
  );
}
