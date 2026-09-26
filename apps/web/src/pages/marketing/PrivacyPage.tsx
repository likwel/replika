import { Link } from "react-router-dom";
import { theme } from "@/theme";
import { LegalLayout, Section } from "@/components/marketing/LegalLayout";

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Politique de Confidentialité"
      subtitle="Quelles données ReplyKA traite, pourquoi, et comment les contrôler."
      updatedAt="26 septembre 2026"
    >
      <Section title="1. Données que nous collectons">
        <p><strong style={{ color: theme.text }}>Données de compte</strong> : nom, adresse e-mail, mot de passe (jamais stocké en clair, uniquement sous forme hachée), photo de profil si vous en ajoutez une.</p>
        <p>
          <strong style={{ color: theme.text }}>Données de vos Pages et comptes</strong> : lorsque vous connectez une Page Facebook ou un
          compte Instagram professionnel, nous recevons de Meta l'identifiant et le nom de la Page, son jeton
          d'accès, ainsi que les commentaires, messages privés et publications que vous choisissez de gérer via le
          Service. Les jetons d'accès de vos Pages ne sont jamais renvoyés à votre navigateur : ils restent sur
          notre serveur et servent uniquement à agir en votre nom auprès de Meta.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Données générées par l'usage</strong> : règles de réponse automatique, historique des
          réponses envoyées, leads détectés (nom, téléphone ou e-mail partagés par vos clients dans leurs messages),
          publications programmées, sessions Live et commandes associées.
        </p>
        <p><strong style={{ color: theme.text }}>Données techniques</strong> : adresse IP, type de navigateur et d'appareil, enregistrés lors de la connexion à votre compte, à des fins de sécurité.</p>
      </Section>

      <Section title="2. Pourquoi nous utilisons ces données">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>fournir le Service : lire et répondre aux commentaires et messages, publier du contenu, gérer vos sessions Live ;</li>
          <li>faire fonctionner les réponses automatiques et la détection de leads que vous activez ;</li>
          <li>vous permettre de retrouver l'historique de vos échanges et de vos publications ;</li>
          <li>assurer la sécurité de votre compte (détection d'accès suspects, historique de connexion) ;</li>
          <li>vous contacter au sujet de votre abonnement ou d'une évolution importante du Service.</li>
        </ul>
        <p>Nous n'utilisons pas vos données pour de la publicité, et ne les vendons à aucun tiers.</p>
      </Section>

      <Section title="3. Intelligence artificielle">
        <p>
          Si vous activez l'assistant IA pour un compte, le texte des commentaires ou messages reçus (et, le cas
          échéant, le contenu de votre base de connaissances) est transmis au fournisseur de modèle que vous avez
          configuré dans vos réglages (par exemple Groq, Google Gemini, ou un modèle exécuté sur votre propre
          serveur). Cette fonctionnalité est optionnelle : sans clé configurée, aucune donnée n'est envoyée à un
          fournisseur d'IA.
        </p>
      </Section>

      <Section title="4. Partage des données">
        <p>Nous partageons des données uniquement dans les cas suivants :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong style={{ color: theme.text }}>Meta (Facebook/Instagram)</strong> : pour lire et publier en votre nom sur les Pages que vous connectez, via leur API officielle ;</li>
          <li><strong style={{ color: theme.text }}>Fournisseur d'IA</strong> : uniquement si vous activez l'assistant IA, comme décrit ci-dessus ;</li>
          <li><strong style={{ color: theme.text }}>Hébergeur</strong> : nos données sont hébergées chez un prestataire technique chargé de l'infrastructure du Service, lié par une obligation de confidentialité ;</li>
          <li>si la loi nous y oblige, ou pour protéger nos droits et ceux de nos utilisateurs.</li>
        </ul>
      </Section>

      <Section title="5. Conservation des données">
        <p>
          Vos données sont conservées tant que votre compte est actif. Lorsque vous supprimez votre compte, vos
          données personnelles et l'accès à vos Pages sont supprimés ; certaines données peuvent être conservées
          plus longtemps si la loi l'exige (par exemple des journaux de sécurité), pour une durée strictement limitée.
        </p>
      </Section>

      <Section title="6. Sécurité">
        <p>
          Les mots de passe sont hachés, la session de connexion utilise un cookie protégé (httpOnly) inaccessible
          au code exécuté dans votre navigateur, et les jetons d'accès de vos Pages ne sont jamais exposés en
          dehors de notre serveur. Vous pouvez à tout moment changer votre mot de passe ou déconnecter tous les
          autres appareils depuis Paramètres → Sécurité.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          Le Service utilise un cookie de session strictement nécessaire à la connexion à votre compte. Nous
          n'utilisons pas de cookies publicitaires ou de traceurs tiers sur l'application.
        </p>
      </Section>

      <Section title="8. Vos droits">
        <p>Vous pouvez à tout moment, depuis Paramètres :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>consulter et modifier vos informations de profil ;</li>
          <li>déconnecter une Page ou un compte Instagram ;</li>
          <li>désactiver les réponses automatiques ;</li>
          <li>demander la suppression complète de votre compte et de vos données.</li>
        </ul>
        <p>
          Pour toute autre demande relative à vos données (accès, rectification, opposition), écrivez-nous à{" "}
          <a href="mailto:contact@replyka.mg" className="underline" style={{ color: theme.goldDark }}>contact@replyka.mg</a>.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          Cette politique peut évoluer pour refléter des changements du Service ou de la réglementation. Toute
          modification importante vous sera signalée dans l'application ou par e-mail.
        </p>
        <p>
          Pour comprendre les règles d'usage du Service, consultez également nos{" "}
          <Link to="/cgu" className="underline" style={{ color: theme.goldDark }}>Conditions Générales d'Utilisation</Link>.
        </p>
      </Section>
    </LegalLayout>
  );
}
