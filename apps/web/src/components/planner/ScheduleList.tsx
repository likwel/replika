import { AlertTriangle, ImageIcon } from "lucide-react";
import { theme } from "@/theme";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import type { Schedule } from "@/lib/schedule.api";
import { KIND_META, STATUS_META, formatSlot } from "./planner";

interface Props {
  items: Schedule[];
  onOpen: (s: Schedule) => void;
  dateOf?: (s: Schedule) => string | null; // historique : date d'envoi
  compact?: boolean; // colonne étroite : sans avatars ni badge de statut
}

// Liste compacte : type, texte, destinations, date et statut
export function ScheduleList({ items, onOpen, dateOf = (s) => s.scheduledAt, compact }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => {
        const kind = KIND_META[s.kind];
        const status = STATUS_META[s.status];
        const accounts = [...new Map(s.targets.map((t) => [t.accountId, t.account])).values()];
        const failed = s.targets.filter((t) => t.status === "FAILED").length;
        return (
          <li key={s.id}>
            <button
              onClick={() => onOpen(s)}
              className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all hover:shadow-sm"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: `${kind.color}14` }}>
                {s.imageUrl ? <img src={s.imageUrl} alt="" className="h-full w-full object-cover" /> : <kind.icon size={18} style={{ color: kind.color }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px]" style={{ color: theme.textMuted }}>
                  <span className="font-semibold" style={{ color: kind.color }}>{kind.short}</span>
                  {s.imageUrl && <ImageIcon size={11} />}
                  <span className="truncate">· {formatSlot(dateOf(s))}</span>
                </span>
                <span className="block truncate text-sm font-medium" style={{ color: theme.text }}>{s.text}</span>
                {s.kind !== "POST" && s.targets[0]?.label && (
                  <span className="block truncate text-[11px]" style={{ color: theme.textMuted }}>
                    {s.kind === "MESSAGE" ? "À " : "Sur « "}
                    {s.targets.map((t) => t.label).join(", ")}
                    {s.kind === "COMMENT" ? " »" : ""}
                  </span>
                )}
                {failed > 0 && (
                  <span className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: theme.red }}>
                    <AlertTriangle size={11} /> {failed} destination{failed > 1 ? "s" : ""} en échec
                  </span>
                )}
              </span>
              <span className={compact ? "hidden" : "hidden -space-x-1.5 sm:flex"}>
                {accounts.slice(0, 4).map((a) => (
                  <AccountAvatar key={a.id} name={a.name} src={a.avatarUrl} platform={a.platform} size={24} />
                ))}
              </span>
              {compact ? (
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: status.color }} title={status.label} />
              ) : (
                <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>
                  {status.label}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
