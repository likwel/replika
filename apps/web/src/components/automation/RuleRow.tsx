import { Pencil, Trash2, Layers, MessageCircle, Mail, Zap, UserCheck, Lock, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { plural, timeAgo } from "@/lib/format";
import type { AutomationRule } from "@/lib/automation.api";
import { splitKeywords, splitVariants } from "./rules";

const CHANNEL_META = {
  ALL: { label: "Commentaires + messages", icon: Layers },
  COMMENT: { label: "Commentaires", icon: MessageCircle },
  DIRECT: { label: "Messages privés", icon: Mail },
} as const;

function Chip({ children, color = theme.textMuted, bg = theme.bgCard }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

interface Props {
  rule: AutomationRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RuleRow({ rule, onToggle, onEdit, onDelete }: Props) {
  const channel = CHANNEL_META[rule.channel];
  const keywords = splitKeywords(rule.trigger);
  const variants = splitVariants(rule.response);

  return (
    <div
      className="rounded-xl p-3.5 transition-opacity"
      style={{ background: theme.bg, border: `1px solid ${theme.border}`, opacity: rule.isActive ? 1 : 0.55 }}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Toggle checked={rule.isActive} onChange={onToggle} label={rule.isActive ? "Désactiver" : "Activer"} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="mr-1 text-sm font-semibold" style={{ color: theme.text }}>{rule.name}</p>
            {rule.autoSend ? (
              <Chip color={theme.goldDark} bg={theme.goldSoft}><Zap size={11} /> Envoi auto</Chip>
            ) : (
              <Chip><UserCheck size={11} /> À valider</Chip>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip><channel.icon size={11} /> {channel.label}</Chip>
            {rule.account && <Chip>{rule.account.name}</Chip>}
            {rule.account && (!rule.account.isActive || /non autoris/i.test(rule.account.syncError ?? "")) && (
              <Chip color={theme.red} bg="#FDECEC"><AlertTriangle size={11} /> Compte inutilisable : la règle ne se déclenche pas</Chip>
            )}
            {rule.matchType === "ANY" ? (
              <Chip color={theme.text} bg={theme.border}>Tout message</Chip>
            ) : (
              <>
                {keywords.slice(0, 4).map((k) => (
                  <Chip key={k} color={theme.text} bg={theme.border}>{rule.matchType === "EXACT" ? `= ${k}` : k}</Chip>
                ))}
                {keywords.length > 4 && <Chip>+{keywords.length - 4}</Chip>}
              </>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-[13px]" style={{ color: theme.text }}>
            « {variants[0]} »
          </p>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]" style={{ color: theme.textMuted }}>
            <span>
              {rule.hitCount > 0
                ? `Déclenchée ${plural(rule.hitCount, "fois", "fois")}${rule.lastTriggeredAt ? ` · ${timeAgo(rule.lastTriggeredAt)}` : ""}`
                : "Jamais déclenchée"}
            </span>
            {variants.length > 1 && <span>· {variants.length} variantes</span>}
            {rule.privateReply && rule.channel !== "DIRECT" && (
              <span className="inline-flex items-center gap-0.5">· <Lock size={10} /> message privé</span>
            )}
            {rule.priority !== 0 && <span>· priorité {rule.priority}</span>}
          </p>
        </div>

        <div className="flex gap-0.5">
          <button onClick={onEdit} className="rounded-lg p-1.5 hover:bg-black/5" title="Modifier">
            <Pencil size={15} style={{ color: theme.textMuted }} />
          </button>
          <button onClick={onDelete} className="rounded-lg p-1.5 hover:bg-black/5" title="Supprimer">
            <Trash2 size={15} style={{ color: theme.red }} />
          </button>
        </div>
      </div>
    </div>
  );
}
