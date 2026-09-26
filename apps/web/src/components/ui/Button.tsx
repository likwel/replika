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

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const variants: Record<Variant, React.CSSProperties> = {
  primary: { background: theme.gold, color: "#1A1410" },
  danger: { background: theme.red, color: "#fff" },
  ghost: { background: "transparent", color: theme.text, border: `1px solid ${theme.border}` },
  dark: { background: theme.bgDark, color: "#fff" },
  soft: { background: theme.goldSoft, color: theme.goldDark },
};

export function Button({ children, variant = "primary", icon: Icon, size = "md", className = "", ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl font-medium transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${sizes[size]} ${className}`}
      style={variants[variant]}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}