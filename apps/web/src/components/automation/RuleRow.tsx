import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, BookOpen, Copy, CornerDownRight, Image, Layers, Lock, Mail, MessageCircle, MoreHorizontal, Pencil, Sparkles, Trash2, UserCheck, Zap,
} from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { plural, timeAgo } from "@/lib/format";
import type { AutomationRule } from "@/lib/automation.api";
import { RULE_LANGUAGES, splitKeywords, splitVariants } from "./rules";

export const CHANNEL_META = {
  ALL: { label: "Commentaires et messages", icon: Layers },
  COMMENT: { label: "Commentaires", icon: MessageCircle },
  DIRECT: { label: "Messages privés", icon: Mail },
} as const;

// Badge de langue (rien si la règle suit le compte)
export function LangChip({ rule }: { rule: AutomationRule }) {
  const l = RULE_LANGUAGES.find((x) => x.value === rule.language);
  if (!l || !l.short) return null;
  return (
    <Chip color={theme.text} bg={theme.bg}>
      <span aria-hidden>{l.flag}</span> {l.short}
    </Chip>
  );
}

export function Chip({ children, color = theme.textMuted, bg = theme.bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

interface Props {
  rule: AutomationRule;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

// Compte visé désactivé ou non autorisé : la règle ne peut pas se déclencher
export const isUnusable = (rule: AutomationRule) =>
  Boolean(rule.account && (!rule.account.isActive || /non autoris/i.test(rule.account.syncError ?? "")));

// Une règle se lit comme une phrase : « Si le message contient … → répondre … »
export function RuleRow({ rule, onToggle, onEdit, onDuplicate, onDelete }: Props) {
  const channel = CHANNEL_META[rule.channel];
  const keywords = splitKeywords(rule.trigger);
  const variants = splitVariants(rule.response);
  const unusable = isUnusable(rule);

  return (
    <div
      className="group rounded-xl transition-[opacity,box-shadow] hover:shadow-sm"
      style={{ background: theme.bgCard, border: `1px solid ${unusable ? `${theme.red}55` : theme.border}`, opacity: rule.isActive ? 1 : 0.6 }}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="pt-0.5">
          <Toggle checked={rule.isActive} onChange={onToggle} label={rule.isActive ? "Désactiver la règle" : "Activer la règle"} />
        </div>

        <button onClick={onEdit} className="min-w-0 flex-1 text-left" title="Modifier la règle">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="mr-1 truncate text-[14px] font-semibold" style={{ color: theme.text }}>{rule.name}</p>
            {rule.autoSend ? (
              <Chip color={theme.green} bg={theme.greenSoft}><Zap size={11} /> Envoi auto</Chip>
            ) : (
              <Chip color={theme.amber} bg={theme.amberSoft}><UserCheck size={11} /> À valider</Chip>
            )}
            {rule.useAi && <Chip color={theme.goldDark} bg={theme.goldSoft}><Sparkles size={11} /> IA</Chip>}
            <LangChip rule={rule} />
            {rule.useAi && rule.aiKnowledge && <Chip><BookOpen size={11} /> Connaissances</Chip>}
          </div>

          {/* Déclencheur */}
          <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[12.5px]" style={{ color: theme.textMuted }}>
            {rule.matchType === "ANY" ? (
              <span>Tout message sans autre réponse</span>
            ) : (
              <>
                <span>{rule.matchType === "EXACT" ? "Message exactement" : "Contient"}</span>
                {keywords.slice(0, 5).map((k) => (
                  <Chip key={k} color={theme.text} bg={theme.bg}>{k}</Chip>
                ))}
                {keywords.length > 5 && <span>+{keywords.length - 5}</span>}
              </>
            )}
          </p>

          {/* Réponse */}
          <p className="mt-1 flex items-start gap-1.5 text-[13px]" style={{ color: theme.text }}>
            <CornerDownRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: theme.textMuted }} />
            <span className="line-clamp-2">
              {rule.useAi ? <em style={{ color: theme.textMuted }}>Réponse rédigée par l'IA d'après le contexte du compte</em> : `« ${variants[0] ?? ""} »`}
            </span>
          </p>

          {/* Portée et activité */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
            <Chip><channel.icon size={11} /> {channel.label}</Chip>
            <Chip>{rule.account ? rule.account.name : "Tous les comptes"}</Chip>
            {rule.postId && <Chip><Image size={11} /> {rule.postLabel ?? "1 publication"}</Chip>}
            {rule.privateReply && rule.channel !== "DIRECT" && <Chip><Lock size={10} /> + message privé</Chip>}
            {!rule.useAi && variants.length > 1 && <Chip>{variants.length} variantes</Chip>}
            <span className="ml-auto">
              {rule.hitCount > 0
                ? `${plural(rule.hitCount, "déclenchement")}${rule.lastTriggeredAt ? ` · ${timeAgo(rule.lastTriggeredAt)}` : ""}`
                : "Jamais déclenchée"}
            </span>
          </div>
          {unusable && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: theme.red }}>
              <AlertTriangle size={12} /> {rule.account!.name} est inutilisable : la règle ne se déclenche pas.
            </p>
          )}
        </button>

        <RowMenu onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

// up : s'ouvre vers le haut (dernières lignes d'un tableau défilant, où le menu serait coupé)
export function RowMenu({ onEdit, onDuplicate, onDelete, up = false }: { onEdit: () => void; onDuplicate: () => void; onDelete: () => void; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const item = (icon: ReactNode, label: string, fn: () => void, danger = false) => (
    <button
      onClick={() => {
        setOpen(false);
        fn();
      }}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-black/5"
      style={{ color: danger ? theme.red : theme.text }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Actions de la règle" aria-expanded={open}>
        <MoreHorizontal size={16} style={{ color: theme.textMuted }} />
      </button>
      {open && (
        <div className={`animate-panel-in absolute right-0 z-20 w-40 rounded-xl p-1 shadow-xl ${up ? "bottom-8" : "top-8"}`} style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          {item(<Pencil size={14} />, "Modifier", onEdit)}
          {item(<Copy size={14} />, "Dupliquer", onDuplicate)}
          {item(<Trash2 size={14} />, "Supprimer", onDelete, true)}
        </div>
      )}
    </div>
  );
}
