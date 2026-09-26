import { useState } from "react";
import { Send, ArrowUpRight, EyeOff, Sparkles, AlertTriangle, CornerDownRight, Loader2, Bot, ChevronRight } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { PlatIcon } from "@/components/ui/PlatIcon";
import { IntentChip } from "./IntentChip";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { messageApi, type InboxMessage, type MessageStatus } from "@/lib/message.api";

const KIND_LABEL = { COMMENT: "Commentaire", LIVE_COMMENT: "Commentaire live", DIRECT: "Message privé" } as const;

const STATUS_META: Record<MessageStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "En attente", color: theme.textMuted, bg: theme.bg },
  REPLIED: { label: "Répondu", color: theme.goldDark, bg: theme.goldSoft },
  ESCALATED: { label: "Escaladé", color: theme.red, bg: "#FDECEC" },
  IGNORED: { label: "Ignoré", color: theme.textMuted, bg: theme.bg },
};

type Action = "reply" | "escalate" | "ignore" | "suggest";

interface Props {
  message: InboxMessage;
  onChange: (m: InboxMessage) => void;
  context?: { label: string; onOpen: () => void }; // publication ou conversation d'origine
}

export function MessageCard({ message: m, onChange, context }: Props) {
  const [draft, setDraft] = useState(m.aiReply ?? "");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canReply = m.status === "PENDING" || m.status === "ESCALATED";
  const isSuggestion = m.status === "PENDING" && Boolean(m.aiReply);
  const status = isSuggestion
    ? { label: "Suggestion", color: theme.goldDark, bg: theme.goldSoft }
    : STATUS_META[m.status];
  const suggestionSource = !m.aiReply
    ? null
    : m.aiGenerated
      ? "Suggestion de l'IA"
      : m.rule
        ? `Suggestion de la règle « ${m.rule.name} »`
        : null;

  const run = async (action: Exclude<Action, "suggest">) => {
    setBusy(action);
    setError(null);
    try {
      const updated =
        action === "reply"
          ? await messageApi.reply(m.id, draft.trim())
          : action === "escalate"
            ? await messageApi.escalate(m.id)
            : await messageApi.ignore(m.id);
      onChange({ ...m, ...updated });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const suggest = async () => {
    setBusy("suggest");
    setError(null);
    setNotice(null);
    try {
      const { suggestion, ...updated } = await messageApi.aiSuggest(m.id);
      if (suggestion.reply) setDraft(suggestion.reply);
      setNotice(
        !suggestion.reply
          ? "L'IA ne propose pas de réponse : message jugé hors sujet ou indésirable."
          : suggestion.needsHuman
            ? "L'IA conseille une vérification humaine avant l'envoi."
            : null
      );
      onChange({ ...m, ...updated });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Suggestion impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: theme.bgCard,
        border: `1px solid ${theme.border}`,
        opacity: m.status === "IGNORED" ? 0.6 : 1,
      }}
    >
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="relative">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: theme.goldSoft, color: theme.goldDark }}
          >
            {m.authorName.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
          </div>
          <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5">
            <PlatIcon p={m.account.platform === "INSTAGRAM" ? "ig" : "fb"} size={12} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{m.authorName}</p>
          <p className="truncate text-[11px]" style={{ color: theme.textMuted }}>
            {KIND_LABEL[m.kind]} sur {m.account.name} · {timeAgo(m.createdAt)}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          {m.intent && <IntentChip intent={m.intent} />}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Contenu */}
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: theme.text }}>{m.content}</p>
      {context && (
        <button
          onClick={context.onOpen}
          className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
          style={{ color: theme.goldDark }}
        >
          {context.label} <ChevronRight size={13} />
        </button>
      )}

      {/* Réponse publiée */}
      {m.status === "REPLIED" && m.aiReply && (
        <div className="mt-3 flex gap-2 rounded-xl px-3 py-2.5" style={{ background: theme.goldSoft }}>
          <CornerDownRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: theme.goldDark }} />
          <div className="min-w-0">
            <p className="text-sm" style={{ color: theme.text }}>{m.aiReply}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: theme.goldDark }}>
              {m.aiGenerated ? (
                <><Bot size={11} /> Réponse IA</>
              ) : m.rule ? (
                `Règle « ${m.rule.name} »`
              ) : (
                "Réponse manuelle"
              )}
              {m.repliedAt && ` · ${timeAgo(m.repliedAt)}`}
            </p>
          </div>
        </div>
      )}

      {/* Avertissement non bloquant (ex. message privé refusé) */}
      {m.status === "REPLIED" && m.error && (
        <p className="mt-2 text-[11px]" style={{ color: theme.redLight }}>{m.error}</p>
      )}

      {/* Composer */}
      {canReply && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: theme.border }}>
          {m.error && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs" style={{ background: "#FDECEC", color: theme.red }}>
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {m.error}
            </p>
          )}
          {suggestionSource && (
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium" style={{ color: theme.goldDark }}>
              <Sparkles size={12} /> {suggestionSource} — modifiable avant envoi
            </p>
          )}
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={m.kind === "DIRECT" ? "Répondre en privé…" : "Répondre publiquement…"}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
          />
          {notice && <p className="mt-1.5 text-xs" style={{ color: theme.goldDark }}>{notice}</p>}
          {error && <p className="mt-1.5 text-xs" style={{ color: theme.red }}>{error}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => run("reply")} disabled={!draft.trim() || busy !== null}>
              {busy === "reply" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isSuggestion || (m.status === "ESCALATED" && m.aiReply) ? "Valider et envoyer" : "Envoyer"}
            </Button>
            <Button size="sm" variant="soft" onClick={suggest} disabled={busy !== null}>
              {busy === "suggest" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {m.aiGenerated ? "Nouvelle suggestion" : "Suggérer avec l'IA"}
            </Button>
            {m.status === "PENDING" && (
              <Button size="sm" variant="ghost" icon={ArrowUpRight} onClick={() => run("escalate")} disabled={busy !== null}>
                Escalader
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={EyeOff} onClick={() => run("ignore")} disabled={busy !== null}>
              Ignorer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
