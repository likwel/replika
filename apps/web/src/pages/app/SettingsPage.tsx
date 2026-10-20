import { useOutletContext } from "react-router-dom";
import { Users, CreditCard } from "lucide-react";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { StateCard } from "@/components/ui/StateCard";
import { PageHeader } from "@/components/ui/PageHeader";

interface Ctx { sub: number }

// Sous-menus : Profil, Sécurité, Préférences, Équipe, Facturation
export function SettingsPage() {
  const { sub } = useOutletContext<Ctx>();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader className="mb-1" description="Votre compte, la sécurité de vos connexions et vos préférences d'affichage." />
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
        <StateCard
          icon={CreditCard}
          title="Abonnement et Facturation"
          badge="Bientôt disponible"
        >
          Votre formule, vos factures et vos moyens de paiement seront gérés ici.
        </StateCard>
      ) : (
        <ProfileSection />
      )}
    </div>
  );
}
