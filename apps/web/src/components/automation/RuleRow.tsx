import { useState, type ReactNode } from "react";
import { FloatingMenu, MenuItem } from "@/components/ui/FloatingMenu";
import {
  AlertTriangle, BarChart3, ChevronDown, Copy, CornerDownRight, Image, Layers, Mail, MessageCircle, Hash, MessageSquareDashed, Pause, Pencil, Play, Power, Settings2, Sparkles, Trash2, UserCheck,
} from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Dash";
import { timeAgo } from "@/lib/format";
import type { AutomationRule } from "@/lib/automation.api";
import { RULE_LANGUAGES, accountsLabel, allAccountsUnusable, splitKeywords, splitVariants } from "./rules";

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
  onToggle: () => void; // active / met en pause la règle
  onToggleAuto: () => void; // envoi automatique ↔ validation avant envoi
  onTest: () => void;
  onStats: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

// Compte visé désactivé ou non autorisé : la règle ne peut pas se déclencher
export const isUnusable = (rule: AutomationRule) => allAccountsUnusable(rule.accounts);

// Nature de la règle : mots-clés, IA ou réponse par défaut (couleur + icône pour la reconnaître d'un coup d'œil)
export function ruleKind(r: AutomationRule) {
  if (r.useAi) return { label: "IA", icon: Sparkles, tint: "#F59E0B" };
  if (r.matchType === "ANY") return { label: "Par défaut", icon: MessageSquareDashed, tint: "#64748B" };
  return { label: "Mots-clés", icon: Hash, tint: "#8B5CF6" };
}

// Interrupteur avec son libellé : cliquer sur le texte bascule aussi
export function LabeledSwitch({ checked, onChange, text, hint, disabled }: { checked: boolean; onChange: () => void; text: string; hint: string; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-[12.5px] font-semibold ${disabled ? "opacity-50" : "cursor-pointer"}`} style={{ color: theme.text }} title={hint}>
      <Toggle checked={checked} onChange={onChange} label={text} disabled={disabled} />
      <span className="select-none">{text}</span>
    </label>
  );
}

// Une règle se lit comme une phrase : QUAND (ce que dit le client) → ALORS (ce que SuiteFlow répond).
// Sous la phrase, la barre de contrôle : activer, réponse automatique, gérer.
export function RuleRow({ rule, onToggle, onToggleAuto, onTest, onStats, onEdit, onDuplicate, onDelete }: Props) {
  const channel = CHANNEL_META[rule.channel];
  const keywords = splitKeywords(rule.trigger);
  const variants = splitVariants(rule.response);
  const unusable = isUnusable(rule);
  const kind = ruleKind(rule);
  const where = rule.channel === "COMMENT" ? "un commentaire" : rule.channel === "DIRECT" ? "un message privé" : "un commentaire ou un message";

  return (
    <div className="row-s !flex-col !items-stretch !gap-0 !overflow-hidden !p-0" style={unusable ? { boxShadow: "inset 0 0 0 1.5px rgba(225,29,72,0.4)" } : undefined}>
      <button onClick={onEdit} className="min-w-0 p-3.5 text-left" title="Gérer la règle" style={{ opacity: rule.isActive ? 1 : 0.62 }}>
        <div className="flex items-start gap-3">
          <IconTile icon={kind.icon} tint={rule.isActive ? kind.tint : "#94A3B8"} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <b className="truncate text-[15px] font-bold tracking-[-0.01em]" style={{ color: theme.text }}>{rule.name}</b>
              <span className="chip off !text-[10.5px]">{kind.label}</span>
              <span className={`chip ${rule.isActive ? "ok" : "off"} !text-[10.5px]`}>{rule.isActive ? "Active" : "En pause"}</span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px]" style={{ color: theme.textMuted }}>
              <span className="inline-flex items-center gap-1"><channel.icon size={11} /> {accountsLabel(rule.accounts)}</span>
              {rule.postId && <span className="inline-flex items-center gap-1"><Image size={11} /> {rule.postLabel ?? "1 publication"}</span>}
              {(rule.language === "FR" || rule.language === "MG") && <LangChip rule={rule} />}
            </p>
          </div>
          {/* Performance : le chiffre qui compte */}
          <div className="flex-shrink-0 text-right leading-tight">
            <b className="block text-[18px] font-extrabold tabular-nums" style={{ color: rule.hitCount ? theme.text : theme.textMuted }}>{rule.hitCount}</b>
            <span className="block text-[10.5px]" style={{ color: theme.textMuted }}>{rule.hitCount > 1 ? "réponses" : "réponse"}</span>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-[3.4rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 text-[13px]">
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

        {rule.lastTriggeredAt && <p className="mt-2 text-[11.5px]" style={{ color: theme.textMuted }}>Dernière réponse {timeAgo(rule.lastTriggeredAt)}</p>}
        {unusable && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: theme.red }}>
            <AlertTriangle size={12} /> {accountsLabel(rule.accounts)} {rule.accounts.length > 1 ? "sont inutilisables" : "est inutilisable"} : la règle ne se déclenche pas.
          </p>
        )}
      </button>

      {/* Barre de contrôle : tout se règle sans ouvrir la règle */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-3.5 py-2" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <LabeledSwitch
          checked={rule.autoSend}
          onChange={onToggleAuto}
          text="Réponse automatique"
          hint={rule.autoSend ? "La réponse part toute seule. Désactivez pour la valider vous-même dans « À traiter »." : "La réponse vous est proposée dans « À traiter ». Activez pour qu'elle parte toute seule."}
        />
        {!rule.autoSend && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: theme.amber }}><UserCheck size={12} /> Vous validez avant l'envoi</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <RowMenu active={rule.isActive} onToggle={onToggle} onEdit={onEdit} onTest={onTest} onStats={onStats} onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}

// « Gérer » : un seul bouton qui déplie toutes les actions d'une règle (menu flottant, jamais coupé par le tableau)
export function RowMenu({ active, onToggle, onEdit, onTest, onStats, onDuplicate, onDelete }: { active: boolean; onToggle: () => void; onEdit: () => void; onTest: () => void; onStats: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const act = (fn: () => void) => () => {
    setAnchor(null);
    fn();
  };
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={Settings2}
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((cur) => (cur ? null : el));
        }}
        aria-expanded={Boolean(anchor)}
        aria-haspopup="menu"
      >
        Gérer
        <ChevronDown size={13} className="transition-transform" style={{ transform: anchor ? "rotate(180deg)" : undefined }} />
      </Button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)} width={188}>
          <MenuItem icon={Pencil} label="Modifier la règle" onClick={act(onEdit)} />
          <MenuItem icon={Play} label="Tester" onClick={act(onTest)} />
          <MenuItem icon={BarChart3} label="Statistiques" onClick={act(onStats)} />
          <MenuItem icon={active ? Pause : Power} label={active ? "Mettre en pause" : "Activer"} onClick={act(onToggle)} />
          <MenuItem icon={Copy} label="Dupliquer" onClick={act(onDuplicate)} />
          <MenuItem icon={Trash2} label="Supprimer" onClick={act(onDelete)} danger />
        </FloatingMenu>
      )}
    </>
  );
}
