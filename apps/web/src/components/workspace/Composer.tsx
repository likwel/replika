import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AtSign, Send, Sparkles, Loader2 } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ApiError } from "@/lib/api";
import type { AiReply } from "@/lib/ai.api";

const MENTION_LIMIT = 6;

interface Props {
  placeholder: string;
  initialValue?: string;
  hint?: ReactNode; // ex. « Suggestion préparée par l'automatisation »
  maxLength: number;
  submitLabel?: string;
  submitOnEnter?: boolean; // messages privés : Entrée envoie, Maj+Entrée va à la ligne
  autoFocus?: boolean;
  mentions?: string[]; // personnes mentionnables avec « @ » (auteurs des commentaires du fil)
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
  mentions = [],
  onSend,
  onSuggest,
  onCancel,
}: Props) {
  const [text, setText] = useState(initialValue);
  const [busy, setBusy] = useState<"send" | "suggest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Position du « @ » en cours de saisie et texte tapé depuis : null = liste fermée
  const [mention, setMention] = useState<{ from: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);

  const matches =
    mention === null
      ? []
      : mentions.filter((n) => n.toLowerCase().includes(mention.query.toLowerCase())).slice(0, MENTION_LIMIT);

  // Détecte un « @ » ouvert : en début de texte ou après une espace, sans espace jusqu'au curseur
  const detectMention = (value: string, caret: number) => {
    if (mentions.length === 0) return setMention(null);
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]))) return setMention(null);
    const query = before.slice(at + 1);
    if (/\s/.test(query)) return setMention(null);
    setMention({ from: at, query });
    setHighlight(0);
  };

  const insertMention = (name: string) => {
    if (!mention) return;
    const caret = area.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mention.from)}@${name} ${text.slice(caret)}`;
    setText(next.slice(0, maxLength));
    setMention(null);
    const pos = mention.from + name.length + 2;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  };

  // Bouton « @ » : ouvre la liste complète en insérant l'arobase au curseur
  const openMentions = () => {
    const caret = area.current?.selectionStart ?? text.length;
    const needsSpace = caret > 0 && !/\s/.test(text[caret - 1]);
    const inserted = `${needsSpace ? " " : ""}@`;
    const next = `${text.slice(0, caret)}${inserted}${text.slice(caret)}`;
    setText(next.slice(0, maxLength));
    const pos = caret + inserted.length;
    setMention({ from: pos - 1, query: "" });
    setHighlight(0);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  };

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
    // La liste de mentions capte d'abord les touches : Entrée y choisit, elle n'envoie pas
    if (matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        return setHighlight((i) => (i + 1) % matches.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        return setHighlight((i) => (i - 1 + matches.length) % matches.length);
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return insertMention(matches[highlight]);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return setMention(null);
      }
    }
    if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const nearLimit = text.length > maxLength * 0.9;

  return (
    <div>
      {hint && <div className="mb-1.5 text-[11px] font-medium" style={{ color: theme.goldDark }}>{hint}</div>}
      <div className="relative">
        <textarea
          ref={area}
          rows={2}
          value={text}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onChange={(e) => {
            setText(e.target.value);
            detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMention(null), 120)} // laisse le clic sur un nom aboutir
          placeholder={placeholder}
          className="w-full resize-y rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
        />
        {matches.length > 0 && (
          <ul
            className="absolute left-2 right-2 top-full z-30 mt-1 overflow-hidden rounded-xl shadow-lg"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
            role="listbox"
          >
            {matches.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(name)}
                  onMouseEnter={() => setHighlight(i)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  style={{ background: i === highlight ? theme.goldSoft : "transparent", color: theme.text }}
                  role="option"
                  aria-selected={i === highlight}
                >
                  <Avatar name={name.replace(/^@/, "")} size={22} />
                  <span className="truncate">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {(notice || error) && (
        <p className="mt-1 text-xs" style={{ color: error ? theme.red : theme.goldDark }}>{error ?? notice}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mentions.length > 0 && (
          <Button size="sm" variant="ghost" icon={AtSign} onClick={openMentions} disabled={busy !== null} title="Mentionner quelqu'un du fil">
            Mentionner
          </Button>
        )}
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
