import { MessageCircle, Play } from "lucide-react";
import { theme } from "@/theme";
import type { WsPost } from "@/lib/workspace.api";
import { AccountAvatar } from "./AccountAvatar";

interface Props {
  posts: WsPost[];
  selectedId: string | null;
  onSelect: (post: WsPost) => void;
}

// Vue galerie : les visuels de toutes les Pages en mosaïque
export function PostGrid({ posts, selectedId, onSelect }: Props) {
  return (
    <ul className="grid grid-cols-3 gap-1.5">
      {posts.map((p) => {
        const active = p.id === selectedId;
        return (
          <li key={`${p.accountId}:${p.id}`}>
            <button
              onClick={() => onSelect(p)}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl text-left"
              style={{
                background: p.image ? "#0d0b09" : theme.goldSoft,
                outline: active ? `3px solid ${theme.gold}` : "none",
                outlineOffset: -3,
              }}
              aria-current={active}
              title={p.text || p.accountName}
            >
              {p.image ? (
                <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <span className="line-clamp-4 block p-2 pt-8 text-[11px] leading-snug" style={{ color: theme.goldDark }}>
                  {p.text || "Publication sans texte"}
                </span>
              )}

              <span className="absolute left-1.5 top-1.5">
                <AccountAvatar name={p.accountName} src={p.accountAvatar} platform={p.platform} size={20} />
              </span>
              {p.isVideo && (
                <span className="absolute right-1.5 top-1.5 rounded-full p-1" style={{ background: "rgba(0,0,0,0.45)" }}>
                  <Play size={10} fill="#fff" color="#fff" />
                </span>
              )}

              <span
                className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-1.5 pb-1 pt-4 text-[10px] font-semibold text-white"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}
              >
                <MessageCircle size={10} /> {p.comments}
                {p.pending > 0 && (
                  <span className="ml-auto rounded-full px-1.5" style={{ background: theme.gold, color: "#1A1410" }}>
                    {p.pending}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
