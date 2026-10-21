import { useOutletContext } from "react-router-dom";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { BillingSection } from "@/components/settings/BillingSection";
import { TeamSection } from "@/components/settings/TeamSection";
import { PageHeader } from "@/components/ui/PageHeader";

interface Ctx { sub: number }

// Sous-menus : Profil, Sécurité, Préférences, Équipe, Facturation
export function SettingsPage() {
  const { sub } = useOutletContext<Ctx>();
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
