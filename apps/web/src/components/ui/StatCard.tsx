import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { theme } from "@/theme";
import { CountUp, IconTile } from "./Dash";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string; // "+12%", "-8%", "Nouveau"… le signe du préfixe pilote la couleur et la flèche
  color: string; // couleur du module : teinte de la tuile d'icône
  detail?: ReactNode; // ligne d'explication sous le chiffre
  tone?: "warn" | "bad"; // colore le chiffre quand il signale un problème
}

// Carte de chiffre : tuile d'icône en dégradé, libellé, chiffre en gras qui compte jusqu'à sa valeur
export function StatCard({ icon, label, value, trend, color, detail, tone }: Props) {
  const down = trend?.trimStart().startsWith("-");
  const TrendIcon = down ? TrendingDown : TrendingUp;
  return (
    <div className="card-s lift justify-between gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} tint={color} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
        <p
          className="tabular text-[26px] font-extrabold leading-none tracking-[-0.03em]"
          style={{ color: tone === "bad" ? theme.red : tone === "warn" ? theme.amber : theme.text }}
        >
          <CountUp value={value} />
        </p>
        {trend && (
          <span className={`chip ${down ? "bad" : "ok"} !text-[11px]`}>
            <TrendIcon size={12} /> {trend}
          </span>
        )}
      </div>
      {detail && <p className="-mt-1.5 text-[12px] leading-snug" style={{ color: theme.textMuted }}>{detail}</p>}
    </div>
  );
}
