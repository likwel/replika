import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";

type Variant = "success" | "error" | "warning" | "info";

const VARIANTS: Record<Variant, { bg: string; color: string; icon: LucideIcon }> = {
  success: { bg: theme.greenSoft, color: theme.green, icon: CheckCircle2 },
  error: { bg: theme.dangerBg, color: theme.red, icon: AlertCircle },
  warning: { bg: theme.amberSoft, color: theme.amber, icon: AlertTriangle },
  info: { bg: theme.goldSoft, color: theme.goldDark, icon: Info },
};

interface Props {
  variant: Variant;
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}

// Bannière de notification : remplace les blocs ad-hoc répétés page par page
export function Alert({ variant, icon, children, action, onClose, className = "" }: Props) {
  const v = VARIANTS[variant];
  const Icon = icon ?? v.icon;
  return (
    <div className={`flex flex-wrap items-start gap-2 rounded-xl px-4 py-3 text-sm ${className}`} style={{ background: v.bg, color: v.color }}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1 basis-56">{children}</div>
      {action}
      {onClose && (
        <button onClick={onClose} aria-label="Fermer" className="flex-shrink-0">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
