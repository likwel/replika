import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { theme } from "@/theme";
import { LegalLayout, Section } from "@/components/marketing/LegalLayout";
import { LEGAL } from "@/data/legal";

const link = { color: theme.goldDark };

// Valeur de l'éditeur, ou mention visible « à compléter » tant qu'elle n'est pas renseignée (data/legal.ts)
function V({ children }: { children: string }) {
  return children ? <strong style={{ color: theme.text }}>{children}</strong> : <em style={{ color: theme.amber }}>à compléter</em>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap gap-x-2">
      <span style={{ color: theme.textMuted }}>{label} :</span> {children}
    </li>
  );
}

// Mentions légales : éditeur, publication, hébergement, propriété intellectuelle, données, contact
export function LegalNoticePage() {
  const L = LEGAL;
  return (
    <LegalLayout title="Mentions légales" subtitle="Informations sur l'éditeur et l'hébergeur du service SuiteFlow." updatedAt={L.updatedAt}>
      <Section title="1. Éditeur du service">
        <p>Le site et l'application {L.brand} sont édités par :</p>
        <ul className="flex flex-col gap-1.5">
          <Row label="Raison sociale"><V>{L.company}</V></Row>
          <Row label="Forme juridique"><V>{L.legalForm}</V></Row>
          {L.capital && <Row label="Capital social"><V>{L.capital}</V></Row>}
          <Row label="Siège social"><V>{[L.address, L.city].filter(Boolean).join(", ")}</V></Row>
          <Row label="RCS"><V>{L.rcs}</V></Row>
          <Row label="NIF"><V>{L.nif}</V></Row>
          <Row label="STAT"><V>{L.stat}</V></Row>
          <Row label="E-mail"><a href={`mailto:${L.email}`} className="underline" style={link}>{L.email}</a></Row>
          {L.phone && <Row label="Téléphone"><V>{L.phone}</V></Row>}
        </ul>
      </Section>

      <Section title="2. Directeur de la publication">
        <p><V>{L.director}</V>, en qualité de représentant légal de l'éditeur.</p>
      </Section>

      <Section title="3. Hébergement">
        <ul className="flex flex-col gap-1.5">
          <Row label="Hébergeur"><V>{L.host.name}</V></Row>
          <Row label="Adresse"><V>{L.host.address}</V></Row>
          {L.host.website && <Row label="Site"><a href={L.host.website} target="_blank" rel="noreferrer" className="underline" style={link}>{L.host.website}</a></Row>}
        </ul>
        <p>
          Les paiements sont traités par Papi.mg ; la connexion aux Pages Facebook et comptes Instagram passe par l'API
          officielle de Meta. Ces prestataires hébergent les données qu'ils traitent selon leurs propres conditions.
        </p>
      </Section>

      <Section title="4. Propriété intellectuelle">
        <p>
          La marque {L.brand}, son logo, l'interface, les textes et le code du service sont protégés par le droit de la
          propriété intellectuelle. Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite de
          l'éditeur est interdite. Les noms et logos Facebook, Instagram, Meta, MVola, Orange Money et Airtel Money
          appartiennent à leurs propriétaires respectifs.
        </p>
        <p>Vous restez propriétaire des contenus de vos Pages et des informations que vous saisissez dans le service.</p>
      </Section>

      <Section title="5. Données personnelles et cookies">
        <p>
          Les traitements de données personnelles réalisés par {L.brand} sont décrits dans la{" "}
          <Link to="/confidentialite" className="underline" style={link}>Politique de confidentialité</Link>. Le service
          utilise uniquement des cookies nécessaires à son fonctionnement (session de connexion, sécurité) et la
          vérification anti-robot Cloudflare Turnstile sur les formulaires.
        </p>
      </Section>

      <Section title="6. Conditions d'utilisation">
        <p>
          L'utilisation du service est régie par les{" "}
          <Link to="/cgu" className="underline" style={link}>Conditions générales d'utilisation</Link>, soumises au droit
          malgache.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          Pour toute question, utilisez le <Link to="/contact" className="underline" style={link}>formulaire de contact</Link> ou
          écrivez à <a href={`mailto:${L.email}`} className="underline" style={link}>{L.email}</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
