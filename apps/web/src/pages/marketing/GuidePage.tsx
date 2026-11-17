import { Link } from "react-router-dom";
import {
  UserPlus, Plug, ShieldCheck, Bot, Bell, Palette, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Lightbulb,
  FileSpreadsheet, Radio, Keyboard, LifeBuoy, Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { MENUS } from "@/data/menus";
import { LegalLayout, Section } from "@/components/marketing/LegalLayout";

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
      "Cliquez sur « Essai gratuit » : 14 jours de la formule Pro, sans carte bancaire.",
      "Renseignez votre nom, votre adresse e-mail et un mot de passe d'au moins 8 caractères, ou continuez avec Facebook ou Google.",
      "Dès l'inscription, activez la validation en deux étapes (Profil et sécurité) : un code par e-mail ou par application protège votre accès.",
    ],
  },
  {
    icon: Plug,
    title: "2. Associez vos Pages et comptes Instagram",
    where: "Bouton « Associer un compte » en haut à droite · menu Comptes associés",
    points: [
      "Cliquez sur « Associer un compte », choisissez Facebook et connectez-vous avec le profil qui gère vos Pages.",
      "Dans la fenêtre de Facebook, cliquez sur « Modifier les paramètres », cochez toutes les Pages et comptes Instagram professionnels à gérer, ainsi que toutes les autorisations demandées.",
      "La fenêtre d'association liste vos comptes avec leur état : une coche verte = tout est prêt ; sinon un bouton propose de reconnecter.",
    ],
    tip: "Un compte Instagram doit être professionnel et lié à une Page Facebook pour apparaître dans la liste.",
    warn: "Une Page non cochée à cette étape ne peut pas être gérée par SuiteFlow. En cas de doute, cochez toutes les Pages proposées.",
  },
  {
    icon: ShieldCheck,
    title: "3. Vérifiez l'état de chaque compte",
    where: "Règles de réponse › État des comptes",
    points: [
      "Chaque compte indique si l'accès Facebook est valide, si les autorisations sont accordées et si les commentaires et messages reçoivent une réponse.",
      "Un compte signalé « Bloqué » ou « À compléter » a un bouton pour agir : reconnecter, activer l'assistant IA, activer l'envoi automatique ou créer une règle.",
    ],
  },
  {
    icon: Bot,
    title: "4. Réglez vos réponses automatiques",
    where: "Menu Règles de réponse",
    points: [
      "Onglet « Mes règles » : partez d'un modèle (prix, livraison, accueil) ou créez une règle « Quand… Alors… » avec vos mots-clés. La première règle de la liste qui correspond répond.",
      "Le bloc « Comment SuiteFlow choisit sa réponse » résume l'ordre : une règle, sinon l'assistant IA, sinon la réponse par défaut. Chaque étape indique son statut.",
      "Onglet « Assistant IA » : choisissez le compte, activez l'assistant, décrivez votre activité (produits, prix, horaires) et son style de réponse. Testez-le sur un message d'exemple avant de l'activer.",
      "Chaque réponse peut partir toute seule ou attendre votre validation dans « À traiter ».",
    ],
    tip: "Pipelines : pour enchaîner plusieurs actions (message privé, statut de lead, alerte), créez un pipeline dans le menu Pipelines ; il s'appuie sur vos règles.",
  },
  {
    icon: Bell,
    title: "5. Traitez ce qui attend une réponse",
    where: "Cloche de l'en-tête · menu À traiter",
    points: [
      "La bulle de la cloche compte les nouveaux messages à traiter. Cliquez pour voir les derniers, ouvrez-en un pour répondre dans son contexte.",
      "Dans « À traiter », validez, modifiez ou ignorez la réponse proposée. Un message répondu quitte la liste.",
    ],
  },
  {
    icon: Palette,
    title: "6. Personnalisez l'application",
    where: "Profil et sécurité · Préférences",
    points: [
      "Thème : Automatique (suit votre appareil, clair ou sombre), Clair ou Sombre. Le bouton en bas de la barre latérale les fait défiler.",
      "Couleur d'accent, police du texte et page d'ouverture après connexion.",
      "Notifications du navigateur : activez-les pour être prévenu quand un message arrive pendant que l'onglet est en arrière-plan.",
    ],
  },
];

// Une carte par page : icône et couleur viennent du menu lui-même (data/menus.ts)
const modules: Array<{ id: string; text: string }> = [
  { id: "dash", text: "Votre point de départ : comptes associés, messages à traiter, chiffres des 7 derniers jours et protection du compte." },
  { id: "hub", text: "Publications, commentaires et messages privés de toutes vos Pages au même endroit. Répondez dans la conversation ou sous la publication." },
  { id: "queue", text: "Ce qui attend votre décision : suggestions à valider et cas escaladés. Les nouveaux messages sont marqués et comptés dans la cloche." },
  { id: "conn", text: "Associez, mettez en pause, dissociez vos Pages et comptes Instagram, et contrôlez leur état." },
  { id: "live", text: "Capture les « jp » de vos lives en commandes, écrit au client, collecte ses coordonnées, suit le stock et prépare les factures." },
  { id: "market", text: "Annonces Marketplace synchronisées depuis votre catalogue Facebook, commandes par acheteur (formule Pro et plus)." },
  { id: "leads", text: "Les clients potentiels détectés dans vos commentaires et messages, classés chaud, tiède ou froid, avec leur pipeline (formule Pro et plus)." },
  { id: "plan", text: "Programmez publications, commentaires et messages. Calendrier, file d'attente, brouillons, envois, et import depuis un tableur." },
  { id: "rules", text: "Mots-clés → réponse, assistant IA et état des comptes : ce que SuiteFlow répond à votre place." },
  { id: "auto", text: "Un déclencheur, des conditions sur vos règles, des actions enchaînées. Chaque exécution est tracée." },
  { id: "stat", text: "Engagement, performance par compte et par règle, rapports (statistiques avancées : formule Pro et plus)." },
  { id: "hist", text: "Le journal de chaque action automatisée ou manuelle, avec son auteur dans une équipe." },
];

function Callout({ icon: Icon, tone = "gold", children }: { icon: LucideIcon; tone?: "gold" | "green" | "red"; children: React.ReactNode }) {
  const t = tone === "red" ? { bg: theme.dangerBg, fg: theme.red } : tone === "green" ? { bg: theme.greenSoft, fg: theme.green } : { bg: theme.goldSoft, fg: theme.goldDark };
  return (
    <p className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px]" style={{ background: t.bg, color: t.fg }}>
      <Icon size={15} className="mt-0.5 flex-shrink-0" /> <span>{children}</span>
    </p>
  );
}

const Check = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2 text-sm" style={{ color: theme.text }}>
    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" style={{ color: theme.gold }} />
    <span>{children}</span>
  </li>
);

export function GuidePage() {
  return (
    <LegalLayout
      title="Guide d'utilisation"
      subtitle="Configurer votre compte en cinq minutes, puis tirer parti de chaque page : réponses automatiques, À traiter, lives, publications planifiées, pipelines."
    >
      <Section title="Démarrer en 6 étapes">
        <Callout icon={Sparkles}>Comptez environ cinq minutes pour associer vos Pages et activer vos premières réponses automatiques.</Callout>
        <ol className="flex flex-col gap-4">
          {steps.map((s) => (
            <li key={s.title} className="rounded-2xl p-4 sm:p-5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: theme.goldSoft }}>
                  <s.icon size={19} style={{ color: theme.goldDark }} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold" style={{ color: theme.text }}>{s.title}</h3>
                  {s.where && <p className="mt-0.5 text-xs font-medium" style={{ color: theme.textMuted }}>{s.where}</p>}
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-2 sm:pl-[52px]">
                {s.points.map((p) => <Check key={p}>{p}</Check>)}
              </ul>
              {s.tip && <p className="mt-3 flex items-start gap-1.5 text-xs sm:ml-[52px]" style={{ color: theme.textMuted }}><Lightbulb size={13} className="mt-0.5 flex-shrink-0" /> {s.tip}</p>}
              {s.warn && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs sm:ml-[52px]" style={{ background: theme.dangerBg, color: theme.red }}>
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {s.warn}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Chaque page, à quoi elle sert">
        <p style={{ color: theme.textMuted }}>Le menu de gauche regroupe les pages par usage. Le bouton « ? Aide » de l'en-tête explique la page ouverte.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((m) => {
            const menu = MENUS.find((x) => x.id === m.id);
            if (!menu) return null;
            return (
              <li key={m.id} className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${menu.color}1F` }}>
                  <menu.icon size={17} style={{ color: menu.color }} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{menu.label}</span>
                  <span className="block text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{m.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="La cloche et le système de vue">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: theme.goldSoft }}><Bell size={19} style={{ color: theme.goldDark }} /></span>
          <p style={{ color: theme.text }}>
            La cloche, en haut de l'écran, a une bulle rouge : elle compte les <b>nouveaux</b> messages à traiter, ceux que vous n'avez pas encore vus.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          <Check><b>Nouveau</b> : un commentaire ou message arrive dans « À traiter » et n'a jamais été ouvert. Il fait monter la bulle et reçoit une pastille « Nouveau ».</Check>
          <Check><b>Vu</b> : il le devient quand vous l'ouvrez depuis la cloche, quand « À traiter » l'affiche pendant un instant, ou avec « Tout marquer comme vu ». La bulle baisse en conséquence.</Check>
          <Check><b>Traité</b> : un message vu reste dans « À traiter » tant que vous n'avez pas répondu, validé ou ignoré. Le badge du menu compte tout ce qui attend, nouveau ou non.</Check>
          <Check>Cliquer sur un message de la cloche ouvre directement la publication ou la conversation d'origine.</Check>
        </ul>
        <Callout icon={Eye}>En équipe, l'état « vu » est partagé : un message ouvert par un membre n'est plus nouveau pour les autres.</Callout>
      </Section>

      <Section title="Ventes en live : ne perdre aucun JP">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "#EF444424" }}><Radio size={19} style={{ color: "#EF4444" }} /></span>
          <p style={{ color: theme.text }}>Démarrez une session pendant ou juste avant votre live : chaque « jp A3 » devient une commande, le client reçoit un message privé et ses coordonnées sont rangées dans le tableau.</p>
        </div>
        <ul className="flex flex-col gap-2">
          <Check><b>Listes d'articles</b> : préparez code, nom, prix et stock dans Google Sheets, Excel ou CSV (Ventes en live › Listes d'articles). Associez vos colonnes une fois ; au démarrage d'un live, joignez une ou plusieurs listes en un clic. Chaque liste porte un nom, reste enregistrée et se renomme, se corrige ou se supprime à tout moment.</Check>
          <Check><b>Réponses aux autres commentaires</b> (prix, livraison…) : dans les réglages de la session, gardez toutes vos règles, joignez seulement celles de ce live (avec ou sans assistant IA), ou ne répondez pas.</Check>
          <Check><b>Coupure du serveur</b> : si le serveur s'arrête, accident ou maintenance, les JP publiés pendant l'arrêt sont relus au redémarrage, et chaque JP repris va jusqu'au bout (commande, message privé). Le temps d'arrêt n'est pas décompté de vos heures de live.</Check>
          <Check>À la fin du live, un récapitulatif est envoyé aux clients qui ont plusieurs JP confirmés (onglet Factures).</Check>
        </ul>
      </Section>

      <Section title="Importer depuis un tableur">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "#10B98124" }}><FileSpreadsheet size={19} style={{ color: "#10B981" }} /></span>
          <p style={{ color: theme.text }}>Deux pages lisent un tableur Google Sheets : les publications à programmer et les listes d'articles de vos lives.</p>
        </div>
        <ul className="flex flex-col gap-2">
          <Check><b>Partager le tableur</b> : dans Google Sheets, cliquez sur Partager puis « Toute personne disposant du lien » (lecteur), et collez le lien. Un fichier Excel ou CSV fonctionne aussi.</Check>
          <Check><b>Publications planifiées › Importer</b> : colonnes Date, Heure, Texte, Compte, Lien du média… Les images sont téléchargées depuis leur lien (Drive, Dropbox ou lien direct). Gardez le tableur : l'onglet Imports le relit et programme les nouvelles lignes tout seul.</Check>
          <Check><b>Listes d'articles</b> : vous choisissez quelle colonne correspond au code, à l'article, au prix et au stock. Les lignes en erreur sont signalées avec leur numéro de ligne.</Check>
        </ul>
      </Section>

      <Section title="Astuces et raccourcis">
        <ul className="grid gap-3 sm:grid-cols-2">
          {([
            [Keyboard, "Recherche rapide", "Ctrl K (⌘ K sur Mac) ouvre la recherche : pages, sous-pages et actions."],
            [Palette, "Thème", "Automatique par défaut. Le bouton de la barre latérale, ou Préférences, change de thème."],
            [Plug, "Barre latérale réduite", "Le bouton « Réduire » garde les icônes ; les compteurs restent visibles sur chaque icône."],
            [Bell, "Notifications du navigateur", "Activez-les dans Préférences pour être prévenu hors de l'onglet."],
          ] as const).map(([Icon, title, text]) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <Icon size={17} className="mt-0.5 flex-shrink-0" style={{ color: theme.goldDark }} />
              <span><span className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{title}</span><span className="block text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{text}</span></span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Besoin d'aide ?">
        <div className="flex items-start gap-3">
          <LifeBuoy size={20} className="mt-0.5 flex-shrink-0" style={{ color: theme.goldDark }} />
          <p style={{ color: theme.text }}>
            Une question, un blocage ? Écrivez-nous depuis la <Link to="/contact" className="font-semibold underline" style={{ color: theme.goldDark }}>page Contact</Link>. Les conditions d'utilisation et la politique de confidentialité sont dans le pied de page.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl p-8 text-center" style={{ background: theme.bgDark }}>
          <p className="text-lg font-semibold text-white">Prêt à commencer ?</p>
          <p className="max-w-md text-sm" style={{ color: "#ffffffb0" }}>Créez votre compte gratuitement : aucune carte bancaire n'est demandée pour démarrer.</p>
          <Link to="/register"><Button variant="primary" icon={ArrowRight}>Créer mon compte</Button></Link>
        </div>
      </Section>
    </LegalLayout>
  );
}
