import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import type { AiReply } from "@/lib/ai.api";

interface Props {
  placeholder: string;
  initialValue?: string;
  hint?: ReactNode; // ex. « Suggestion préparée par l'automatisation »
  maxLength: number;
  submitLabel?: string;
  submitOnEnter?: boolean; // messages privés : Entrée envoie, Maj+Entrée va à la ligne
  autoFocus?: boolean;
  onSend: (text: string) => Promise<void>;
  onSuggest?: () => Promise<AiReply>;
  onCancel?: () => void;
}

// Zone de saisie commune : réponse à un commentaire, commentaire sur une publication, message privé
export function Composer({
  placeholder,
  initialValue = "",
  hint,
  maxLength,
  submitLabel = "Envoyer",
  submitOnEnter,
  autoFocus,
  onSend,
  onSuggest,
  onCancel,
}: Props) {
  const [text, setText] = useState(initialValue);
  const [busy, setBusy] = useState<"send" | "suggest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy("send");
    setError(null);
    try {
      await onSend(value);
      setText("");
      setNotice(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setBusy(null);
    }
  };

  const suggest = async () => {
    if (!onSuggest) return;
    setBusy("suggest");
    setError(null);
    setNotice(null);
    try {
      const r = await onSuggest();
      if (r.reply) setText(r.reply);
      setNotice(
        !r.reply
          ? "L'IA ne propose pas de réponse : message jugé hors sujet ou indésirable."
          : r.needsHuman
            ? "À relire : l'IA estime qu'une vérification humaine est nécessaire."
            : null
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Suggestion impossible.");
    } finally {
      setBusy(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const nearLimit = text.length > maxLength * 0.9;

  return (
    <div>
      {hint && <div className="mb-1.5 text-[11px] font-medium" style={{ color: theme.goldDark }}>{hint}</div>}
      <textarea
        rows={2}
        value={text}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
        style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
      />
      {(notice || error) && (
        <p className="mt-1 text-xs" style={{ color: error ? theme.red : theme.goldDark }}>{error ?? notice}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onSuggest && (
          <Button size="sm" variant="soft" onClick={suggest} disabled={busy !== null}>
            {busy === "suggest" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Suggestion IA
          </Button>
        )}
        <span className="flex-1 text-right text-[11px]" style={{ color: nearLimit ? theme.red : theme.textMuted }}>
          {submitOnEnter ? "Entrée pour envoyer · Maj+Entrée pour aller à la ligne" : ""}
          {nearLimit && ` ${text.length}/${maxLength}`}
        </span>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy === "send"}>Annuler</Button>
        )}
        <Button size="sm" onClick={send} disabled={!text.trim() || busy !== null}>
          {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
