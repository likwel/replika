import { useId } from "react";
import { theme } from "@/theme";

// Marque SuiteFlow : une bulle de conversation (commentaires et messages des réseaux sociaux) tracée
// comme une boucle fléchée (automatisation en continu, 24h/24), avec une étincelle (assistant IA).
// Couleurs de l'application (index.css, --brand-*) : vert WhatsApp par défaut, doré avec l'accent « classique ».
export const BRAND_GRADIENT = "linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 55%, var(--brand-3) 100%)";
// Mot « Flow » : suit le mode clair / sombre (--brand-text-*, index.css) ; `dark` force les teintes vives
// pour une surface sombre affichée en mode clair (panneau de la page de connexion)
const TEXT_COLORS = ["var(--brand-text-from)", "var(--brand-text-to)"] as const;
const TEXT_COLORS_ON_DARK = ["var(--brand-1)", "var(--brand-2)"] as const;

// Tracés dans un carré de 24 (cercle de centre 12;11.5 et de rayon 8)
export const GLYPH = {
  // Bulle ouverte en haut à droite, terminée par une flèche : la boucle de l'automatisation
  loop: "M19.52 8.76A8 8 0 0 1 8.62 18.75L3.6 21l1.85-4.91A8 8 0 0 1 13.39 3.62",
  arrow: "M12.64 1.53l1.93 2.3-2.6 1.5",
  // Version simplifiée pour les petites tailles (favicon, barre latérale) : bulle fermée
  bubble: "M7.9 20A9 9 0 1 0 4 16.1L2 22z",
  spark: "M12 7.2c.5 2.5 1.8 3.8 4.3 4.3-2.5.5-3.8 1.8-4.3 4.3-.5-2.5-1.8-3.8-4.3-4.3 2.5-.5 3.8-1.8 4.3-4.3z",
} as const;

// En dessous de cette taille, la boucle et sa flèche deviennent illisibles : on passe à la bulle simple
const COMPACT_BELOW = 24;

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { mark: number; text: number; gap: number }> = {
  sm: { mark: 26, text: 16, gap: 8 },
  md: { mark: 31, text: 19, gap: 9 },
  lg: { mark: 40, text: 25, gap: 11 },
};

interface MarkProps {
  size?: number;
  className?: string;
}

// Symbole seul : barre latérale, favicon, pastilles
export function LogoMark({ size = 31, className = "" }: MarkProps) {
  const compact = size < COMPACT_BELOW;
  const glyph = Math.round(size * 0.75);
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: BRAND_GRADIENT,
        boxShadow: `0 ${Math.max(1, size * 0.05)}px ${size * 0.22}px color-mix(in srgb, var(--brand-3) 35%, transparent)`,
      }}
      aria-hidden
    >
      {/* Blanc sur le vert ; foncé sur le doré, comme le texte des boutons (lisibilité) */}
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-onAccent)"
        strokeWidth={compact ? 2.4 : 2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={compact ? GLYPH.bubble : GLYPH.loop} />
        {!compact && <path d={GLYPH.arrow} />}
        <path d={GLYPH.spark} fill="var(--color-onAccent)" stroke="none" />
      </svg>
    </span>
  );
}

// Vague sous « Flow » : le flux de l'automatisation, en écho à la boucle du symbole
const WAVE = "M1 4C6 1 10 1 14 3.5S22 6 27 3.5 34 1 39 3";

interface WordmarkProps {
  size?: number; // taille du texte en px
  dark?: boolean; // posé sur un fond sombre
}

// Mot-logo : police Sora (chargée pour lui seul), « Suite » léger et « Flow » gras souligné d'une vague
export function Wordmark({ size = 19, dark = false }: WordmarkProps) {
  const gradientId = `wave${useId().replace(/:/g, "")}`;
  const [from, to] = dark ? TEXT_COLORS_ON_DARK : TEXT_COLORS;
  return (
    <span
      className="inline-flex items-baseline whitespace-nowrap leading-none"
      style={{ fontFamily: "Sora, Inter, sans-serif", fontSize: size, letterSpacing: "-0.035em", color: dark ? "#fff" : theme.text }}
    >
      <span style={{ fontWeight: 500 }}>Suite</span>
      <span className="relative" style={{ fontWeight: 800 }}>
        {/* Marge intérieure : avec l'espacement resserré, le « w » déborde de sa boîte et le dégradé
            (limité à la boîte) le couperait ; la marge négative garde l'espacement inchangé */}
        <span
          style={{
            backgroundImage: `linear-gradient(90deg, ${from}, ${to})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            paddingRight: "0.08em",
            marginRight: "-0.08em",
          }}
        >
          Flow
        </span>
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 w-full overflow-visible"
          style={{ bottom: "-0.34em", height: "0.3em" }}
          viewBox="0 0 40 6"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId}>
              <stop offset="0" style={{ stopColor: from }} />
              <stop offset="1" style={{ stopColor: to }} />
            </linearGradient>
          </defs>
          <path
            d={WAVE}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={Math.max(1.6, size * 0.11)}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    </span>
  );
}

interface Props {
  dark?: boolean;
  size?: Size;
  mark?: boolean; // false : mot-logo seul
}

export function Logo({ dark = false, size = "md", mark = true }: Props) {
  const s = SIZES[size];
  return (
    <span className="inline-flex items-center" style={{ gap: s.gap }} aria-label="SuiteFlow" role="img">
      {mark && <LogoMark size={s.mark} />}
      <Wordmark size={s.text} dark={dark} />
    </span>
  );
}
