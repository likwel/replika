import { Link } from "react-router-dom";
import { theme } from "@/theme";
import { LegalLayout, Section } from "@/components/marketing/LegalLayout";

const link = { color: theme.goldDark };

export function TermsPage() {
  return (
    <LegalLayout
      title="Conditions Générales d'Utilisation"
      subtitle="Les règles d'utilisation de ReplyKA, à lire avant de créer votre compte et de connecter vos Pages."
      updatedAt="20 octobre 2026"
    >
      <Section title="1. Objet">
        <p>
          ReplyKA (« le Service ») est une plateforme qui permet de gérer, automatiser et planifier les publications,
          commentaires et messages privés de Pages Facebook et de comptes Instagram professionnels, de suivre les
          clients potentiels (leads), les ventes réalisées pendant les lives et les annonces Marketplace. Les présentes
          Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation du Service par tout
          utilisateur créant un compte (« vous », « l'Utilisateur »).
        </p>
        <p>
          En créant un compte, que ce soit avec votre adresse e-mail ou via Facebook ou Google, ou en utilisant le
          Service, vous acceptez sans réserve les présentes CGU ainsi que notre{" "}
          <Link to="/confidentialite" className="underline" style={link}>Politique de confidentialité</Link>.
        </p>
      </Section>

      <Section title="2. Création de compte et connexion">
        <p>Vous pouvez créer votre compte et vous connecter :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>avec votre nom, une adresse e-mail valide et un mot de passe d'au moins 8 caractères ;</li>
          <li>
            ou via votre compte <strong>Facebook</strong> ou <strong>Google</strong>. Dans ce cas, ce fournisseur nous
            transmet uniquement votre nom, votre adresse e-mail et un identifiant de compte, jamais votre mot de passe.
            Si un compte ReplyKA existe déjà avec la même adresse e-mail, confirmée par le fournisseur, la connexion y
            est rattachée.
          </li>
        </ul>
        <p>
          Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée depuis votre
          compte. Prévenez-nous sans délai de toute utilisation non autorisée ; vous pouvez à tout moment déconnecter
          tous vos appareils depuis Paramètres → Sécurité.
        </p>
        <p>Vous devez avoir au moins 18 ans, ou l'autorisation d'un représentant légal, pour utiliser le Service.</p>
      </Section>

      <Section title="3. Connexion de vos Pages Facebook et comptes Instagram">
        <p>
          Le Service se connecte à vos Pages via l'authentification officielle de Meta. Cette connexion est distincte
          de la connexion à votre compte ReplyKA : vous seul décidez quelles Pages et quels comptes Instagram
          professionnels sont connectés, et pouvez retirer cet accès à tout moment depuis Facebook ou depuis
          Connexions dans ReplyKA.
        </p>
        <p>
          Vous restez propriétaire de vos Pages et de leur contenu. ReplyKA agit en votre nom, dans les limites des
          autorisations que vous accordez (lecture des commentaires et messages, réponse, publication, modération,
          gestion du catalogue), et selon les règles et réglages que vous configurez.
        </p>
        <p>
          Vous devez respecter les conditions d'utilisation et standards de la communauté de Meta (Facebook,
          Instagram, Marketplace et Commerce Manager). ReplyKA ne peut être tenu responsable d'une action de Meta
          contre votre Page ou votre compte (limitation, suspension, refus d'un article) résultant d'un usage non
          conforme de votre part.
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
          si vous avez activé l'envoi automatique. ReplyKA propose des outils de validation manuelle et de suivi ; il
          vous appartient de les utiliser si vous préférez garder un contrôle avant envoi.
        </p>
      </Section>

      <Section title="5. Ventes : lives, Marketplace et leads">
        <p>
          Le Service vous aide à enregistrer des commandes (commentaires « JP » pendant un live, demandes reçues sur
          Marketplace), à publier vos articles dans votre Catalogue Facebook et à repérer vos clients potentiels.
          ReplyKA n'est ni vendeur, ni intermédiaire de paiement, ni transporteur : la vente, son prix, la livraison et
          le service après-vente relèvent de votre seule relation avec vos clients.
        </p>
        <p>
          Les informations de vos articles (prix, stock, photos, description) sont celles que vous saisissez ou
          importez : vous êtes responsable de leur exactitude et de leur conformité aux règles de Meta.
        </p>
      </Section>

      <Section title="6. Données de vos clients">
        <p>
          Le Service traite pour votre compte des données de vos clients : nom, messages, téléphone, e-mail ou adresse
          de livraison qu'ils vous communiquent. Vous êtes responsable de ces données vis-à-vis de vos clients et vous
          engagez à ne les utiliser que pour répondre à leurs demandes et exécuter leurs commandes, conformément à la
          réglementation applicable en matière de protection des données personnelles.
        </p>
      </Section>

      <Section title="7. Abonnement et tarifs">
        <p>
          Le Service est proposé selon différentes formules (Starter, Pro, Agence), décrites sur la page d'accueil, avec
          une période d'essai gratuite de 14 jours à la création du compte. Les tarifs sont indiqués en ariary (Ar) et
          peuvent être modifiés avec un préavis raisonnable ; les modifications ne s'appliquent pas rétroactivement à
          une période déjà payée.
        </p>
        <p>
          Un abonnement se renouvelle par période, sauf résiliation de votre part avant son échéance, effectuée depuis
          les paramètres de votre compte ou en nous contactant.
        </p>
      </Section>

      <Section title="8. Usage acceptable">
        <p>Vous vous engagez à ne pas utiliser le Service pour :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>envoyer des messages non sollicités constitutifs de spam ;</li>
          <li>diffuser un contenu illicite, trompeur, diffamatoire ou portant atteinte aux droits d'un tiers ;</li>
          <li>vendre des produits interdits par la loi ou par les règles de commerce de Meta ;</li>
          <li>contourner les limites techniques du Service ou celles imposées par Meta ;</li>
          <li>accéder à des comptes Facebook ou Instagram dont vous n'êtes pas légitimement gestionnaire.</li>
        </ul>
        <p>Tout manquement peut entraîner la suspension ou la résiliation de votre compte, sans préavis en cas d'abus manifeste.</p>
      </Section>

      <Section title="9. Services tiers">
        <p>
          Certaines fonctionnalités reposent sur des services tiers : Meta (Facebook, Instagram, Marketplace), Google
          (connexion au compte) et, si vous l'activez, un fournisseur d'intelligence artificielle. Leur utilisation est
          également soumise à leurs propres conditions. Une évolution ou une indisponibilité de ces services peut
          limiter certaines fonctionnalités, sans que la responsabilité de ReplyKA puisse être engagée.
        </p>
      </Section>

      <Section title="10. Disponibilité du Service et responsabilité">
        <p>
          Nous mettons en œuvre des moyens raisonnables pour assurer la disponibilité du Service, sans garantir une
          disponibilité continue et sans interruption. Dans la limite permise par la loi, ReplyKA ne saurait être tenu
          responsable des pertes indirectes (manque à gagner, vente non conclue) liées à l'utilisation du Service.
        </p>
      </Section>

      <Section title="11. Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis Paramètres → Sécurité. La suppression retire vos
          données du Service et révoque l'accès à vos Pages, selon les modalités décrites dans notre{" "}
          <Link to="/confidentialite" className="underline" style={link}>Politique de confidentialité</Link>. Si vous
          vous connectiez via Facebook ou Google, vous pouvez aussi retirer l'accès de ReplyKA depuis les réglages de ce
          compte.
        </p>
        <p>
          Nous pouvons suspendre ou résilier un compte en cas de violation des présentes CGU, ou de non-paiement d'un
          abonnement, après notification lorsque cela est raisonnablement possible.
        </p>
      </Section>

      <Section title="12. Modification des CGU">
        <p>
          Nous pouvons modifier les présentes CGU pour refléter une évolution du Service ou de la réglementation. Toute
          modification substantielle vous sera notifiée ; la poursuite de l'utilisation du Service après notification
          vaut acceptation des CGU modifiées.
        </p>
      </Section>

      <Section title="13. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit malgache. Tout litige relatif à leur interprétation ou leur
          exécution relève, à défaut de résolution amiable, des juridictions compétentes de Madagascar.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          Pour toute question relative aux présentes CGU, écrivez-nous à{" "}
          <a href="mailto:contact@replyka.mg" className="underline" style={link}>contact@replyka.mg</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
