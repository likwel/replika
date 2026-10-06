import { useState, type ReactNode, type Ref } from "react";
import { CornerDownRight, EyeOff, Eye, Trash2, Sparkles, Loader2, Heart } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { IntentChip } from "@/components/messages/IntentChip";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { AiReply } from "@/lib/ai.api";
import type { WsComment } from "@/lib/workspace.api";
import { Composer } from "./Composer";

interface Props {
  comment: WsComment;
  accountName: string;
  mentions?: string[]; // auteurs du fil, proposés après « @ » dans la réponse
  isReply?: boolean;
  highlighted?: boolean; // ouvert depuis « À traiter »
  highlightRef?: Ref<HTMLDivElement>;
  replying: boolean;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReply: (text: string) => Promise<void>;
  onSuggest: () => Promise<AiReply>;
  onHide: (hidden: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  children?: ReactNode; // réponses
}

export function CommentItem({
  comment: c,
  accountName,
  mentions,
  isReply,
  highlighted,
  highlightRef,
  replying,
  onStartReply,
  onCancelReply,
  onReply,
  onSuggest,
  onHide,
  onDelete,
  children,
}: Props) {
  const [busy, setBusy] = useState<"hide" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suggestion = c.inbox?.suggestion ?? null;

  const run = async (kind: "hide" | "delete", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn(); // en cas de succès, le parent met à jour ou retire le commentaire
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!window.confirm("Supprimer définitivement ce commentaire ? Son auteur ne sera pas prévenu.")) return;
    void run("delete", onDelete);
  };

  const action = "flex items-center gap-1 font-medium hover:underline disabled:opacity-50";

  return (
    <div className={isReply ? "ml-10 mt-2" : ""}>
      <div
        ref={highlightRef}
        className={`flex gap-2.5 ${highlighted ? "-m-1.5 rounded-2xl p-1.5" : ""}`}
        style={highlighted ? { boxShadow: `0 0 0 2px ${theme.gold}` } : undefined}
      >
        <Avatar name={c.author.replace(/^@/, "")} size={isReply ? 26 : 32} />
        <div className="min-w-0 flex-1">
          <div
            className="rounded-2xl px-3 py-2"
            style={{
              background: c.isOwn ? theme.goldSoft : theme.bg,
              opacity: c.hidden ? 0.55 : 1,
            }}
          >
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{ color: theme.text }}>
              {c.author}
              {c.isOwn && (
                <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: theme.gold, color: "#1A1410" }}>
                  Vous
                </span>
              )}
              {c.hidden && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: theme.textMuted }}>
                  <EyeOff size={10} /> Masqué
                </span>
              )}
              {c.inbox?.intent && <IntentChip intent={c.inbox.intent} />}
            </p>
            <p className="whitespace-pre-line break-words text-sm" style={{ color: theme.text }}>{c.text}</p>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-[11px]" style={{ color: theme.textMuted }}>
            <span>{timeAgo(c.time)}</span>
            {c.likes > 0 && <span className="flex items-center gap-0.5"><Heart size={10} /> {c.likes}</span>}
            {!c.isOwn && (
              <button onClick={onStartReply} className={action} style={{ color: theme.goldDark }}>
                <CornerDownRight size={11} /> Répondre
              </button>
            )}
            {c.canHide && (
              <button onClick={() => run("hide", () => onHide(!c.hidden))} disabled={busy !== null} className={action}>
                {busy === "hide" ? <Loader2 size={11} className="animate-spin" /> : c.hidden ? <Eye size={11} /> : <EyeOff size={11} />}
                {c.hidden ? "Afficher" : "Masquer"}
              </button>
            )}
            {c.canDelete && (
              <button onClick={remove} disabled={busy !== null} className={action} style={{ color: theme.red }}>
                {busy === "delete" ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Supprimer
              </button>
            )}
            {suggestion && !replying && (
              <button onClick={onStartReply} className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                <Sparkles size={10} /> Réponse prête
              </button>
            )}
          </div>
          {error && <p className="mt-1 px-3 text-xs" style={{ color: theme.red }}>{error}</p>}

          {replying && (
            <div className="mt-2">
              <Composer
                placeholder={`Répondre à ${c.author} en tant que ${accountName}…`}
                initialValue={suggestion ?? ""}
                hint={suggestion ? <span className="flex items-center gap-1"><Sparkles size={11} /> Suggestion préparée par l'automatisation — modifiable</span> : undefined}
                maxLength={8000}
                submitLabel="Répondre"
                mentions={mentions}
                autoFocus
                onSend={onReply}
                onSuggest={onSuggest}
                onCancel={onCancelReply}
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
