import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Sparkles, Info } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { AssistantCard } from "@/components/automation/AssistantCard";
import { RuleEditor } from "@/components/automation/RuleEditor";
import { RuleRow } from "@/components/automation/RuleRow";
import { RuleTester } from "@/components/automation/RuleTester";
import { RULE_PRESETS } from "@/components/automation/rules";
import { AiAssistantView } from "@/components/automation/AiAssistantView";
import { AutomationHealth } from "@/components/automation/AutomationHealth";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import { automationApi, type AutomationRule, type RuleChannel, type RuleInput } from "@/lib/automation.api";

interface Ctx { sub: number; setSub: (i: number) => void }

// Sous-menus : toutes les règles, celles des commentaires, des messages privés, puis l'assistant IA
const SUB_CHANNEL: Array<Exclude<RuleChannel, "ALL"> | null> = [null, "COMMENT", "DIRECT"];
const AI_SUB = 3;

type EditorState = { rule: AutomationRule | null; preset?: Partial<RuleInput> } | null;

export function AutomationPage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  return sub === AI_SUB ? <AiAssistantView /> : <RulesView channel={SUB_CHANNEL[sub] ?? null} onOpenAi={() => setSub(AI_SUB)} />;
}

function RulesView({ channel, onOpenAi }: { channel: Exclude<RuleChannel, "ALL"> | null; onOpenAi: () => void }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>(null);
  const [revision, setRevision] = useState(0); // règles modifiées : le diagnostic est relancé

  const loadRules = () =>
    automationApi
      .list()
      .then((list) => {
        setRules(list);
        setRevision((n) => n + 1);
      })
      .catch(() => setRules([]))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadRules();
    accountApi.list().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const visible = useMemo(
    () => (channel ? rules.filter((r) => r.channel === "ALL" || r.channel === channel) : rules),
    [rules, channel]
  );
  const rulesPage = usePagination(visible, 20);

  const toggleActive = async (rule: AutomationRule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    try {
      await automationApi.update(rule.id, { isActive: !rule.isActive });
      setRevision((n) => n + 1);
    } catch {
      loadRules();
    }
  };

  const remove = async (rule: AutomationRule) => {
    if (!window.confirm(`Supprimer la règle « ${rule.name} » ?`)) return;
    await automationApi.remove(rule.id);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    setRevision((n) => n + 1);
  };

  // Modèle adapté au canal sans réponse, pour tous les comptes
  const createFor = (kind: "COMMENT" | "DIRECT") => {
    const preset = RULE_PRESETS.find((p) => (kind === "DIRECT" ? p.rule.channel === "DIRECT" : p.rule.channel === "COMMENT"))!;
    setEditor({ rule: null, preset: { ...preset.rule, accountId: null } });
  };

  const onSaved = () => {
    setEditor(null);
    loadRules(); // recharge pour l'ordre (priorité) et le compte associé
  };

  return (
    <div className="flex flex-col gap-5">
      <AutomationHealth onCreateRule={createFor} onOpenAi={onOpenAi} refreshKey={revision} />
      <AssistantCard onSynced={loadRules} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <Title className="text-base">Règles de Réponse</Title>
              <p className="mt-0.5 text-[11px]" style={{ color: theme.textMuted }}>
                Ordre : règles à mots-clés (par priorité), puis l'assistant IA s'il est activé, puis les réponses
                « tout message ».
              </p>
            </div>
            <Button size="sm" icon={Plus} onClick={() => setEditor({ rule: null })}>Nouvelle règle</Button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: theme.bg }} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center" style={{ background: theme.bg }}>
              <Sparkles size={22} className="mx-auto mb-2" style={{ color: theme.gold }} />
              <p className="text-sm font-medium" style={{ color: theme.text }}>
                {rules.length === 0 ? "Aucune règle pour l'instant" : "Aucune règle pour ce canal"}
              </p>
              <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>
                Partez d'un modèle, ajustez le texte, puis activez l'envoi automatique quand il vous convient.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {RULE_PRESETS.map((p) => (
                  <Button key={p.label} size="sm" variant="soft" onClick={() => setEditor({ rule: null, preset: p.rule })}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rulesPage.pageItems.map((r) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  onToggle={() => toggleActive(r)}
                  onEdit={() => setEditor({ rule: r })}
                  onDelete={() => remove(r)}
                />
              ))}
              <Pagination page={rulesPage.page} pageCount={rulesPage.pageCount} onChange={rulesPage.setPage} total={rulesPage.total} pageSize={20} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <RuleTester accounts={accounts} />

          <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <div className="mb-3 flex items-center gap-2">
              <Info size={16} style={{ color: theme.gold }} />
              <Title className="text-base">Bon à Savoir</Title>
            </div>
            <ul className="flex flex-col gap-2 text-xs leading-relaxed" style={{ color: theme.textMuted }}>
              <li><strong style={{ color: theme.text }}>{"{nom}"}</strong> est remplacé par le prénom de l'auteur, <strong style={{ color: theme.text }}>{"{page}"}</strong> par le nom du compte.</li>
              <li>Plusieurs variantes séparées par <strong style={{ color: theme.text }}>||</strong> évitent les réponses identiques, que Meta peut considérer comme du spam.</li>
              <li>Les messages sans règle, ou en attente de validation, arrivent dans <strong style={{ color: theme.text }}>Gestion → À traiter</strong>.</li>
              <li>ReplyKA ne répond jamais à ses propres réponses ni aux messages antérieurs à l'activation.</li>
              <li><strong style={{ color: theme.text }}>Pour tester</strong>, commentez depuis un profil personnel : un commentaire publié <em>en tant que Page</em> est ignoré.</li>
              <li>Une règle « <strong style={{ color: theme.text }}>Réponse par IA</strong> » génère la réponse à la volée, à partir du contexte défini dans Assistant IA. Choisissez une publication précise pour la limiter à ce post, ou laissez « Toutes les publications » pour tout le compte.</li>
              <li>Pendant une session live, les « jp » deviennent des commandes et les autres commentaires (prix, questions…) reçoivent ces réponses automatiques.</li>
            </ul>
          </div>
        </div>
      </div>

      {editor && (
        <RuleEditor
          rule={editor.rule}
          preset={editor.preset}
          accounts={accounts}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
