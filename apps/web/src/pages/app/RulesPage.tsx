import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { IconTile } from "@/components/ui/Dash";
import { PageCard } from "@/components/ui/PageCard";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Check, Info, List, MessageSquareText, Pause, Play, Plus, Search, Sparkles, Table2, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { ReplyChainButton } from "@/components/automation/ReplyChain";
import { FloatingMenu } from "@/components/ui/FloatingMenu";
import { RuleEditor } from "@/components/automation/RuleEditor";
import { RuleRow } from "@/components/automation/RuleRow";
import { RuleTable, type RuleSort } from "@/components/automation/RuleViews";
import { RuleTester } from "@/components/automation/RuleTester";
import { RuleStatsModal } from "@/components/automation/RuleStatsModal";
import { RULE_PRESETS } from "@/components/automation/rules";
import { AiAssistantView } from "@/components/automation/AiAssistantView";
import { AutomationHealth } from "@/components/automation/AutomationHealth";
import { FilterChips, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import { automationApi, type AutomationRule, type RuleInput } from "@/lib/automation.api";
import { swal } from "@/lib/swal";
import { refreshSidebarCounts } from "@/hooks/useSidebarCounts";

interface Ctx { sub: number; setSub: (i: number) => void }

type EditorState = { rule: AutomationRule | null; preset?: Partial<RuleInput> } | null;

// Une seule rangée de filtres : le canal visé, ou les règles en pause
type Filter = "all" | "COMMENT" | "DIRECT" | "paused";
const FILTERS: Array<{ id: Filter; label: string; test: (r: AutomationRule) => boolean }> = [
  { id: "all", label: "Toutes", test: () => true },
  { id: "COMMENT", label: "Commentaires", test: (r) => r.channel === "ALL" || r.channel === "COMMENT" },
  { id: "DIRECT", label: "Messages privés", test: (r) => r.channel === "ALL" || r.channel === "DIRECT" },
  { id: "paused", label: "En pause", test: (r) => !r.isActive },
];

type View = "list" | "table";

const VIEWS: Array<{ id: View; label: string; icon: LucideIcon; pageSize: number }> = [
  { id: "list", label: "Liste", icon: List, pageSize: 20 },
  { id: "table", label: "Tableau", icon: Table2, pageSize: 30 },
];

// Ordre d'évaluation : celui de l'API (priorité décroissante, puis ancienneté)
const sorters: Record<RuleSort, ((a: AutomationRule, b: AutomationRule) => number) | null> = {
  priority: null,
  hits: (a, b) => b.hitCount - a.hitCount,
  recent: (a, b) => (b.lastTriggeredAt ?? "").localeCompare(a.lastTriggeredAt ?? ""),
  name: (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

const VIEW_KEY = "suiteflow:rulesView";
const readView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "table"; // tableau par défaut (l'ancienne grille y renvoie aussi)
  } catch {
    return "table";
  }
};

// Recherche sans tenir compte des accents ni de la casse
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Trois onglets : mes règles, l'assistant IA, et l'état de chaque compte
const DESCRIPTIONS = [
  "Dites à SuiteFlow quoi répondre : quand un client écrit tel mot, il répond tel message, automatiquement.",
  "L'assistant IA répond aux messages qu'aucune règle ne couvre, à partir des informations de votre activité.",
  "Pour chaque compte, ce qui permet ou empêche les réponses automatiques, et comment le corriger.",
];

export function RulesPage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  // Depuis l'onglet « État des comptes », « Créer une règle » ramène à la liste avec l'éditeur ouvert
  const [pendingCreate, setPendingCreate] = useState<"COMMENT" | "DIRECT" | null>(null);
  // Lien direct (tableau de bord…) : /app/regles?creer=1 ouvre l'éditeur, ?creer=price|delivery|hours|welcome part d'un modèle
  const [params, setParams] = useSearchParams();
  const [deepLink] = useState<string | null>(() => params.get("creer"));
  useEffect(() => {
    if (params.has("creer")) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <PageCard header={<PageHeader bare className="" description={DESCRIPTIONS[sub] ?? DESCRIPTIONS[0]} />}>
      {sub === 1 ? (
        <AiAssistantView />
      ) : sub === 2 ? (
        <AutomationHealth
          onCreateRule={(kind) => {
            setPendingCreate(kind);
            setSub(0);
          }}
          onOpenAi={() => setSub(1)}
        />
      ) : (
        <RulesView onOpenAi={() => setSub(1)} initialCreate={pendingCreate} onCreateConsumed={() => setPendingCreate(null)} deepLink={deepLink} />
      )}
    </PageCard>
  );
}

function RulesView({ onOpenAi, initialCreate, onCreateConsumed, deepLink }: { onOpenAi: () => void; initialCreate: "COMMENT" | "DIRECT" | null; onCreateConsumed: () => void; deepLink: string | null }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setViewState] = useState<View>(readView);
  const [sort, setSort] = useState<RuleSort>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statsRule, setStatsRule] = useState<AutomationRule | null>(null);
  const [testRule, setTestRule] = useState<AutomationRule | null>(null); // règle en cours d'essai
  const [showTips, setShowTips] = useState(false);

  const setView = (v: View) => {
    setViewState(v);
    setSelected(new Set());
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // préférence non mémorisée : sans conséquence
    }
  };

  const loadRules = () =>
    automationApi
      .list()
      .then((list) => {
        setRules(list);
        refreshSidebarCounts(); // le badge « règles actives » de la barre latérale suit
      })
      .catch(() => setRules([]))
      .finally(() => setLoading(false));

  useEffect(() => {
    void loadRules();
    accountApi.list().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const inChannel = rules;
  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)!.test;
    const q = fold(query.trim());
    const list = inChannel.filter(
      (r) => test(r) && (!q || fold(`${r.name} ${r.trigger} ${r.response ?? ""} ${r.accounts.map((a) => a.name).join(" ")}`).includes(q)),
    );
    const by = sorters[sort];
    return by ? [...list].sort(by) : list;
  }, [inChannel, filter, query, sort]);
  const rulesPage = usePagination(visible, VIEWS.find((v) => v.id === view)!.pageSize);

  // Sélection (vue tableau) : limitée aux règles encore visibles
  const selectedRules = visible.filter((r) => selected.has(r.id));
  const select = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const bulk = async (action: "on" | "off" | "delete") => {
    const targets = selectedRules;
    if (!targets.length) return;
    if (action === "delete" && !(await swal.confirm({ title: `Supprimer ${targets.length} règle${targets.length > 1 ? "s" : ""} ?`, text: "Leurs réponses automatiques s'arrêtent immédiatement.", confirmText: "Supprimer", variant: "danger" }))) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      targets.map((r) => (action === "delete" ? automationApi.remove(r.id) : automationApi.update(r.id, { isActive: action === "on" }))),
    );
    const failed = results.filter((x) => x.status === "rejected").length;
    setBulkBusy(false);
    setSelected(new Set());
    await loadRules();
    const done = targets.length - failed;
    const verb = action === "delete" ? "supprimée" : action === "on" ? "activée" : "mise en pause";
    swal.toast({
      variant: failed ? "warning" : "success",
      title: `${done} règle${done > 1 ? "s" : ""} ${verb}${done > 1 ? "s" : ""}`,
      text: failed ? `${failed} n'ont pas pu être modifiées.` : undefined,
    });
  };

  const toggleActive = async (rule: AutomationRule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    try {
      await automationApi.update(rule.id, { isActive: !rule.isActive });
      refreshSidebarCounts();
    } catch (e) {
      swal.toast({ variant: "error", title: "Modification impossible", text: (e as Error).message });
      void loadRules();
    }
  };

  // Envoi automatique ↔ validation avant envoi (sans ouvrir la règle)
  const toggleAuto = async (rule: AutomationRule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, autoSend: !r.autoSend } : r)));
    try {
      await automationApi.update(rule.id, { autoSend: !rule.autoSend });
      swal.toast({ title: !rule.autoSend ? "Réponse automatique activée" : "Vous validez désormais les réponses", text: !rule.autoSend ? "Elle part toute seule." : "Elles vous seront proposées dans « À traiter »." });
    } catch (e) {
      swal.toast({ variant: "error", title: "Modification impossible", text: (e as Error).message });
      void loadRules();
    }
  };

  const remove = async (rule: AutomationRule) => {
    if (!(await swal.confirm({ title: `Supprimer la règle « ${rule.name} » ?`, text: "Les réponses automatiques qu'elle envoyait s'arrêtent immédiatement.", confirmText: "Supprimer", variant: "danger" }))) return;
    await automationApi.remove(rule.id);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    swal.toast({ title: "Règle supprimée" });
  };

  // Copie modifiable (désactivée tant qu'elle n'est pas enregistrée)
  const duplicate = (rule: AutomationRule) =>
    setEditor({
      rule: null,
      preset: {
        name: `${rule.name} (copie)`,
        channel: rule.channel,
        matchType: rule.matchType,
        trigger: rule.trigger,
        response: rule.response,
        useAi: rule.useAi,
        language: rule.language,
        aiKnowledge: rule.aiKnowledge,
        privateReply: rule.privateReply,
        autoSend: rule.autoSend,
        priority: rule.priority,
        accountIds: rule.accountIds,
        postId: rule.postId,
        postLabel: rule.postLabel,
      },
    });

  // Modèle adapté au canal sans réponse, pour tous les comptes
  const createFor = (kind: "COMMENT" | "DIRECT") => {
    const preset = RULE_PRESETS.find((p) => (kind === "DIRECT" ? p.id === "welcome" : p.id === "price"))!;
    setEditor({ rule: null, preset: { ...preset.rule, accountIds: [] } });
  };

  // Éditeur ouvert par un lien : vierge (?creer=1) ou depuis un modèle (?creer=price)
  useEffect(() => {
    if (!deepLink) return;
    const preset = RULE_PRESETS.find((p) => p.id === deepLink);
    setEditor(preset ? { rule: null, preset: { ...preset.rule, accountIds: [] } } : { rule: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialCreate) return;
    createFor(initialCreate);
    onCreateConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCreate]);

  const onSaved = (saved: AutomationRule) => {
    swal.toast({ title: editor?.rule ? "Règle enregistrée" : "Règle créée", text: saved.autoSend ? "Elle répond automatiquement dès maintenant." : "Ses réponses vous seront proposées dans « À traiter »." });
    setEditor(null);
    void loadRules(); // recharge pour l'ordre (priorité) et le compte associé
  };

  const actions = {
    onToggle: toggleActive,
    onToggleAuto: toggleAuto,
    onTest: setTestRule,
    onStats: setStatsRule,
    onEdit: (r: AutomationRule) => setEditor({ rule: r }),
    onDuplicate: duplicate,
    onDelete: remove,
  };

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, inChannel.filter(f.test).length])) as Record<Filter, number>;

  return (
    <div className="flex flex-col gap-5">
      {/* Mes règles : la liste est le cœur de la page ; chaque règle porte ses propres réglages (active, réponse automatique) */}
      <section className="tbl !overflow-visible">
        <div className="hd-line flex flex-wrap items-center gap-3 px-5 pb-3.5 pt-[18px]">
          <IconTile icon={MessageSquareText} tint="#8B5CF6" size="md" />
          <div className="min-w-0 flex-1 basis-48">
            <h3 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>Mes règles de réponse</h3>
            <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>
              Si plusieurs règles correspondent, la première de la liste répond.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReplyChainButton rules={rules} onOpenAi={onOpenAi} onCreateRule={() => setEditor({ rule: null })} onCreateDefault={() => createFor("DIRECT")} onEditRule={(r) => setEditor({ rule: r })} />
            <TemplatesMenu onPick={(preset) => setEditor({ rule: null, preset: { ...preset, accountIds: [] } })} />
            <Button icon={Plus} onClick={() => setEditor({ rule: null })}>Nouvelle règle</Button>
          </div>
        </div>

        {/* Recherche, filtre et affichage : le strict nécessaire */}
        {rules.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3" style={{ borderColor: "var(--line)" }}>
            <label className="field-in flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-xl px-3 sm:max-w-xs">
              <Search size={14} style={{ color: theme.textMuted }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une règle…"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium"
                style={{ color: theme.text, outline: "none", boxShadow: "none" }}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Effacer la recherche">
                  <X size={14} style={{ color: theme.textMuted }} />
                </button>
              )}
            </label>
            <FilterChips items={FILTERS.map((f) => ({ id: f.id, label: f.label, count: f.id === "all" ? undefined : counts[f.id] }))} value={filter} onChange={setFilter} />
            <div className="seg ml-auto" role="radiogroup" aria-label="Affichage">
              {VIEWS.map((v) => (
                <button key={v.id} role="radio" aria-checked={view === v.id} onClick={() => setView(v.id)} title={`Affichage : ${v.label.toLowerCase()}`} aria-label={v.label} className={`seg-b !px-2.5 ${view === v.id ? "on" : ""}`}>
                  <v.icon size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions groupées (vue tableau) */}
        {view === "table" && selectedRules.length > 0 && (
          <div className="animate-fade-in flex flex-wrap items-center gap-2 px-5 py-2" style={{ background: theme.goldSoft, borderBottom: `1px solid ${theme.border}` }}>
            <span className="mr-auto text-[13px] font-semibold" style={{ color: theme.goldDark }}>
              {selectedRules.length} règle{selectedRules.length > 1 ? "s" : ""} sélectionnée{selectedRules.length > 1 ? "s" : ""}
            </span>
            <Button size="sm" variant="ghost" icon={Play} disabled={bulkBusy} onClick={() => void bulk("on")}>Activer</Button>
            <Button size="sm" variant="ghost" icon={Pause} disabled={bulkBusy} onClick={() => void bulk("off")}>Mettre en pause</Button>
            <Button size="sm" variant="danger" icon={Trash2} disabled={bulkBusy} onClick={() => void bulk("delete")}>Supprimer</Button>
            <button onClick={() => setSelected(new Set())} className="rounded p-1 hover:bg-black/5" aria-label="Annuler la sélection">
              <X size={15} style={{ color: theme.goldDark }} />
            </button>
          </div>
        )}

        <div className="p-4 sm:p-5">
          {loading ? (
            <ListSkeleton height={110} count={3} />
          ) : rules.length === 0 ? (
            <FirstRule onPick={(preset) => setEditor({ rule: null, preset })} />
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: theme.textMuted }}>
              Aucune règle ne correspond{query ? ` à « ${query} »` : ""}.{" "}
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="font-semibold underline"
                style={{ color: theme.goldDark }}
              >
                Tout afficher
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {view === "table" ? (
                <RuleTable rules={rulesPage.pageItems} sort={sort} onSort={setSort} selected={selected} onSelect={select} {...actions} />
              ) : (
                rulesPage.pageItems.map((r) => (
                  <RuleRow key={r.id} rule={r} onToggle={() => toggleActive(r)} onToggleAuto={() => toggleAuto(r)} onTest={() => setTestRule(r)} onStats={() => setStatsRule(r)} onEdit={() => setEditor({ rule: r })} onDuplicate={() => duplicate(r)} onDelete={() => remove(r)} />
                ))
              )}
              <Pagination page={rulesPage.page} pageCount={rulesPage.pageCount} onChange={rulesPage.setPage} total={rulesPage.total} pageSize={VIEWS.find((v) => v.id === view)!.pageSize} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-5 py-3 text-[12.5px]" style={{ borderColor: "var(--line)", color: theme.textMuted }}>
          <Info size={14} className="flex-shrink-0" />
          <span>Besoin d'un coup de main pour écrire vos réponses ?</span>
          <button className="lnk" onClick={() => setShowTips(true)}>Voir les astuces</button>
        </div>
      </section>

      {editor && (
        <RuleEditor rule={editor.rule} preset={editor.preset} accounts={accounts} onClose={() => setEditor(null)} onSaved={onSaved} />
      )}
      {statsRule && <RuleStatsModal rule={statsRule} rules={rules} onClose={() => setStatsRule(null)} />}
      {testRule && (
        <Modal title={`Tester « ${testRule.name} »`} subtitle="Écrivez un message client : on vous dit si cette règle répond. Rien n'est publié." onClose={() => setTestRule(null)} footer={<Button icon={X} size="sm" onClick={() => setTestRule(null)}>Fermer</Button>}>
          <RuleTester key={testRule.id} accounts={accounts} rule={testRule} bare />
        </Modal>
      )}
      {showTips && (
        <Modal title="Astuces" subtitle="Pour des règles claires et efficaces." onClose={() => setShowTips(false)} footer={<Button icon={X} size="sm" onClick={() => setShowTips(false)}>Fermer</Button>}>
          <ul className="stagger flex flex-col gap-2">
            {TIPS.map(([t, d]) => (
              <li key={t} className="row-s !items-start">
                <span className="tr-ico ok-solid sm"><Check strokeWidth={3} /></span>
                <span className="text-[13.5px] leading-snug" style={{ color: theme.text }}><b>{t}.</b> <span style={{ color: theme.textMuted }}>{d}</span></span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

// Démarrer d'un modèle sans quitter la liste : un menu des modèles, en malagasy comme en français
function TemplatesMenu({ onPick }: { onPick: (preset: Partial<RuleInput>) => void }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Button variant="ghost" icon={Sparkles} onClick={(e) => setAnchor((a) => (a ? null : e.currentTarget))} aria-haspopup="menu" aria-expanded={Boolean(anchor)}>
        Modèles
      </Button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)} width={300}>
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Partir d'un modèle</p>
          {RULE_PRESETS.map((p) => (
            <button
              key={p.id}
              role="menuitem"
              onClick={() => {
                setAnchor(null);
                onPick(p.rule);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-black/5"
            >
              <span className="ico-tile sm" style={{ "--a": "var(--brand-1)", "--b": "var(--brand-3)", color: theme.onAccent } as CSSProperties}><p.icon size={16} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold" style={{ color: theme.text }}>{p.label}</span>
                <span className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{p.desc}</span>
              </span>
            </button>
          ))}
        </FloatingMenu>
      )}
    </>
  );
}

// Aucune règle : les modèles en grand, pour démarrer en un clic
function FirstRule({ onPick }: { onPick: (preset: Partial<RuleInput>) => void }) {
  return (
    <div className="py-4 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
        <Sparkles size={22} style={{ color: theme.goldDark }} />
      </span>
      <p className="text-[15px] font-semibold" style={{ color: theme.text }}>Créez votre première règle</p>
      <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: theme.textMuted }}>
        Partez d'un modèle, ajustez le texte, puis activez l'envoi automatique quand il vous convient.
      </p>
      <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-3">
        {RULE_PRESETS.filter((p) => p.id !== "custom").map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.rule)}
            className="flex items-start gap-2.5 rounded-xl p-3 transition-colors hover:brightness-[0.98]"
            style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: theme.goldSoft }}>
              <p.icon size={15} style={{ color: theme.goldDark }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold" style={{ color: theme.text }}>{p.label}</span>
              <span className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{p.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TIPS: Array<[string, string]> = [
  ["Variables", "{nom} est remplacé par le prénom de l'auteur, {page} par le nom du compte."],
  ["Variantes", "Séparez plusieurs réponses par || : SuiteFlow en choisit une au hasard, Meta n'y voit pas de spam."],
  ["Validation", "Une règle sans envoi automatique propose sa réponse dans Gestion → À traiter."],
  ["Tester", "Commentez depuis un profil personnel : un commentaire publié en tant que Page est ignoré."],
  ["Lives", "Pendant une session live, les « jp » deviennent des commandes ; les autres commentaires reçoivent ces règles."],
  ["Malagasy", "Les modèles de règles existent en malagasy, et l'assistant IA peut répondre toujours en malagasy (onglet Assistant IA)."],
];
