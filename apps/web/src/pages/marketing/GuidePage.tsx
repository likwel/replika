import { Link } from "react-router-dom";
import {
  UserPlus, Facebook, ShieldCheck, Bot, Settings2, Rocket,
  CheckCircle2, AlertTriangle, ArrowRight, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { LegalLayout } from "@/components/marketing/LegalLayout";

interface Step {
  icon: LucideIcon;
  title: string;
  where?: string; // emplacement dans l'application
  points: string[];
  tip?: string;
  warn?: string;
}

const steps: Step[] = [
  {
    icon: UserPlus,
    title: "1. Créez votre compte",
    points: [
      "Cliquez sur « Essai gratuit » depuis la page d'accueil, ou allez directement sur la page d'inscription.",
      "Renseignez votre nom, votre adresse e-mail et un mot de passe d'au moins 8 caractères.",
      "Vous êtes automatiquement connecté après l'inscription.",
    ],
  },
  {
    icon: Facebook,
    title: "2. Connectez vos Pages Facebook et vos comptes Instagram",
    where: "Menu Connexions",
    points: [
      "Ouvrez Connexions puis cliquez sur Facebook.",
      "Connectez-vous avec le profil Facebook qui gère vos Pages, puis cliquez sur « Modifier les paramètres » dans la fenêtre proposée par Facebook.",
      "Cochez toutes les Pages et tous les comptes Instagram professionnels que vous voulez gérer depuis ReplyKA, ainsi que toutes les autorisations demandées (commentaires, messages, publication, statistiques).",
    ],
    tip: "Un compte Instagram doit être un compte professionnel lié à une Page Facebook pour apparaître dans la liste.",
    warn: "Une Page non cochée à cette étape ne pourra pas être gérée par ReplyKA. En cas de doute, cochez toutes les Pages proposées.",
  },
  {
    icon: ShieldCheck,
    title: "3. Vérifiez l'état de chaque compte",
    where: "Menu Automatisation",
    points: [
      "Le panneau « État de l'automatisation » en haut de la page indique, compte par compte, si l'accès Facebook est valide, si les autorisations sont accordées et si les commentaires/messages reçoivent une réponse.",
      "Un compte signalé « Bloqué » ou « À compléter » a un bouton pour agir directement : reconnecter, activer, ou créer une règle.",
    ],
  },
  {
    icon: Bot,
    title: "4. Configurez vos réponses automatiques",
    where: "Menu Automatisation",
    points: [
      "Créez une règle à partir d'un modèle (demande de prix, livraison, message d'accueil) ou depuis zéro, avec vos propres mots-clés et réponses.",
      "Choisissez si la réponse part automatiquement, ou si elle attend votre validation dans Gestion → À traiter.",
      "Pour des réponses plus naturelles, activez l'assistant IA sur un compte et ajoutez une base de connaissances (produits, prix, horaires) dans ses réglages.",
    ],
    tip: "Une clé IA gratuite (Groq, Google Gemini) peut être ajoutée par un administrateur dans la configuration du serveur.",
  },
  {
    icon: Settings2,
    title: "5. Personnalisez vos préférences",
    where: "Menu Paramètres",
    points: [
      "Complétez votre profil (nom, photo, téléphone).",
      "Choisissez la page qui s'ouvre après connexion, dans Préférences.",
      "Activez les notifications du navigateur pour être prévenu des nouveaux messages à traiter.",
    ],
  },
  {
    icon: Rocket,
    title: "6. Allez plus loin",
    points: [
      "Planifier : programmez vos publications, commentaires et messages à l'avance.",
      "Lives : démarrez une session pendant vos ventes en direct pour capturer les commandes automatiquement.",
      "Leads : retrouvez les clients potentiels détectés dans vos commentaires et messages.",
    ],
  },
];

export function GuidePage() {
  return (
    <LegalLayout
      title="Guide de démarrage"
      subtitle="Comment configurer votre compte pour accéder pleinement à la plateforme, étape par étape."
    >
      <div className="rounded-2xl p-5" style={{ background: theme.goldSoft }}>
        <p className="flex items-start gap-2 text-sm" style={{ color: theme.goldDark }}>
          <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
          Comptez environ cinq minutes pour connecter vos Pages et activer vos premières réponses automatiques.
        </p>
      </div>

      <ol className="flex flex-col gap-6">
        {steps.map((s) => (
          <li key={s.title} className="rounded-2xl p-5 sm:p-6" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: theme.goldSoft }}>
                <s.icon size={19} style={{ color: theme.goldDark }} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold" style={{ color: theme.text }}>{s.title}</h2>
                {s.where && (
                  <p className="mt-0.5 text-xs font-medium" style={{ color: theme.textMuted }}>{s.where}</p>
                )}
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-2 pl-[52px]">
              {s.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm" style={{ color: theme.text }}>
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" style={{ color: theme.gold }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {s.tip && (
              <p className="ml-[52px] mt-3 text-xs" style={{ color: theme.textMuted }}>💡 {s.tip}</p>
            )}
            {s.warn && (
              <p className="ml-[52px] mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ background: "#FDECEC", color: theme.red }}>
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {s.warn}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-2xl p-8 text-center" style={{ background: theme.bgDark }}>
        <p className="text-lg font-semibold text-white">Prêt à commencer ?</p>
        <p className="max-w-md text-sm" style={{ color: "#ffffffb0" }}>
          Créez votre compte gratuitement, aucune carte bancaire n'est demandée pour démarrer.
        </p>
        <Link to="/register">
          <Button variant="primary" icon={ArrowRight}>Créer mon compte</Button>
        </Link>
      </div>
    </LegalLayout>
  );
}
