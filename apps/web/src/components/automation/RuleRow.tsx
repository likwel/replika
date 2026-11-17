import { useState, type ReactNode } from "react";
import { FloatingMenu, MenuItem } from "@/components/ui/FloatingMenu";
import {
  AlertTriangle, Copy, CornerDownRight, Image, Layers, Mail, MessageCircle, MoreHorizontal, Pencil, Trash2, UserCheck, Zap,
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

// Une règle se lit comme une phrase : QUAND (ce que dit le client) → ALORS (ce que SuiteFlow répond)
export function RuleRow({ rule, onToggle, onEdit, onDuplicate, onDelete }: Props) {
  const channel = CHANNEL_META[rule.channel];
  const keywords = splitKeywords(rule.trigger);
  const variants = splitVariants(rule.response);
  const unusable = isUnusable(rule);
  const where = rule.channel === "COMMENT" ? "un commentaire" : rule.channel === "DIRECT" ? "un message privé" : "un commentaire ou un message";

  return (
    <div className="row-s !items-start !gap-3 !p-3.5" style={{ opacity: rule.isActive ? 1 : 0.62, ...(unusable ? { boxShadow: "inset 0 0 0 1.5px rgba(225,29,72,0.4)" } : {}) }}>
      <div className="pt-0.5">
        <Toggle checked={rule.isActive} onChange={onToggle} label={rule.isActive ? "Mettre la règle en pause" : "Activer la règle"} />
      </div>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left" title="Modifier la règle">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="truncate text-[14.5px] font-bold tracking-[-0.01em]" style={{ color: theme.text }}>{rule.name}</b>
          {!rule.isActive && <span className="chip off !text-[10.5px]">En pause</span>}
        </div>

        <dl className="mt-2 grid grid-cols-[3.4rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 text-[13px]">
          <dt className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Quand</dt>
          <dd className="flex flex-wrap items-center gap-1" style={{ color: theme.text }}>
            {rule.matchType === "ANY" ? (
              <span>{where} arrive et qu'aucune autre règle ne répond</span>
            ) : (
              <>
                <span>{where} {rule.matchType === "EXACT" ? "est exactement" : "contient"}</span>
                {keywords.slice(0, 5).map((k) => (
                  <Chip key={k} color={theme.text} bg="var(--surface-3)">{k}</Chip>
                ))}
                {keywords.length > 5 && <span style={{ color: theme.textMuted }}>+{keywords.length - 5}</span>}
              </>
            )}
          </dd>

          <dt className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Alors</dt>
          <dd className="flex items-start gap-1.5" style={{ color: theme.text }}>
            <CornerDownRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: theme.textMuted }} />
            <span className="line-clamp-2">
              {rule.useAi ? <em style={{ color: theme.textMuted }}>l'IA rédige la réponse d'après le contexte du compte</em> : `répond « ${variants[0] ?? ""} »`}
              {rule.privateReply && rule.channel !== "DIRECT" && <span style={{ color: theme.textMuted }}> · puis écrit en privé</span>}
            </span>
          </dd>
        </dl>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: theme.textMuted }}>
          {rule.autoSend ? (
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: theme.green }} title="La réponse part toute seule"><Zap size={11} /> Envoi automatique</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: theme.amber }} title="La réponse vous est proposée dans « À traiter »"><UserCheck size={11} /> Vous validez avant l'envoi</span>
          )}
          <span className="inline-flex items-center gap-1"><channel.icon size={11} /> {rule.account ? rule.account.name : "Tous les comptes"}</span>
          {rule.postId && <span className="inline-flex items-center gap-1"><Image size={11} /> {rule.postLabel ?? "1 publication"}</span>}
          {(rule.language === "FR" || rule.language === "MG") && <LangChip rule={rule} />}
          <span className="ml-auto">
            {rule.hitCount > 0 ? `${plural(rule.hitCount, "réponse envoyée", "réponses envoyées")}${rule.lastTriggeredAt ? ` · ${timeAgo(rule.lastTriggeredAt)}` : ""}` : "Pas encore utilisée"}
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
  );
}

// Actions d'une règle : menu flottant, jamais coupé par le tableau ou la grille
export function RowMenu({ onEdit, onDuplicate, onDelete }: { onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const act = (fn: () => void) => () => {
    setAnchor(null);
    fn();
  };
  return (
    <>
      <button
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((cur) => (cur ? null : el));
        }}
        className="rounded-lg p-1.5 hover:bg-black/5"
        aria-label="Actions de la règle"
        aria-expanded={Boolean(anchor)}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={16} style={{ color: theme.textMuted }} />
      </button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)} width={168}>
          <MenuItem icon={Pencil} label="Modifier" onClick={act(onEdit)} />
          <MenuItem icon={Copy} label="Dupliquer" onClick={act(onDuplicate)} />
          <MenuItem icon={Trash2} label="Supprimer" onClick={act(onDelete)} danger />
        </FloatingMenu>
      )}
    </>
  );
}
