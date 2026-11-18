import { accountsLabel } from "./rules";
import { X, Zap, UserCheck } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IconTile } from "@/components/ui/Dash";
import { timeAgo } from "@/lib/format";
import type { AutomationRule } from "@/lib/automation.api";
import { CHANNEL_META, isUnusable, ruleKind } from "./RuleRow";

// Statistiques d'une règle : utilisation, priorité et réglages en un coup d'œil
// `rules` est dans l'ordre d'évaluation (priorité décroissante) : la position y est le rang réel de la règle
export function RuleStatsModal({ rule, rules, onClose }: { rule: AutomationRule; rules: AutomationRule[]; onClose: () => void }) {
  const kind = ruleKind(rule);
  const channel = CHANNEL_META[rule.channel];
  const rank = rules.findIndex((r) => r.id === rule.id) + 1;
  const totalHits = rules.reduce((n, r) => n + r.hitCount, 0);
  const share = totalHits > 0 ? Math.round((rule.hitCount / totalHits) * 100) : 0;
  const unusable = isUnusable(rule);

  const rows: Array<[string, string]> = [
    ["Type", kind.label],
    ["Canal", channel.label],
    ["Compte", accountsLabel(rule.accounts)],
    ["Portée", rule.postId ? rule.postLabel ?? "Une publication" : "Toutes les publications"],
    ["Créée le", new Date(rule.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })],
  ];

  return (
    <Modal
      title={`Statistiques · ${rule.name}`}
      subtitle="Utilisation et priorité de cette règle."
      onClose={onClose}
      footer={<Button icon={X} size="sm" onClick={onClose}>Fermer</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <IconTile icon={kind.icon} tint={rule.isActive ? kind.tint : "#94A3B8"} size="md" />
          <span className={`chip ${rule.isActive ? "ok" : "off"}`}>{rule.isActive ? "Active" : "En pause"}</span>
          {rule.autoSend ? (
            <span className="chip ok"><Zap size={11} /> Réponse automatique</span>
          ) : (
            <span className="chip warn"><UserCheck size={11} /> Vous validez avant l'envoi</span>
          )}
          {unusable && <span className="chip bad">Compte inutilisable</span>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Tile value={String(rule.hitCount)} label={rule.hitCount > 1 ? "réponses envoyées" : "réponse envoyée"} />
          <Tile value={rule.lastTriggeredAt ? timeAgo(rule.lastTriggeredAt) : "Jamais"} label="dernière réponse" small />
          <Tile value={String(rule.priority)} label={`priorité · rang ${rank} sur ${rules.length}`} />
        </div>

        {/* Part des réponses de toutes les règles */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold" style={{ color: theme.text }}>Part de toutes les réponses</span>
            <span className="tabular-nums font-bold" style={{ color: theme.text }}>{share} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${share}%`, background: kind.tint }} />
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
            {totalHits > 0 ? `${rule.hitCount} sur ${totalHits} réponses envoyées par l'ensemble de vos règles.` : "Aucune règle n'a encore répondu."}
          </p>
        </div>

        <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl p-3 text-[13px]" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt style={{ color: theme.textMuted }}>{k}</dt>
              <dd className="truncate font-medium" style={{ color: theme.text }}>{v}</dd>
            </div>
          ))}
        </dl>

        <p className="text-[12px] leading-snug" style={{ color: theme.textMuted }}>
          Si plusieurs règles correspondent à un message, celle qui a la priorité la plus haute (rang le plus bas) répond.
        </p>
      </div>
    </Modal>
  );
}

function Tile({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
      <b className={`block font-extrabold leading-tight tabular-nums ${small ? "text-[15px]" : "text-[22px]"}`} style={{ color: theme.text }}>{value}</b>
      <span className="block text-[11px] leading-snug" style={{ color: theme.textMuted }}>{label}</span>
    </div>
  );
}
