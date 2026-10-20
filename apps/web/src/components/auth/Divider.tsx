import { theme } from "@/theme";

export function Divider({ label = "ou" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: theme.border }} />
      <span className="text-xs" style={{ color: theme.textMuted }}>{label}</span>
      <div className="h-px flex-1" style={{ background: theme.border }} />
    </div>
  );
}
