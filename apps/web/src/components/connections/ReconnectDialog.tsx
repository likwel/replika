import { useState } from "react";
import { Facebook, Loader2 } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { facebookApi } from "@/lib/facebook.api";

interface Props {
  accountName?: string; // Page à reconnecter en particulier
  connect?: boolean; // ajout d'un compte (bouton « + » de l'en-tête) plutôt que reconnexion
  onClose: () => void;
}

// Facebook ne propose le choix des Pages que via « Modifier les paramètres » : on l'explique avant d'y aller
export function ReconnectDialog({ accountName, connect = false, onClose }: Props) {
  const [going, setGoing] = useState(false);
  const steps = [
    ["Continuez avec votre compte", "Connectez-vous avec le profil Facebook qui gère vos Pages."],
    connect
      ? ["Choisissez vos Pages", "Si Facebook affiche « Modifier les paramètres », cliquez dessus pour voir la liste de vos Pages."]
      : ["Cliquez sur « Modifier les paramètres »", "Sinon Facebook réutilise l'ancienne sélection de Pages sans vous la montrer."],
    [
      accountName ? `Cochez « ${accountName} » et toutes vos Pages` : "Cochez toutes vos Pages et comptes Instagram",
      "Une Page non cochée ne pourra plus être gérée par SuiteFlow.",
    ],
    ["Laissez toutes les autorisations activées", "Commentaires, messages, publication et lives en dépendent."],
  ];

  return (
    <Modal
      title={connect ? "Connecter Facebook et Instagram" : "Reconnecter Facebook"}
      subtitle={
        connect
          ? "Ajoutez une Page Facebook ou un compte Instagram professionnel : l'assistant IA de SuiteFlow pourra y répondre 24h/24. Connexion officielle Meta, sans mot de passe."
          : "Renouvelle l'accès de SuiteFlow à vos Pages et comptes Instagram. Vos réglages et historiques sont conservés."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            onClick={() => {
              setGoing(true);
              facebookApi.connect().catch(() => setGoing(false));
            }}
            disabled={going}
          >
            {going ? <Loader2 size={15} className="animate-spin" /> : <Facebook size={15} />} Continuer vers Facebook
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium" style={{ color: theme.text }}>{title}</p>
              <p className="text-xs" style={{ color: theme.textMuted }}>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
