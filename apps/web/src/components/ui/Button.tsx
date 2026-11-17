import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

type Variant = "primary" | "danger" | "ghost" | "dark" | "soft";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
}

const sizes: Record<Size, { cls: string; icon: number }> = {
  sm: { cls: "h-8 rounded-[10px] px-3 text-[12.5px] gap-1.5", icon: 14 },
  md: { cls: "h-9 rounded-md px-3.5 text-[13px] gap-1.5", icon: 15 },
  lg: { cls: "h-11 rounded-[14px] px-5 text-[14.5px] gap-2 font-bold tracking-[-0.005em]", icon: 17 },
};

// Principal et secondaire : classes du design system (index.css) ; les autres variantes ajoutent leur
// fond, avec le même relief (reflet en haut, halo coloré) et le même mouvement (lever au survol, appui au clic).
const LIFT = "transition-[transform,box-shadow,filter] duration-150 ease-brand hover:enabled:-translate-y-px active:enabled:translate-y-px";

const variants: Record<Variant, { cls: string; style?: React.CSSProperties }> = {
  primary: { cls: "btn-brand" },
  ghost: { cls: "btn-soft" },
  danger: {
    cls: LIFT,
    style: {
      background: "linear-gradient(135deg, #fb4a6a 0%, #e11d48 55%, #be123c 100%)",
      color: "#fff",
      textShadow: "0 1px 1px rgba(100,0,20,0.3)",
      boxShadow: "0 14px 26px -14px rgba(225,29,72,0.55), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(100,0,20,0.18)",
    },
  },
  dark: {
    cls: LIFT,
    style: {
      background: "linear-gradient(180deg, #2c2f39 0%, #0e1014 100%)",
      color: "#fff",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.45), 0 1px 2px rgba(16,24,40,0.3), 0 8px 14px -8px rgba(16,24,40,0.6)",
    },
  },
  soft: {
    cls: LIFT,
    style: { background: theme.goldSoft, color: theme.goldDark, boxShadow: "inset 0 0 0 1px rgb(var(--color-gold-rgb) / 0.18)" },
  },
};

export function Button({ children, variant = "primary", icon: Icon, size = "md", className = "", style, ...props }: Props) {
  const s = sizes[size];
  const v = variants[variant];
  return (
    <button
      className={`inline-flex flex-shrink-0 items-center justify-center whitespace-nowrap font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50 ${v.cls} ${s.cls} ${className}`}
      style={{ ...v.style, ...style }}
      {...props}
    >
      {Icon && <Icon size={s.icon} />}
      {children}
    </button>
  );
}
