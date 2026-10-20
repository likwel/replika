import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Check, Store, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";

// Panneau de marque : couleurs du logo (--brand-*), dans leurs teintes vives pour le fond sombre
const BRAND_ON_DARK = "linear-gradient(90deg, var(--brand-1), var(--brand-2))";
const BRAND_LIGHT = "var(--brand-1)";

interface Props {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

const BENEFITS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Bot, title: "Réponses IA 24h/24", text: "Commentaires et messages Facebook & Instagram traités, même la nuit." },
  { icon: Target, title: "Leads détectés automatiquement", text: "Chaque intention d'achat est repérée et rangée dans votre pipeline." },
  { icon: Store, title: "Lives et Marketplace", text: "Commandes « JP » capturées en direct, catalogue synchronisé avec Facebook." },
];

export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="flex min-h-screen" style={{ background: theme.canvas }}>
      {/* Panneau de marque (grand écran) */}
      <aside className="relative hidden w-[44%] max-w-[580px] flex-col justify-between overflow-hidden p-12 lg:flex" style={{ background: theme.bgDark }}>
        <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: "var(--brand-2)" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: "var(--brand-1)" }} />

        <Link to="/" className="relative w-fit"><Logo dark /></Link>

        <div className="relative">
          <h2 className="font-bold text-white" style={{ fontSize: "clamp(1.9rem, 2.6vw, 2.5rem)", lineHeight: 1.12, letterSpacing: "-0.025em" }}>
            Répondez plus vite,
            <br />
            <span style={{ backgroundImage: BRAND_ON_DARK, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>vendez plus.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed" style={{ color: "#ffffffcc" }}>
            SuiteFlow automatise vos commentaires et messages Facebook & Instagram avec l'intelligence artificielle.
          </p>
          <ul className="mt-10 flex flex-col gap-5">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <b.icon size={18} style={{ color: BRAND_LIGHT }} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-white">{b.title}</span>
                  <span className="block text-sm" style={{ color: "#ffffffb3" }}>{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-sm" style={{ color: "#ffffffb3" }}>
          <Check size={15} style={{ color: BRAND_LIGHT }} /> Connexion officielle Meta · aucun mot de passe Facebook demandé
        </p>
      </aside>

      {/* Formulaire */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="lg:hidden"><Logo /></Link>
          <Link to="/" className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-black/5" style={{ color: theme.textMuted }}>
            <ArrowLeft size={15} /> Accueil
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: theme.text }}>{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm" style={{ color: theme.textMuted }}>{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>

        <p className="px-5 pb-6 text-center text-xs" style={{ color: theme.textMuted }}>
          © 2026 SuiteFlow ·{" "}
          <Link to="/cgu" className="underline-offset-2 hover:underline">Conditions d'utilisation</Link> ·{" "}
          <Link to="/confidentialite" className="underline-offset-2 hover:underline">Confidentialité</Link>
        </p>
      </main>
    </div>
  );
}
