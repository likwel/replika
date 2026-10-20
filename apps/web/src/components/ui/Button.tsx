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
  sm: { cls: "h-7 px-2.5 text-[13px] gap-1.5", icon: 14 },
  md: { cls: "h-8 px-3 text-sm gap-1.5", icon: 15 },
  lg: { cls: "h-10 px-4 text-[15px] gap-2", icon: 16 },
};

const variants: Record<Variant, React.CSSProperties> = {
  primary: { background: theme.gold, color: theme.onAccent },
  danger: { background: theme.red, color: "#fff" },
  ghost: { background: theme.bgCard, color: theme.text, boxShadow: `inset 0 0 0 1px ${theme.border}` },
  dark: { background: theme.bgDark, color: "#fff" },
  soft: { background: theme.goldSoft, color: theme.goldDark },
};

export function Button({ children, variant = "primary", icon: Icon, size = "md", className = "", ...props }: Props) {
  const s = sizes[size];
  return (
    <button
      className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-md font-medium transition-[filter,background-color] hover:brightness-[0.96] active:brightness-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50 ${s.cls} ${className}`}
      style={variants[variant]}
      {...props}
    >
      {Icon && <Icon size={s.icon} />}
      {children}
    </button>
  );
}
