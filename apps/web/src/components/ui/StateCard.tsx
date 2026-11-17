import type { CSSProperties, ReactNode } from "react";
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

const TILE = { "--a": "var(--brand-1)", "--b": "var(--brand-3)" } as CSSProperties;

// Carte centrée icône + titre + texte : écrans "aucune donnée" et "bientôt disponible"
export function StateCard({ icon: Icon, title, children, badge, action, className = "" }: Props) {
  return (
    <div className={`card-s items-center p-10 text-center ${className}`}>
      <span className="ico-tile lg mb-4" style={{ ...TILE, color: theme.onAccent }}>
        <Icon size={25} strokeWidth={2.1} />
      </span>
      <Title className="text-[19px] !font-extrabold !tracking-[-0.02em]">{title}</Title>
      {children && <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: theme.textMuted }}>{children}</p>}
      {badge && <span className="chip off mt-4">{badge}</span>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
