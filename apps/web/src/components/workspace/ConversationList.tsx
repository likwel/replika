import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { PlatIcon } from "@/components/ui/PlatIcon";
import { timeAgo } from "@/lib/format";
import type { WsConversation } from "@/lib/workspace.api";

interface Props {
  conversations: WsConversation[];
  selectedId: string | null;
  onSelect: (c: WsConversation) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {conversations.map((c) => {
        const active = c.id === selectedId;
        const unread = c.unread > 0;
        return (
          <li key={`${c.accountId}:${c.id}`}>
            <button
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all hover:shadow-sm"
              style={{
                background: theme.bgCard,
                border: `1px solid ${active ? theme.gold : theme.border}`,
                boxShadow: active ? `0 0 0 1px ${theme.gold}` : undefined,
              }}
              aria-current={active}
            >
              <span className="relative flex-shrink-0">
                <Avatar name={c.participant.name.replace(/^@/, "")} size={42} />
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-[2px] leading-none">
                  <PlatIcon p={c.platform === "INSTAGRAM" ? "ig" : "fb"} size={13} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm" style={{ color: theme.text, fontWeight: unread ? 700 : 600 }}>
                    {c.participant.name}
                  </span>
                  <span className="ml-auto flex-shrink-0 text-[11px]" style={{ color: unread ? theme.goldDark : theme.textMuted }}>
                    {timeAgo(c.updatedAt)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="truncate text-[13px]" style={{ color: unread ? theme.text : theme.textMuted, fontWeight: unread ? 600 : 400 }}>
                    {c.lastFromPage && "Vous : "}
                    {c.snippet || "Pièce jointe"}
                  </span>
                  {unread && (
                    <span className="ml-auto h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: theme.gold }} title={`${c.unread} non lu(s)`} />
                  )}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: theme.textMuted }}>
                  via {c.accountName}
                  {c.pending > 0 && (
                    <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                      À traiter
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
