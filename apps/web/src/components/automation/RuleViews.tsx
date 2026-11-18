import type { ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { IconTile } from "@/components/ui/Dash";
import type { AutomationRule } from "@/lib/automation.api";
import { CHANNEL_META, Chip, LangChip, RowMenu, isUnusable, ruleKind } from "./RuleRow";
import { accountsLabel, splitKeywords, splitVariants } from "./rules";

export type RuleSort = "priority" | "name" | "hits" | "recent" | "created";

export interface RuleActions {
  onToggle: (r: AutomationRule) => void;
  onToggleAuto: (r: AutomationRule) => void;
  onTest: (r: AutomationRule) => void;
  onStats: (r: AutomationRule) => void;
  onEdit: (r: AutomationRule) => void;
  onDuplicate: (r: AutomationRule) => void;
  onDelete: (r: AutomationRule) => void;
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
    <>
    {/* Petits écrans : une carte par règle, sans défilement horizontal */}
    <div className="flex flex-col gap-2.5 lg:hidden">
      <label className="flex cursor-pointer items-center gap-2 px-1 text-[12.5px] font-medium" style={{ color: theme.textMuted }}>
        <input
          type="checkbox"
          checked={allOn}
          ref={(el) => {
            if (el) el.indeterminate = someOn && !allOn;
          }}
          onChange={(e) => onSelect(rules.map((r) => r.id), e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--color-gold)]"
        />
        Tout sélectionner
      </label>
      {rules.map((r) => (
        <RuleCard key={r.id} rule={r} selected={selected.has(r.id)} onSelect={(on) => onSelect([r.id], on)} {...a} />
      ))}
    </div>

    <div className="hidden overflow-x-auto rounded-xl lg:block" style={{ border: `1px solid ${theme.border}` }}>
      <table className="w-full min-w-[700px] border-collapse text-[13px] xl:min-w-[900px]">
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
            <Head by="name">Règle</Head>
            <Head>Déclencheur</Head>
            <Head className="hidden w-44 xl:table-cell">Réponse</Head>
            <Head>Réponse auto</Head>
            <th className="w-28" />
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => {
            const channel = CHANNEL_META[r.channel];
            const reply = replyText(r);
            const on = selected.has(r.id);
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
                <td className="max-w-[300px] px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <IconTile icon={ruleKind(r).icon} tint={r.isActive ? ruleKind(r).tint : "#94A3B8"} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold" style={{ color: theme.text }}>
                        {isUnusable(r) && <AlertTriangle size={13} className="flex-shrink-0" style={{ color: theme.red }} aria-label="Compte inutilisable" />}
                        <span className="truncate">{r.name}</span>
                        <span className={`chip ${r.isActive ? "ok" : "off"} flex-shrink-0 !text-[10px]`}>{r.isActive ? "Active" : "En pause"}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px]" style={{ color: theme.textMuted }}>
                        <channel.icon size={11} className="flex-shrink-0" />
                        <span className="truncate">
                          {ruleKind(r).label} · {accountsLabel(r.accounts)}
                          {r.postId ? " · 1 publication" : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[220px] px-3 py-2.5"><Trigger rule={r} max={3} /></td>
                <td className="hidden w-44 max-w-[11rem] px-3 py-2.5 text-[12.5px] xl:table-cell">
                  {reply === null ? (
                    <span className="flex items-center gap-1 truncate italic" style={{ color: theme.goldDark }} title={r.aiKnowledge ? "Rédigée par l'IA, avec connaissances" : "Rédigée par l'IA"}>
                      <Sparkles size={12} className="flex-shrink-0" /> <span className="truncate">Rédigée par l'IA</span>
                    </span>
                  ) : (
                    <span className="block truncate" style={{ color: theme.text }} title={reply}>{reply}</span>
                  )}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <span className="flex flex-col items-start gap-1">
                    <Toggle checked={r.autoSend} onChange={() => a.onToggleAuto(r)} label={r.autoSend ? "Passer en validation avant envoi" : "Activer la réponse automatique"} />
                    <span className="text-[11px] font-semibold" style={{ color: r.autoSend ? theme.green : theme.amber }}>{r.autoSend ? "Automatique" : "À valider"}</span>
                    <LangChip rule={r} />
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <span className="flex items-center justify-end gap-0.5">
                    <RowMenu active={r.isActive} onToggle={() => a.onToggle(r)} onEdit={() => a.onEdit(r)} onTest={() => a.onTest(r)} onStats={() => a.onStats(r)} onDuplicate={() => a.onDuplicate(r)} onDelete={() => a.onDelete(r)} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

// Carte compacte d'une règle (écrans étroits) : mêmes informations et mêmes actions que la ligne du tableau
function RuleCard({ rule: r, selected, onSelect, ...a }: RuleActions & { rule: AutomationRule; selected: boolean; onSelect: (on: boolean) => void }) {
  const kind = ruleKind(r);
  const channel = CHANNEL_META[r.channel];
  const reply = replyText(r);
  return (
    <article className="row-s !flex-col !items-stretch !gap-0 !overflow-hidden !p-0" style={{ background: selected ? theme.goldSoft : undefined, ...(isUnusable(r) ? { boxShadow: "inset 0 0 0 1.5px rgba(225,29,72,0.4)" } : {}) }}>
      <div className="flex items-start gap-2.5 p-3" style={{ opacity: r.isActive ? 1 : 0.62 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Sélectionner ${r.name}`}
          className="mt-2.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-[var(--color-gold)]"
        />
        <IconTile icon={kind.icon} tint={r.isActive ? kind.tint : "#94A3B8"} size="sm" />
        <button onClick={() => a.onEdit(r)} className="min-w-0 flex-1 text-left">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold" style={{ color: theme.text }}>
            {isUnusable(r) && <AlertTriangle size={13} className="flex-shrink-0" style={{ color: theme.red }} aria-label="Compte inutilisable" />}
            <span className="min-w-0 break-words text-[14px]">{r.name}</span>
            <span className={`chip ${r.isActive ? "ok" : "off"} flex-shrink-0 !text-[10px]`}>{r.isActive ? "Active" : "En pause"}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: theme.textMuted }}>
            <channel.icon size={11} className="flex-shrink-0" />
            <span className="truncate">{kind.label} · {accountsLabel(r.accounts)}{r.postId ? " · 1 publication" : ""}</span>
          </p>
          <div className="mt-2"><Trigger rule={r} max={4} /></div>
          <p className="mt-1.5 line-clamp-2 text-[12.5px]" style={{ color: reply === null ? theme.goldDark : theme.text }}>
            {reply === null ? <em className="inline-flex items-center gap-1"><Sparkles size={12} /> Réponse rédigée par l'IA</em> : reply}
          </p>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: theme.text }}>
          <Toggle checked={r.autoSend} onChange={() => a.onToggleAuto(r)} label={r.autoSend ? "Passer en validation avant envoi" : "Activer la réponse automatique"} />
          <span className="select-none">{r.autoSend ? "Réponse automatique" : "À valider"}</span>
        </label>
        <div className="ml-auto">
          <RowMenu active={r.isActive} onToggle={() => a.onToggle(r)} onEdit={() => a.onEdit(r)} onTest={() => a.onTest(r)} onStats={() => a.onStats(r)} onDuplicate={() => a.onDuplicate(r)} onDelete={() => a.onDelete(r)} />
        </div>
      </div>
    </article>
  );
}
