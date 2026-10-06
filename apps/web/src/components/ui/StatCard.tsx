import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { theme } from "@/theme";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string; // "+12%", "-8%", "Nouveau"… le signe du préfixe pilote la couleur et la flèche
  color: string;
}

export function StatCard({ icon: Icon, label, value, trend, color }: Props) {
  const down = trend?.trimStart().startsWith("-");
  const TrendIcon = down ? TrendingDown : TrendingUp;
  return (
    <div className="rounded-2xl p-4 transition-all hover:shadow-md" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="flex items-start justify-between">
        <div className="rounded-xl p-2" style={{ background: `${color}1A`, border: `1px solid ${color}2E` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: down ? theme.red : theme.green }}>
            <TrendIcon size={12} /> {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-xl font-bold" style={{ color: theme.text }}>{value}</p>
      <p className="text-[12.5px]" style={{ color: theme.textMuted }}>{label}</p>
    </div>
  );
}