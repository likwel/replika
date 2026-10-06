import { theme } from "@/theme";

interface Props {
  color?: string;
  size?: number;
  pulse?: boolean; // halo animé : état vivant (en ligne, en direct)
  ring?: string; // liseré pour détacher la pastille d'un avatar ou d'un fond sombre
}

// Pastille d'état : verte par défaut (« en ligne / actif »)
export function StatusDot({ color = theme.green, size = 8, pulse = false, ring }: Props) {
  return (
    <span className="relative inline-flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {pulse && <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: color }} />}
      <span
        className="relative h-full w-full rounded-full"
        style={{ background: color, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
      />
    </span>
  );
}
