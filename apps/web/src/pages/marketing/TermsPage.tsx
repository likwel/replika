import { Link } from "react-router-dom";
import { theme } from "@/theme";
import { LegalLayout, Section } from "@/components/marketing/LegalLayout";

export function TermsPage() {
  return (
    <LegalLayout
      title="Conditions Générales d'Utilisation"
      subtitle="Les règles d'utilisation de ReplyKA, à lire avant de connecter vos Pages."
      updatedAt="26 septembre 2026"
    >
      <Section title="1. Objet">
        <p>
          ReplyKA (« le Service ») est une plateforme qui permet de gérer, automatiser et planifier les publications,
          commentaires et messages privés de Pages Facebook et de comptes Instagram professionnels. Les présentes
          Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation du Service par tout
          utilisateur créant un compte (« vous », « l'Utilisateur »).
        </p>
        <p>En créant un compte ou en utilisant le Service, vous acceptez sans réserve les présentes CGU.</p>
      </Section>

      <Section title="2. Création de compte">
        <p>
          L'accès au Service nécessite la création d'un compte avec un nom, une adresse e-mail valide et un mot de
          passe. Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée
          depuis votre compte.
        </p>
        <p>Vous devez avoir au moins 18 ans, ou l'autorisation d'un représentant légal, pour utiliser le Service.</p>
      </Section>

      <Section title="3. Connexion de vos Pages Facebook et comptes Instagram">
        <p>
          Le Service se connecte à vos Pages via l'authentification officielle de Meta (Facebook Login). Vous seul
          décidez quelles Pages et quels comptes Instagram professionnels sont connectés, et pouvez retirer cet
          accès à tout moment depuis Facebook ou depuis Connexions dans ReplyKA.
        </p>
        <p>
          Vous restez propriétaire de vos Pages et de leur contenu. ReplyKA agit en votre nom, dans les limites des
          autorisations que vous accordez (lecture des commentaires et messages, réponse, publication, modération),
          et selon les règles et réglages que vous configurez.
        </p>
        <p>
          Vous devez respecter les propres conditions d'utilisation et standards de la communauté de Meta
          (Facebook et Instagram). ReplyKA ne peut être tenu responsable d'une action de Meta contre votre Page ou
          votre compte (limitation, suspension) résultant d'un usage non conforme de votre part.
        </p>
      </Section>

      <Section title="4. Réponses automatiques et intelligence artificielle">
        <p>
          Le Service peut répondre automatiquement à des commentaires et messages, selon des règles que vous
          définissez ou, si vous l'activez, à l'aide d'un modèle d'intelligence artificielle. Ces réponses sont
          générées automatiquement et peuvent, dans de rares cas, être inexactes ou inadaptées.
        </p>
        <p>
          Vous restez seul responsable des réponses envoyées en votre nom, y compris celles générées automatiquement
          si vous avez activé l'envoi automatique. ReplyKA propose des outils de validation manuelle et de
          suivi ; il vous appartient de les utiliser si vous préférez garder un contrôle avant envoi.
        </p>
      </Section>

      <Section title="5. Abonnement et tarifs">
        <p>
          Le Service est proposé selon différentes formules (Starter, Pro, Agence), décrites sur la page d'accueil.
          Les tarifs sont indiqués en ariary (Ar) et peuvent être modifiés avec un préavis raisonnable ; les
          modifications ne s'appliquent pas rétroactivement à une période déjà payée.
        </p>
        <p>
          Un abonnement se renouvelle par période, sauf résiliation de votre part avant son échéance, effectuée
          depuis les paramètres de votre compte ou en nous contactant.
        </p>
      </Section>

      <Section title="6. Usage acceptable">
        <p>Vous vous engagez à ne pas utiliser le Service pour :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>envoyer des messages non sollicités constitutifs de spam ;</li>
          <li>diffuser un contenu illicite, trompeur, diffamatoire ou portant atteinte aux droits d'un tiers ;</li>
          <li>contourner les limites techniques du Service ou celles imposées par Meta ;</li>
          <li>accéder à des comptes Facebook ou Instagram dont vous n'êtes pas légitimement gestionnaire.</li>
        </ul>
        <p>Tout manquement peut entraîner la suspension ou la résiliation de votre compte, sans préavis en cas d'abus manifeste.</p>
      </Section>

      <Section title="7. Disponibilité du Service">
        <p>
          Nous mettons en œuvre des moyens raisonnables pour assurer la disponibilité du Service, sans garantir une
          disponibilité continue et sans interruption. Certaines fonctionnalités dépendent de la disponibilité et
          des évolutions de l'API de Meta, hors de notre contrôle.
        </p>
      </Section>

      <Section title="8. Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis Paramètres → Sécurité. La suppression retire vos
          données du Service et révoque l'accès à vos Pages, selon les modalités décrites dans notre{" "}
          <Link to="/confidentialite" className="underline" style={{ color: theme.goldDark }}>Politique de confidentialité</Link>.
        </p>
        <p>
          Nous pouvons suspendre ou résilier un compte en cas de violation des présentes CGU, ou de non-paiement
          d'un abonnement, après notification lorsque cela est raisonnablement possible.
        </p>
      </Section>

      <Section title="9. Modification des CGU">
        <p>
          Nous pouvons modifier les présentes CGU pour refléter une évolution du Service ou de la réglementation.
          Toute modification substantielle vous sera notifiée ; la poursuite de l'utilisation du Service après
          notification vaut acceptation des CGU modifiées.
        </p>
      </Section>

      <Section title="10. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit malgache. Tout litige relatif à leur interprétation ou leur
          exécution relève, à défaut de résolution amiable, des juridictions compétentes de Madagascar.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Pour toute question relative aux présentes CGU, écrivez-nous à{" "}
          <a href="mailto:contact@replyka.mg" className="underline" style={{ color: theme.goldDark }}>contact@replyka.mg</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
