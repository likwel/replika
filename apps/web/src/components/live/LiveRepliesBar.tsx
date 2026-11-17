import { useState } from "react";
import { Bot, MessageCircleReply, Plus, Settings2 } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { RuleEditor } from "@/components/automation/RuleEditor";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import type { AutomationRule } from "@/lib/automation.api";
import { liveApi, type LiveSession } from "@/lib/live.api";
import { swal } from "@/lib/swal";

interface Props {
  session: LiveSession;
  onChanged: (s: LiveSession) => void;
  onOpenSettings: () => void;
}

// Au-dessus des commentaires du live : ce qui répond aux commentaires qui ne sont pas des JP, et un accès direct pour
// ajouter une règle (réponse par IA ou texte à valider, commentaires ou messages), utilisée tout de suite par ce live
export function LiveRepliesBar({ session: s, onChanged, onOpenSettings }: Props) {
  const [creating, setCreating] = useState(false);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);

  const summary =
    s.replyMode === "NONE"
      ? "Aucune réponse aux autres commentaires : ils restent dans « À traiter »."
      : s.replyMode === "SELECTED"
        ? `${s.replyRuleIds.length} règle${s.replyRuleIds.length > 1 ? "s" : ""} jointe${s.replyRuleIds.length > 1 ? "s" : ""} à ce live${s.replyUseAi ? ", plus l'assistant IA" : ""}.`
        : "Toutes vos règles actives répondent aux commentaires qui ne sont pas des JP.";

  const open = () => {
    accountApi.list().then(setAccounts).catch(() => undefined);
    setCreating(true);
  };

  // La règle créée répond déjà en mode « toutes mes règles » ; sinon elle est jointe au live (et enregistrée tout de suite)
  const created = async (rule: AutomationRule) => {
    setCreating(false);
    try {
      if (s.replyMode === "ALL") {
        swal.toast({ title: "Règle créée", text: "Elle répondra aux commentaires de ce live." });
        return;
      }
      const updated = await liveApi.updateSession(s.id, { replyMode: "SELECTED", replyRuleIds: [...s.replyRuleIds, rule.id] });
      onChanged(updated);
      swal.toast({ title: "Règle créée et jointe à ce live" });
    } catch {
      swal.toast({ variant: "error", title: "Règle créée, mais non jointe", text: "Ajoutez-la dans les réglages du live." });
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl p-3" style={{ background: theme.goldSoft }}>
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl" style={{ background: theme.bgCard, color: theme.goldDark }}><MessageCircleReply size={17} /></span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: theme.text }}><Bot size={14} style={{ color: theme.goldDark }} /> Réponses aux autres commentaires</p>
        <p className="text-xs" style={{ color: theme.textMuted }}>{summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={Settings2} onClick={onOpenSettings}>Régler</Button>
        <Button size="sm" icon={Plus} onClick={open}>Nouvelle règle</Button>
      </div>
      {creating && <RuleEditor rule={null} accounts={accounts} defaultAccountId={s.account.id} defaultChannel="COMMENT" onClose={() => setCreating(false)} onSaved={(r) => void created(r)} />}
    </div>
  );
}
