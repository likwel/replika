import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";

interface Props {
  title: string;
  subtitle?: string;
  updatedAt?: string; // "26 septembre 2026"
  children: ReactNode;
}

// Habillage commun des pages CGU, confidentialité et guide : en-tête simple, contenu en colonne, pied de page léger
export function LegalLayout({ title, subtitle, updatedAt, children }: Props) {
  return (
    <div style={{ background: theme.bg }}>
      <header className="sticky top-0 z-50 backdrop-blur" style={{ background: "rgba(242,239,233,0.85)", borderBottom: `1px solid ${theme.border}` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70" style={{ color: theme.text }}>
            <ArrowLeft size={15} /> Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: theme.text }}>{title}</h1>
        {subtitle && <p className="mt-3 text-base" style={{ color: theme.textMuted }}>{subtitle}</p>}
        {updatedAt && <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Dernière mise à jour : {updatedAt}</p>}
        <div className="prose-legal mt-10 flex flex-col gap-8">{children}</div>
      </main>

      <footer className="px-5 py-8 text-center text-xs" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textMuted }}>
        © 2026 ReplyKA. Tous droits réservés. ·{" "}
        <Link to="/cgu" className="underline hover:opacity-70">CGU</Link> ·{" "}
        <Link to="/confidentialite" className="underline hover:opacity-70">Confidentialité</Link> ·{" "}
        <Link to="/guide" className="underline hover:opacity-70">Guide</Link>
      </footer>
    </div>
  );
}

// Un bloc de section : titre + paragraphes/listes fournis par la page
export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold" style={{ color: theme.text }}>{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed" style={{ color: theme.text }}>{children}</div>
    </section>
  );
}
