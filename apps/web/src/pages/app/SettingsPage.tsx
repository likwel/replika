import { useOutletContext } from "react-router-dom";
import { Users } from "lucide-react";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { BillingSection } from "@/components/settings/BillingSection";
import { StateCard } from "@/components/ui/StateCard";
import { PageHeader } from "@/components/ui/PageHeader";

interface Ctx { sub: number }

// Sous-menus : Profil, Sécurité, Préférences, Équipe, Facturation
export function SettingsPage() {
  const { sub } = useOutletContext<Ctx>();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        className="mb-1"
        description={
          sub === 4
            ? "Votre formule SuiteFlow, votre consommation du mois et vos paiements."
            : "Votre compte, la sécurité de vos connexions et vos préférences d'affichage."
        }
      />
      {sub === 1 ? (
        <SecuritySection />
      ) : sub === 2 ? (
        <PreferencesSection />
      ) : sub === 3 ? (
        <StateCard
          icon={Users}
          title="Gestion d'Équipe"
          badge="Bientôt disponible"
        >
          Invitez des collaborateurs pour traiter les messages à plusieurs, avec des rôles (administrateur, modérateur) et l'historique de qui a répondu.
        </StateCard>
      ) : sub === 4 ? (
        <BillingSection />
      ) : (
        <ProfileSection />
      )}
    </div>
  );
}
