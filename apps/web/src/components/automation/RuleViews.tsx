import type { ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Image, Lock, Sparkles, UserCheck, Zap } from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { timeAgo } from "@/lib/format";
import type { AutomationRule } from "@/lib/automation.api";
import { CHANNEL_META, Chip, LangChip, RowMenu, isUnusable } from "./RuleRow";
import { splitKeywords, splitVariants } from "./rules";

export type RuleSort = "priority" | "name" | "hits" | "recent" | "created";

export interface RuleActions {
  onToggle: (r: AutomationRule) => void;
  onEdit: (r: AutomationRule) => void;
  onDuplicate: (r: AutomationRule) => void;
  onDelete: (r: AutomationRule) => void;
}

function SendBadge({ rule }: { rule: AutomationRule }) {
  return rule.autoSend ? (
    <Chip color={theme.green} bg={theme.greenSoft}><Zap size={11} /> Auto</Chip>
  ) : (
    <Chip color={theme.amber} bg={theme.amberSoft}><UserCheck size={11} /> À valider</Chip>
  );
}

function Trigger({ rule, max }: { rule: AutomationRule; max: number }) {
  if (rule.matchType === "ANY") return <span className="text-[12.5px] italic" style={{ color: theme.textMuted }}>Tout message</span>;
  const keywords = splitKeywords(rule.trigger);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {rule.matchType === "EXACT" && <span className="text-[11.5px]" style={{ color: theme.textMuted }}>exact :</span>}
      {keywords.slice(0, max).map((k) => (
        <Chip key={k} color={theme.text}>{k}</Chip>
      ))}
      {keywords.length > max && <span className="text-[11.5px]" style={{ color: theme.textMuted }}>+{keywords.length - max}</span>}
    </span>
  );
}

const replyText = (rule: AutomationRule) => (rule.useAi ? null : splitVariants(rule.response)[0] ?? "");

function Usage({ rule }: { rule: AutomationRule }) {
  if (!rule.hitCount) return <span style={{ color: theme.textMuted }}>Jamais</span>;
  return (
    <span>
      <strong className="tabular-nums" style={{ color: theme.text }}>{rule.hitCount}</strong>
      {rule.lastTriggeredAt && <span className="block text-[11px]" style={{ color: theme.textMuted }}>{timeAgo(rule.lastTriggeredAt)}</span>}
    </span>
  );
}

// ─── Tableau ─────────────────────────────────────────────────────────────────

interface TableProps extends RuleActions {
  rules: AutomationRule[];
  sort: RuleSort;
  onSort: (s: RuleSort) => void;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
}

export function RuleTable({ rules, sort, onSort, selected, onSelect, ...a }: TableProps) {
  const allOn = rules.length > 0 && rules.every((r) => selected.has(r.id));
  const someOn = rules.some((r) => selected.has(r.id));

  const Head = ({ children, by, className = "" }: { children: ReactNode; by?: RuleSort; className?: string }) => (
    <th className={`px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide ${className}`} style={{ color: theme.textMuted }}>
      {by ? (
        <button onClick={() => onSort(by)} className="inline-flex items-center gap-1 uppercase hover:underline" style={{ color: sort === by ? theme.text : undefined }}>
          {children}
          {sort === by && (by === "name" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${theme.border}` }}>
      <table className="w-full min-w-[920px] border-collapse text-[13px]">
        <thead style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
          <tr>
            <th className="w-10 px-3 py-2.5">
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn && !allOn;
                }}
                onChange={(e) => onSelect(rules.map((r) => r.id), e.target.checked)}
                aria-label="Tout sélectionner"
                className="h-4 w-4 cursor-pointer accent-[var(--color-gold)]"
              />
            </th>
            <Head className="w-14">Actif</Head>
            <Head by="name">Règle</Head>
            <Head>Déclencheur</Head>
            <Head>Réponse</Head>
            <Head>Envoi</Head>
            <Head by="priority" className="text-center">Prio.</Head>
            <Head by="hits">Utilisation</Head>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => {
            const channel = CHANNEL_META[r.channel];
            const reply = replyText(r);
            const on = selected.has(r.id);
            const menuUp = rules.length > 3 && i >= rules.length - 2;
            return (
              <tr
                key={r.id}
                className="group cursor-pointer transition-colors hover:bg-black/[0.025]"
                style={{ borderTop: `1px solid ${theme.border}`, background: on ? theme.goldSoft : undefined, opacity: r.isActive ? 1 : 0.6 }}
                onClick={() => a.onEdit(r)}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => onSelect([r.id], e.target.checked)}
                    aria-label={`Sélectionner ${r.name}`}
                    className="h-4 w-4 cursor-pointer accent-[var(--color-gold)]"
                  />
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Toggle checked={r.isActive} onChange={() => a.onToggle(r)} label={r.isActive ? "Désactiver" : "Activer"} />
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 truncate font-semibold" style={{ color: theme.text }}>
                    {isUnusable(r) && <AlertTriangle size={13} className="flex-shrink-0" style={{ color: theme.red }} aria-label="Compte inutilisable" />}
                    <span className="truncate">{r.name}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px]" style={{ color: theme.textMuted }}>
                    <channel.icon size={11} className="flex-shrink-0" />
                    <span className="truncate">
                      {r.account ? r.account.name : "Tous les comptes"}
                      {r.postId ? " · 1 publication" : ""}
                    </span>
                  </p>
                </td>
                <td className="max-w-[220px] px-3 py-2.5"><Trigger rule={r} max={3} /></td>
                <td className="max-w-[260px] px-3 py-2.5">
                  {reply === null ? (
                    <span className="inline-flex items-center gap-1 italic" style={{ color: theme.goldDark }}>
                    <Sparkles size={12} /> Rédigée par l'IA{r.aiKnowledge ? " · avec connaissances" : ""}
                  </span>
                  ) : (
                    <span className="line-clamp-2" style={{ color: theme.text }} title={reply}>{reply}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex flex-wrap gap-1">
                    <SendBadge rule={r} />
                    <LangChip rule={r} />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums" style={{ color: r.priority ? theme.text : theme.textMuted }}>{r.priority}</td>
                <td className="px-3 py-2.5 text-[12.5px]"><Usage rule={r} /></td>
                <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <RowMenu up={menuUp} onEdit={() => a.onEdit(r)} onDuplicate={() => a.onDuplicate(r)} onDelete={() => a.onDelete(r)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Grille ──────────────────────────────────────────────────────────────────

export function RuleGrid({ rules, ...a }: RuleActions & { rules: AutomationRule[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rules.map((r) => {
        const channel = CHANNEL_META[r.channel];
        const reply = replyText(r);
        const unusable = isUnusable(r);
        return (
          <article
            key={r.id}
            className="flex flex-col rounded-xl transition-shadow hover:shadow-md"
            style={{ background: theme.bgCard, border: `1px solid ${unusable ? `${theme.red}55` : theme.border}`, opacity: r.isActive ? 1 : 0.6 }}
          >
            <div className="flex items-start gap-2.5 px-3.5 pt-3.5">
              <div className="pt-0.5">
                <Toggle checked={r.isActive} onChange={() => a.onToggle(r)} label={r.isActive ? "Désactiver" : "Activer"} />
              </div>
              <button onClick={() => a.onEdit(r)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[14px] font-semibold" style={{ color: theme.text }}>{r.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <SendBadge rule={r} />
                  {r.useAi && <Chip color={theme.goldDark} bg={theme.goldSoft}><Sparkles size={11} /> IA</Chip>}
                  <LangChip rule={r} />
                </div>
              </button>
              <RowMenu onEdit={() => a.onEdit(r)} onDuplicate={() => a.onDuplicate(r)} onDelete={() => a.onDelete(r)} />
            </div>

            <button onClick={() => a.onEdit(r)} className="flex flex-1 flex-col gap-2 px-3.5 pb-3 pt-2.5 text-left">
              <div>
                <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Si le message…</p>
                <Trigger rule={r} max={4} />
              </div>
              <div className="flex-1 rounded-lg px-2.5 py-2" style={{ background: theme.bg }}>
                <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Répondre</p>
                {reply === null ? (
                  <>
                    <p className="text-[12.5px] italic" style={{ color: theme.goldDark }}>Réponse rédigée par l'IA d'après le contexte du compte</p>
                    {r.aiKnowledge && <p className="mt-1 line-clamp-2 text-[11.5px]" style={{ color: theme.textMuted }}>📚 {r.aiKnowledge}</p>}
                  </>
                ) : (
                  <p className="line-clamp-3 text-[12.5px]" style={{ color: theme.text }}>{reply}</p>
                )}
                {r.privateReply && r.channel !== "DIRECT" && (
                  <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: theme.textMuted }}><Lock size={10} /> + message privé</p>
                )}
              </div>
            </button>

            <div
              className="flex items-center gap-2 border-t px-3.5 py-2 text-[11.5px]"
              style={{ borderColor: theme.border, color: unusable ? theme.red : theme.textMuted }}
            >
              {unusable ? <AlertTriangle size={12} /> : <channel.icon size={12} />}
              <span className="min-w-0 flex-1 truncate">
                {unusable ? `${r.account!.name} inutilisable` : `${channel.label} · ${r.account ? r.account.name : "tous les comptes"}`}
              </span>
              {r.postId && <Image size={12} aria-label="Limitée à une publication" />}
              <span className="flex-shrink-0">{r.hitCount ? `${r.hitCount}×` : "jamais"}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
