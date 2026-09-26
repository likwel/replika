import { theme } from "@/theme";
import { INTENT_META, type Intent } from "@/lib/ai.api";

const TONES = {
  lead: { color: theme.goldDark, bg: theme.goldSoft },
  alert: { color: theme.red, bg: "#FDECEC" },
  neutral: { color: theme.text, bg: theme.border },
  muted: { color: theme.textMuted, bg: theme.bg },
} as const;

// Intention détectée par l'IA ; les prospects (prix, commande…) ressortent en doré
export function IntentChip({ intent }: { intent: Intent }) {
  const meta = INTENT_META[intent] ?? INTENT_META.autre;
  const tone = TONES[meta.tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: tone.bg, color: tone.color }}
      title="Intention détectée par l'IA"
    >
      {meta.label}
    </span>
  );
}
