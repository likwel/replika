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
    <div className="rounded-xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="flex items-center gap-2">
        <Icon size={15} className="flex-shrink-0" style={{ color }} />
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: theme.textMuted }}>{label}</span>
        {trend && (
          <span className="flex flex-shrink-0 items-center gap-0.5 text-[11.5px] font-medium" style={{ color: down ? theme.red : theme.green }}>
            <TrendIcon size={12} /> {trend}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]" style={{ color: theme.text }}>{value}</p>
    </div>
  );
}
