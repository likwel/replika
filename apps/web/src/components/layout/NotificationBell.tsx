import { useRef, useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { theme } from "@/theme";
import { FloatingMenu } from "@/components/ui/FloatingMenu";
import { PlatIcon } from "@/components/ui/PlatIcon";
import { Button } from "@/components/ui/Button";
import { useNotifications } from "@/hooks/useNotifications";
import { setPendingFocus } from "@/components/workspace/pendingFocus";
import type { Focus } from "@/components/workspace/helpers";
import { timeAgo } from "@/lib/format";
import type { NotificationItem } from "@/lib/message.api";

interface Props {
  onNavigate: (menuId: string, sub: number) => void;
}

const KIND = { COMMENT: "Commentaire", LIVE_COMMENT: "Commentaire live", DIRECT: "Message privé" } as const;

// Où ouvrir le message : la conversation ou la publication d'origine, sinon la page À traiter
function focusOf(m: NotificationItem): { focus: Focus; sub: number } | null {
  if (m.kind === "DIRECT") return m.authorId ? { focus: { kind: "conversation", accountId: m.accountId, personId: m.authorId }, sub: 1 } : null;
  return m.postId ? { focus: { kind: "post", accountId: m.accountId, postId: m.postId, commentId: m.externalId }, sub: 0 } : null;
}

// Cloche de l'en-tête : la bulle compte les NOUVEAUX messages à traiter (jamais vus). Un message est « vu » quand on l'ouvre
// ici, qu'on le consulte dans À traiter, ou avec « Tout marquer comme vu » ; il reste à traiter tant qu'on n'a pas répondu.
export function NotificationBell({ onNavigate }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { data, markSeen } = useNotifications(true);
  const unseen = data?.unseen ?? 0;
  const total = data?.total ?? 0;

  const openItem = (m: NotificationItem) => {
    setOpen(false);
    if (!m.seen) void markSeen({ ids: [m.id] });
    const target = focusOf(m);
    if (target) {
      setPendingFocus(target.focus);
      onNavigate("hub", target.sub);
    } else onNavigate("queue", 0);
  };

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        className="ibtn relative"
        aria-label={unseen ? `Notifications : ${unseen} nouveau${unseen > 1 ? "x" : ""} à traiter` : "Notifications : rien de nouveau"}
        aria-haspopup="menu"
        aria-expanded={open}
        title={unseen ? `${unseen} nouveau${unseen > 1 ? "x" : ""} à traiter` : total ? `${total} à traiter, rien de nouveau` : "Rien à traiter"}
      >
        <Bell size={17} />
        {unseen > 0 && (
          <span key={unseen} className="cnt hot animate-pop-in absolute -right-1 -top-1 !m-0 min-w-[18px] !px-1 text-center !text-[10.5px] leading-[18px]" style={{ boxShadow: "0 0 0 2px var(--surface)" }}>
            {unseen > 99 ? "99+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <FloatingMenu anchor={btn.current} onClose={() => setOpen(false)} width={372} rich>
          <div className="flex items-center gap-2 px-2 pb-2 pt-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold" style={{ color: theme.text }}>À traiter</p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                {total === 0 ? "Tout est traité" : `${total} en attente${unseen ? ` · ${unseen} nouveau${unseen > 1 ? "x" : ""}` : " · rien de nouveau"}`}
              </p>
            </div>
            {unseen > 0 && (
              <button onClick={() => void markSeen({ all: true })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-black/5" style={{ color: theme.goldDark }}>
                <CheckCheck size={14} /> Tout marquer comme vu
              </button>
            )}
          </div>

          {data === null ? (
            <div className="mx-1 h-24 animate-pulse rounded-xl" style={{ background: "var(--surface-2)" }} />
          ) : data.items.length === 0 ? (
            <div className="mx-1 flex flex-col items-center gap-1.5 rounded-xl px-4 py-8 text-center" style={{ background: "var(--surface-2)" }}>
              <Inbox size={22} style={{ color: theme.textMuted }} />
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Rien à traiter</p>
              <p className="text-xs" style={{ color: theme.textMuted }}>Les nouveaux commentaires et messages qui attendent une réponse apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="flex max-h-[340px] flex-col gap-0.5 overflow-y-auto">
              {data.items.map((m) => (
                <li key={m.id}>
                  <button onClick={() => openItem(m)} role="menuitem" className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/5" style={m.seen ? undefined : { background: "rgb(var(--color-gold-rgb) / 0.08)" }}>
                    <span className="relative mt-0.5 flex-shrink-0">
                      <span className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                        {m.authorName.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5"><PlatIcon p={m.account.platform === "INSTAGRAM" ? "ig" : "fb"} size={11} /></span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold" style={{ color: theme.text }}>{m.authorName}</span>
                        {m.status === "ESCALATED" && <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: theme.dangerBg, color: theme.red }}>Escaladé</span>}
                        <span className="ml-auto flex-shrink-0 text-[11px]" style={{ color: theme.textMuted }}>{timeAgo(m.createdAt)}</span>
                      </span>
                      <span className="line-clamp-2 text-[12.5px] leading-snug" style={{ color: theme.text }}>{m.content}</span>
                      <span className="block truncate text-[11px]" style={{ color: theme.textMuted }}>{KIND[m.kind]} · {m.account.name}</span>
                    </span>
                    {!m.seen && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--color-gold)" }} aria-label="Nouveau" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1 border-t px-1 pt-1.5" style={{ borderColor: "var(--line)" }}>
            <Button
              size="sm"
              variant="soft"
              icon={Inbox}
              className="w-full justify-center"
              onClick={() => {
                setOpen(false);
                onNavigate("queue", 0);
              }}
            >
              Ouvrir « À traiter »{data && total > data.items.length ? ` (${total})` : ""}
            </Button>
          </div>
        </FloatingMenu>
      )}
    </>
  );
}
