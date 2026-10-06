import { theme } from "@/theme";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { mark: number; text: number; em: number; gap: number }> = {
  sm: { mark: 26, text: 16, em: 19, gap: 7 },
  md: { mark: 31, text: 19, em: 23, gap: 8 },
  lg: { mark: 40, text: 25, em: 30, gap: 10 },
};

// Bulle de réponse avec un éclair évidé : l'éclair laisse voir le dégradé doré du fond.
const BUBBLE_AND_BOLT =
  "M5 2.5h14A3.5 3.5 0 0 1 22.5 6v8a3.5 3.5 0 0 1-3.5 3.5h-6.1l-4.9 4.05a.8.8 0 0 1-1.31-.62V17.5H5A3.5 3.5 0 0 1 1.5 14V6A3.5 3.5 0 0 1 5 2.5Z" +
  "M13.78 5.3a.6.6 0 0 0-1.05-.17L7.9 11.1a.6.6 0 0 0 .46.98h2.35l-.92 3.3a.6.6 0 0 0 1.05.54l4.83-5.97a.6.6 0 0 0-.46-.98h-2.35l.92-3.3Z";

interface MarkProps {
  size?: number;
  className?: string;
}

// Symbole seul : rail latéral, favicon, pastilles
export function LogoMark({ size = 31, className = "" }: MarkProps) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: `linear-gradient(140deg, ${theme.goldLight} 0%, ${theme.gold} 45%, ${theme.goldDark} 100%)`,
        boxShadow: `0 ${Math.max(1, size * 0.05)}px ${size * 0.22}px rgba(201,145,74,0.38)`,
      }}
      aria-hidden
    >
      <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24">
        <path d={BUBBLE_AND_BOLT} fill="#1A1410" fillRule="evenodd" />
      </svg>
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
    <span className="inline-flex items-center" style={{ gap: s.gap }} aria-label="ReplyKA" role="img">
      {mark && <LogoMark size={s.mark} />}
      <span
        className="leading-none"
        style={{ color: dark ? "#fff" : theme.text, fontWeight: 800, fontSize: s.text, letterSpacing: "-0.6px" }}
      >
        Reply
        <em
          style={{
            color: theme.gold,
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: s.em,
            letterSpacing: "-0.4px",
          }}
        >
          KA
        </em>
      </span>
    </span>
  );
}
