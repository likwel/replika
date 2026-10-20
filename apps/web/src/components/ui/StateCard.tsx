import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";

interface Props {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  badge?: string;
  action?: ReactNode;
  className?: string;
}

// Carte centrée icône + titre + texte : écrans "aucune donnée" et "bientôt disponible"
export function StateCard({ icon: Icon, title, children, badge, action, className = "" }: Props) {
  return (
    <div className={`rounded-2xl p-10 text-center ${className}`} style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
        <Icon size={26} style={{ color: theme.gold }} />
      </div>
      <Title className="text-xl">{title}</Title>
      {children && <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: theme.textMuted }}>{children}</p>}
      {badge && (
        <span className="mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: theme.border, color: theme.textMuted }}>
          {badge}
        </span>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
