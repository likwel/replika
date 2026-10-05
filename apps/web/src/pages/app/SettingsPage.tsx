import { useOutletContext } from "react-router-dom";
import { Users, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";

interface Ctx { sub: number }

// Sous-menus : Profil, Sécurité, Préférences, Équipe, Facturation
export function SettingsPage() {
  const { sub } = useOutletContext<Ctx>();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      {sub === 1 ? (
        <SecuritySection />
      ) : sub === 2 ? (
        <PreferencesSection />
      ) : sub === 3 ? (
        <ComingSoon
          icon={Users}
          title="Gestion d'Équipe"
          text="Invitez des collaborateurs pour traiter les messages à plusieurs, avec des rôles (administrateur, modérateur) et l'historique de qui a répondu."
        />
      ) : sub === 4 ? (
        <ComingSoon
          icon={CreditCard}
          title="Abonnement et Facturation"
          text="Votre formule, vos factures et vos moyens de paiement seront gérés ici."
        />
      ) : (
        <ProfileSection />
      )}
    </div>
  );
}

function ComingSoon({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-2xl p-10 text-center" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
        <Icon size={26} style={{ color: theme.gold }} />
      </div>
      <Title className="text-xl">{title}</Title>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: theme.textMuted }}>{text}</p>
      <span className="mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: theme.border, color: theme.textMuted }}>
        Bientôt disponible
      </span>
    </div>
  );
}
