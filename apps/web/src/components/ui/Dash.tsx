import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

// Briques de tableau de bord au style pr.social : panneau en relief avec tuile d'icône en dégradé,
// carte héros sombre, barres de progression en dégradé, valeurs qui comptent jusqu'à leur chiffre.

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Dégradé d'une tuile d'icône : la couleur du module, éclaircie en haut. Sans couleur : dégradé de marque.
export function tileStyle(tint?: string): CSSProperties {
  return (tint
    ? { "--a": `color-mix(in srgb, ${tint} 78%, #fff)`, "--b": tint }
    : { "--a": "var(--brand-1)", "--b": "var(--brand-3)" }) as CSSProperties;
}

export function IconTile({ icon: Icon, tint, size = "sm" }: { icon: LucideIcon; tint?: string; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 25 : size === "md" ? 20 : 17;
  return (
    <span className={`ico-tile ${size === "md" ? "" : size}`} style={{ ...tileStyle(tint), color: tint ? "#fff" : theme.onAccent }}>
      <Icon size={px} strokeWidth={2.1} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panneau : carte en relief, en-tête (tuile d'icône, titre, sous-titre, action) puis contenu
// ---------------------------------------------------------------------------

interface PanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  tint?: string;
  action?: ReactNode;
  link?: { label: string; onClick: () => void }; // lien d'en-tête orange (« Comment ça marche > »)
  footer?: ReactNode; // pied de carte pleine largeur (bande en creux, bande premium…)
  flush?: boolean; // contenu sans marge : lignes de liste pleine largeur
  children: ReactNode;
  className?: string;
}

// En-tête : tuile d'icône 40 px, titre, sous-titre, action ou lien à droite (comme les cartes de pr.social)
export function Panel({ title, subtitle, icon, tint, action, link, footer, flush, children, className = "" }: PanelProps) {
  return (
    <section className={`card-s ${className}`}>
      <div className="hd-line flex flex-wrap items-center gap-3 px-4 pb-3.5 pt-4 sm:px-5 sm:pt-[18px]">
        {icon && <IconTile icon={icon} tint={tint} size="md" />}
        <div className="min-w-0 flex-1 basis-32">
          <h3 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>{subtitle}</p>}
        </div>
        {link && (
          <button className="lnk ml-auto" onClick={link.onClick}>
            {link.label}
            <ChevronRight />
          </button>
        )}
        {action}
      </div>
      <div className={`flex-1 ${flush ? "" : "px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5"}`}>{children}</div>
      {footer}
    </section>
  );
}

// Titre d'une carte à marge intérieure : titre en haut, petite description dessous, action à droite, filet sous le bloc.
// `compact` pour les cartes à marge de 16 px (p-4), sinon 20 px (p-5).
export function CardTitle({ title, subtitle, icon, tint, action, danger, compact, className = "" }: {
  title: ReactNode; subtitle?: ReactNode; icon?: LucideIcon; tint?: string; action?: ReactNode; danger?: boolean; compact?: boolean; className?: string;
}) {
  return (
    <div className={`card-hd ${compact ? "card-hd-16" : ""} flex flex-wrap items-center gap-3 ${className}`}>
      {icon && <IconTile icon={icon} tint={tint} size="md" />}
      <div className="min-w-0 flex-1 basis-40">
        <h3 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: danger ? theme.red : theme.text }}>{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Titre de section : une carte à part entière (tuile d'icône, titre, sous-titre, lien), posée au-dessus de la rangée
// de cartes qu'elle introduit. Aucun titre ne reste à nu sur le fond.
export function SectionTitle({ title, subtitle, icon, tint, link, action }: { title: ReactNode; subtitle?: ReactNode; icon?: LucideIcon; tint?: string; link?: { label: string; onClick: () => void }; action?: ReactNode }) {
  return (
    <header className="card-s !flex-row flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      {icon && <IconTile icon={icon} tint={tint} size="md" />}
      <div className="min-w-0 flex-1 basis-40">
        <h3 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>{subtitle}</p>}
      </div>
      {link && (
        <button className="lnk ml-auto" onClick={link.onClick}>
          {link.label}
          <ChevronRight />
        </button>
      )}
      {action}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Carte héros : le chiffre principal de la page, sur fond sombre
// ---------------------------------------------------------------------------

interface HeroProps {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  tone?: "bad";
  children?: ReactNode;
  className?: string;
}

export function Hero({ icon: Icon, label, value, caption, tone, children, className = "" }: HeroProps) {
  return (
    <section className={`hero flex flex-col justify-between gap-6 p-5 sm:p-6 ${className}`}>
      <div>
        <span className="hero-chip">
          <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: "var(--brand)", color: theme.onAccent }}>
            <Icon size={12} strokeWidth={2.4} />
          </span>
          {label}
        </span>
        <p className="hero-fig mt-4 text-[40px] sm:text-[48px]" style={tone === "bad" ? { color: "#fda4af" } : undefined}>{value}</p>
        {caption && <p className="hero-sub mt-2.5 text-[13px] leading-snug">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Barre de progression : libellé, valeur, piste en creux et remplissage en dégradé qui se déroule
// ---------------------------------------------------------------------------

interface ProgressProps {
  label: ReactNode;
  icon?: LucideIcon;
  pct: number; // 0–100
  color?: string;
  value?: ReactNode;
  detail?: ReactNode;
  dark?: boolean; // posée sur une carte héros
}

export function ProgressRow({ label, icon: Icon, pct, color = "var(--color-gold)", value, detail, dark }: ProgressProps) {
  const [shown, setShown] = useState(reducedMotion());
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const w = Math.max(pct > 0 ? 2 : 0, Math.min(100, pct));
  return (
    <div title={typeof label === "string" ? `${label} : ${Math.round(pct)} %` : undefined}>
      <div className="mb-1.5 flex items-center gap-2 text-[13px]">
        {Icon && <Icon size={14} style={{ color: dark ? "rgba(255,255,255,0.7)" : color }} className="flex-shrink-0" />}
        <span className="min-w-0 flex-1 truncate font-medium" style={{ color: dark ? "#fff" : theme.text }}>{label}</span>
        {value !== undefined && <span className="tabular font-bold" style={{ color: dark ? "#fff" : theme.text }}>{value}</span>}
        {detail && <span className="tabular text-[12px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : theme.textMuted }}>{detail}</span>}
      </div>
      <div className="track" style={dark ? { background: "rgba(255,255,255,0.1)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" } : undefined}>
        <div
          className="fill"
          style={{
            width: shown ? `${w}%` : "0%",
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 62%, #fff), ${color})`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px -2px color-mix(in srgb, ${color} 55%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Valeur qui compte jusqu'à son chiffre (entiers, avec ou sans séparateurs fr-FR)
// ---------------------------------------------------------------------------

const PLAIN_INT = /^[\d   ]+$/;

export function CountUp({ value, ms = 700 }: { value: string; ms?: number }) {
  const target = PLAIN_INT.test(value) ? Number(value.replace(/[^\d]/g, "")) : null;
  const [n, setN] = useState<number | null>(target === null || reducedMotion() ? target : 0);
  const from = useRef(0);

  useEffect(() => {
    if (target === null) return setN(null);
    if (reducedMotion() || target === from.current) return setN(target);
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(base + (target - base) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return <>{n === null ? value : n.toLocaleString("fr-FR")}</>;
}

// ---------------------------------------------------------------------------
// Squelette de carte (chargement) : lignes qui scintillent
// ---------------------------------------------------------------------------

export function SkeletonCards({ count, height = 118, className = "grid grid-cols-2 gap-3 sm:grid-cols-4" }: { count: number; height?: number; className?: string }) {
  return (
    <div className={className} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-s gap-3 p-4" style={{ minHeight: height }}>
          <div className="flex items-center gap-2.5">
            <span className="sk h-[34px] w-[34px] !rounded-[10px]" />
            <span className="sk h-3 w-1/2" />
          </div>
          <span className="sk mt-1 h-7 w-2/5" />
          <span className="sk h-2.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}
