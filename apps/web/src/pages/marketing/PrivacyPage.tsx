import { Link } from "react-router-dom";
import { theme } from "@/theme";
import { LegalLayout, Section } from "@/components/marketing/LegalLayout";

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Politique de Confidentialité"
      subtitle="Quelles données SuiteFlow traite, pourquoi, et comment les contrôler."
      updatedAt="17 novembre 2026"
    >
      <Section title="1. Données que nous collectons">
        <p><strong style={{ color: theme.text }}>Données de compte</strong> : nom, adresse e-mail, mot de passe (jamais stocké en clair, uniquement sous forme hachée), photo de profil si vous en ajoutez une.</p>
        <p>
          <strong style={{ color: theme.text }}>Connexion avec Facebook ou Google</strong> : si vous choisissez cette option, nous recevons de
          Facebook ou de Google votre nom, votre adresse e-mail et un identifiant de compte. Nous ne recevons jamais votre mot de
          passe Facebook ou Google, et n'accédons à aucune autre donnée de ces comptes (contacts, publications, e-mails…).
        </p>
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
          publications programmées, sessions Live et commandes associées, annonces et commandes Marketplace (nom,
          téléphone et adresse de livraison communiqués par vos acheteurs).
        </p>
        <p>
          <strong style={{ color: theme.text }}>Données d'abonnement</strong> : formule choisie, dates de validité, consommation
          mensuelle (réponses IA, heures de live) et historique de vos paiements (montant, date, moyen de paiement, numéro de
          téléphone payeur transmis par notre prestataire). Vos identifiants de paiement (code Mobile Money, numéro de carte) sont
          saisis chez notre prestataire de paiement et ne nous sont jamais communiqués.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Équipe et espaces de travail</strong> : si vous invitez des collaborateurs,
          nous conservons leur adresse e-mail, leur nom, leur rôle et leurs droits par module, l'état de l'invitation
          (le lien d'invitation n'est stocké que sous forme d'empreinte) et, pour chaque action effectuée dans l'espace,
          le nom de son auteur dans le journal d'activité. Si vous êtes invité dans l'espace d'un autre utilisateur,
          celui-ci voit votre nom, votre adresse e-mail et votre activité dans son espace.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Validation en deux étapes</strong> : la méthode choisie (e-mail ou application
          d'authentification) et ce qui est nécessaire à la vérification : le secret de l'application est chiffré, et les
          codes envoyés par e-mail ne sont conservés que sous forme d'empreinte, pour quelques minutes.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Pipelines et journal d'activité</strong> : la définition de vos pipelines
          (déclencheur, conditions, actions), l'historique de leurs exécutions (ce qui s'est déclenché, ce qui a été
          envoyé ou modifié) et le journal des actions effectuées dans votre espace, par vous, vos membres ou un automatisme.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Tableurs importés</strong> : si vous importez des publications depuis un tableur
          (Google Sheets, CSV), nous conservons l'adresse du tableur que vous gardez pour l'import automatique et l'empreinte
          des lignes déjà traitées ; le contenu du tableur n'est lu que pour créer vos publications programmées. Les images
          dont vous donnez le lien sont téléchargées et conservées sur nos serveurs pour être publiées, puis supprimées
          avec la publication qui les utilise.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Listes d'articles des lives</strong> : si vous importez une liste d'articles (Google
          Sheets, Excel, CSV), nous conservons le tableur lu (lignes et colonnes), l'adresse du tableur le cas échéant, la
          correspondance de colonnes que vous avez choisie et les articles obtenus (code, nom, prix, stock), pour les joindre à
          vos sessions live. Vous pouvez les supprimer à tout moment depuis Ventes en live › Listes d'articles.
        </p>
        <p>
          <strong style={{ color: theme.text }}>Messages du formulaire de contact</strong> : le nom, l'adresse e-mail et le
          message que vous nous envoyez, utilisés uniquement pour vous répondre.
        </p>
        <p><strong style={{ color: theme.text }}>Données techniques</strong> : adresse IP, type de navigateur et d'appareil, enregistrés lors de la connexion à votre compte, à des fins de sécurité.</p>
      </Section>

      <Section title="2. Pourquoi nous utilisons ces données">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>fournir le Service : lire et répondre aux commentaires et messages, publier du contenu, gérer vos sessions Live ;</li>
          <li>faire fonctionner les réponses automatiques et la détection de leads que vous activez ;</li>
          <li>vous permettre de retrouver l'historique de vos échanges et de vos publications ;</li>
          <li>exécuter les pipelines et règles que vous configurez, et en conserver l'historique pour que vous puissiez le vérifier ;</li>
          <li>permettre le travail en équipe : droits par module, invitations, journal indiquant qui a fait quoi ;</li>
          <li>assurer la sécurité de votre compte (validation en deux étapes, détection d'accès suspects, historique de connexion) ;</li>
          <li>vous contacter au sujet de votre abonnement ou d'une évolution importante du Service.</li>
        </ul>
        <p>Nous n'utilisons pas vos données pour de la publicité, et ne les vendons à aucun tiers.</p>
      </Section>

      <Section title="3. Intelligence artificielle">
        <p>
          Si vous activez l'assistant IA pour un compte, le texte des commentaires ou messages reçus (et, le cas
          échéant, le contenu de votre base de connaissances) est transmis au fournisseur de modèle que vous avez
          configuré dans vos réglages (par exemple Groq, Google Gemini, ou un modèle exécuté sur votre propre
          serveur). Le fournisseur utilisé est indiqué dans Règles → Assistant IA ; d'autres fournisseurs pourront être
          proposés, auquel cas cette politique sera mise à jour avant leur activation. Cette fonctionnalité est
          optionnelle : sans clé configurée, aucune donnée n'est envoyée à un fournisseur d'IA.
        </p>
        <p>
          N'y figurent que les informations nécessaires à la réponse : le message reçu et les informations d'activité que
          vous avez saisies. Vos jetons d'accès, mots de passe et données de paiement ne sont jamais transmis à un
          fournisseur d'IA. Nous n'utilisons pas vos échanges pour entraîner nos propres modèles.
        </p>
      </Section>

      <Section title="4. Partage des données">
        <p>Nous partageons des données uniquement dans les cas suivants :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong style={{ color: theme.text }}>Meta (Facebook/Instagram)</strong> : pour lire et publier en votre nom sur les Pages que vous connectez, via leur API officielle ;</li>
          <li><strong style={{ color: theme.text }}>Google</strong> : uniquement pour vous authentifier, si vous choisissez « Continuer avec Google » ;</li>
          <li><strong style={{ color: theme.text }}>Fournisseur d'IA</strong> : uniquement si vous activez l'assistant IA, comme décrit ci-dessus ;</li>
          <li><strong style={{ color: theme.text }}>Prestataire de paiement</strong> : pour le paiement de votre abonnement, nous transmettons le montant, la formule, votre nom (ou celui de votre entreprise) et votre adresse e-mail ;</li>
          <li><strong style={{ color: theme.text }}>Hébergeur</strong> : nos données sont hébergées chez un prestataire technique chargé de l'infrastructure du Service, lié par une obligation de confidentialité ;</li>
          <li>si la loi nous y oblige, ou pour protéger nos droits et ceux de nos utilisateurs.</li>
        </ul>
      </Section>

      <Section title="5. Conservation des données">
        <p>
          Vos données sont conservées tant que votre compte est actif. Lorsque vous supprimez votre compte, vos
          données personnelles et l'accès à vos Pages sont supprimés ; certaines données peuvent être conservées
          plus longtemps si la loi l'exige (par exemple des journaux de sécurité ou des justificatifs de paiement), pour une durée strictement limitée.
        </p>
        <p>
          La suppression de votre compte retire également l'accès des membres de votre équipe à votre espace. Si vous
          quittez l'espace d'un autre utilisateur, ou si celui-ci vous retire, vos propres données de compte ne sont pas
          supprimées ; les actions déjà inscrites dans le journal de cet espace y restent, car elles font partie de son historique.
        </p>
      </Section>

      <Section title="6. Sécurité">
        <p>
          Les mots de passe sont hachés, la session de connexion utilise un cookie protégé (httpOnly) inaccessible
          au code exécuté dans votre navigateur, et les jetons d'accès de vos Pages ne sont jamais exposés en
          dehors de notre serveur. Les droits par module limitent ce que chaque membre de votre équipe peut voir et faire,
          et la validation en deux étapes protège l'accès à votre compte. Vous pouvez à tout moment changer votre mot de passe ou déconnecter tous les
          autres appareils depuis Paramètres → Sécurité.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          Le Service utilise un cookie de session strictement nécessaire à la connexion à votre compte et, le temps
          d'une connexion via Facebook ou Google, un cookie temporaire (10 minutes) qui protège cette étape contre les
          détournements. Nous n'utilisons pas de cookies publicitaires ou de traceurs tiers sur l'application.
        </p>
      </Section>

      <Section title="8. Vos droits">
        <p>Vous pouvez à tout moment, depuis Paramètres :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>consulter et modifier vos informations de profil ;</li>
          <li>déconnecter une Page ou un compte Instagram ;</li>
          <li>désactiver les réponses automatiques et mettre en pause vos pipelines ;</li>
          <li>gérer votre équipe : inviter, modifier les droits, suspendre ou retirer un membre ;</li>
          <li>activer ou désactiver la validation en deux étapes ;</li>
          <li>demander la suppression complète de votre compte et de vos données.</li>
        </ul>
        <p>
          Pour toute autre demande relative à vos données (accès, rectification, opposition), utilisez le{" "}
          <Link to="/contact" className="underline" style={{ color: theme.goldDark }}>formulaire de contact</Link> ou écrivez-nous à{" "}
          <a href="mailto:contact@suiteflow.mg" className="underline" style={{ color: theme.goldDark }}>contact@suiteflow.mg</a>.
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
