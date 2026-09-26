import { Heart, MessageCircle, Share2, Play, FileText } from "lucide-react";
import { theme } from "@/theme";
import { timeAgo } from "@/lib/format";
import type { WsPost } from "@/lib/workspace.api";
import { AccountAvatar } from "./AccountAvatar";
import { KIND_LABEL } from "./labels";

interface Props {
  posts: WsPost[];
  selectedId: string | null;
  onSelect: (post: WsPost) => void;
}

export function PostList({ posts, selectedId, onSelect }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((p) => {
        const active = p.id === selectedId;
        return (
          <li key={`${p.accountId}:${p.id}`}>
            <button
              onClick={() => onSelect(p)}
              className="flex w-full gap-3 rounded-2xl p-3 text-left transition-all hover:shadow-sm"
              style={{
                background: theme.bgCard,
                border: `1px solid ${active ? theme.gold : theme.border}`,
                boxShadow: active ? `0 0 0 1px ${theme.gold}` : undefined,
              }}
              aria-current={active}
            >
              <span className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl" style={{ background: theme.bg }}>
                {p.image ? (
                  <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <FileText size={20} style={{ color: theme.textMuted }} />
                  </span>
                )}
                {p.isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                    <Play size={16} fill="#fff" color="#fff" />
                  </span>
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: theme.textMuted }}>
                  <AccountAvatar name={p.accountName} src={p.accountAvatar} platform={p.platform} size={18} />
                  <span className="truncate font-semibold" style={{ color: theme.text }}>{p.accountName}</span>
                  <span className="flex-shrink-0">· {timeAgo(p.time)}</span>
                </span>
                <span className="line-clamp-2 text-[13px] leading-snug" style={{ color: p.text ? theme.text : theme.textMuted }}>
                  {p.text || `${KIND_LABEL[p.kind] ?? "Publication"} sans texte`}
                </span>
                <span className="flex items-center gap-3 text-[11px]" style={{ color: theme.textMuted }}>
                  <span className="flex items-center gap-1"><Heart size={11} /> {p.reactions}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={11} /> {p.comments}</span>
                  {p.shares !== null && <span className="flex items-center gap-1"><Share2 size={11} /> {p.shares}</span>}
                  {p.pending > 0 && (
                    <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                      {p.pending} à traiter
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
