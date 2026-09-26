import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, RefreshCw, Sparkles } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { workspaceApi, type WsConversation, type WsMessage } from "@/lib/workspace.api";
import { AccountAvatar } from "./AccountAvatar";
import { Composer } from "./Composer";

interface Props {
  conversation: WsConversation;
  onBack: () => void;
  onSent: (text: string) => void; // met à jour l'aperçu dans la liste
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function ConversationView({ conversation: c, onBack, onSent }: Props) {
  const [messages, setMessages] = useState<WsMessage[] | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const network = c.platform === "INSTAGRAM" ? "Instagram" : "Messenger";

  const load = () => {
    setLoading(true);
    setError(null);
    workspaceApi
      .conversation(c.accountId, c.id)
      .then((d) => {
        setMessages(d.messages);
        setSuggestion(d.suggestion);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Conversation indisponible."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [c.accountId, c.id]);

  // Défile jusqu'au dernier message, sans faire bouger le reste de la page
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (text: string) => {
    await workspaceApi.sendMessage(c.accountId, c.id, text);
    setMessages((m) => [...(m ?? []), { id: `local_${Date.now()}`, text, time: new Date().toISOString(), isOwn: true }]);
    setSuggestion(null);
    onSent(text);
  };

  // Messenger / Instagram : réponse possible seulement 24 h après le dernier message du client
  const lastFromClient = messages ? [...messages].reverse().find((m) => !m.isOwn) : undefined;
  const windowClosed = lastFromClient ? Date.now() - new Date(lastFromClient.time).getTime() > DAY_MS : false;

  return (
    <article className="flex flex-col rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: theme.border }}>
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-black/5 lg:hidden" aria-label="Retour à la liste">
          <ArrowLeft size={18} style={{ color: theme.text }} />
        </button>
        <Avatar name={c.participant.name.replace(/^@/, "")} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{c.participant.name}</p>
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: theme.textMuted }}>
            <AccountAvatar name={c.accountName} src={c.accountAvatar} platform={c.platform} size={16} />
            {network} · {c.accountName}
          </p>
        </div>
        <button onClick={load} className="rounded-lg p-1.5 hover:bg-black/5" title="Recharger">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: theme.textMuted }} />
        </button>
      </header>

      <div ref={scrollRef} className="max-h-[55vh] min-h-[240px] overflow-y-auto px-4 py-4 lg:max-h-[calc(100vh-24rem)]" style={{ background: theme.bg }}>
        {error ? (
          <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>
        ) : messages === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-10 w-2/3 animate-pulse rounded-2xl ${i % 2 ? "ml-auto" : ""}`} style={{ background: theme.border }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: theme.textMuted }}>Aucun message.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex max-w-[80%] flex-col ${m.isOwn ? "ml-auto items-end" : "items-start"}`}>
                <div
                  className="whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm"
                  style={{
                    background: m.isOwn ? theme.gold : theme.bgCard,
                    color: m.isOwn ? "#1A1410" : theme.text,
                    border: m.isOwn ? "none" : `1px solid ${theme.border}`,
                    borderBottomRightRadius: m.isOwn ? 6 : undefined,
                    borderBottomLeftRadius: m.isOwn ? undefined : 6,
                  }}
                >
                  {m.text || <em style={{ opacity: 0.7 }}>Pièce jointe</em>}
                </div>
                <span className="mt-0.5 px-1 text-[10px]" style={{ color: theme.textMuted }}>{formatDateTime(m.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t px-4 py-3" style={{ borderColor: theme.border }}>
        {windowClosed && (
          <p className="mb-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs" style={{ background: theme.goldSoft, color: theme.goldDark }}>
            <Clock size={13} className="mt-0.5 flex-shrink-0" />
            Dernier message du client il y a plus de 24 h : {network} risque de refuser la réponse.
          </p>
        )}
        {messages !== null && (
          <Composer
            key={`${c.id}:${suggestion ?? ""}`}
            placeholder={`Répondre à ${c.participant.name}…`}
            initialValue={suggestion ?? ""}
            hint={suggestion ? <span className="flex items-center gap-1"><Sparkles size={11} /> Suggestion préparée par l'automatisation — modifiable</span> : undefined}
            maxLength={2000}
            submitOnEnter
            onSend={send}
            onSuggest={() => workspaceApi.suggestDirect(c.accountId, c.id)}
          />
        )}
      </footer>
    </article>
  );
}
