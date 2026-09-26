import { theme } from "@/theme";

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: theme.border }} />
      <span className="text-xs" style={{ color: theme.textMuted }}>ou</span>
      <div className="h-px flex-1" style={{ background: theme.border }} />
    </div>
  );
}