import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "danger" | "ghost" | "dark" | "soft";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
}

// Gabarit unique (index.css, `.btn`) : 40 px de haut ; `btn-sm` = 32 px, 12 px de marge interne, 6 px entre icône et libellé.
// Les tailles « sm », « md » et « lg » donnent toutes le même bouton : on ne garde
// que deux hauteurs. Tous les boutons sont en 32 px (`btn-sm`) ; seul le bouton de l'en-tête garde les 40 px.
const SIZE: Record<Size, string> = { sm: "btn-sm", md: "btn-sm", lg: "btn-sm" };

const VARIANT: Record<Variant, string> = {
  primary: "btn-brand",
  ghost: "btn-soft",
  danger: "btn-danger",
  dark: "btn-dark",
  soft: "btn-tint",
};

export function Button({ children, variant = "primary", icon: Icon, size = "md", className = "", ...props }: Props) {
  return (
    <button className={`btn ${VARIANT[variant]} ${SIZE[size]} ${className}`.replace(/\s+/g, " ").trim()} {...props}>
      {Icon && <Icon />}
      {children}
    </button>
  );
}
