import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowUpDown, ChevronDown, Info, LayoutGrid, List, Pause, Play, Plus, Search, Sparkles, Table2, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationHero } from "@/components/automation/AutomationHero";
import { RuleEditor } from "@/components/automation/RuleEditor";
import { RuleRow } from "@/components/automation/RuleRow";
import { RuleGrid, RuleTable, type RuleSort } from "@/components/automation/RuleViews";
import { RuleTester } from "@/components/automation/RuleTester";
import { RULE_PRESETS } from "@/components/automation/rules";
import { AiAssistantView } from "@/components/automation/AiAssistantView";
import { AutomationHealth } from "@/components/automation/AutomationHealth";
import { ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import { automationApi, type AutomationRule, type RuleChannel, type RuleInput } from "@/lib/automation.api";
import { swal } from "@/lib/swal";

interface Ctx { sub: number; setSub: (i: number) => void }

// Sous-menus : toutes les règles, celles des commentaires, des messages privés, puis l'assistant IA
const SUB_CHANNEL: Array<Exclude<RuleChannel, "ALL"> | null> = [null, "COMMENT", "DIRECT"];
const AI_SUB = 3;

type EditorState = { rule: AutomationRule | null; preset?: Partial<RuleInput> } | null;
type Filter = "all" | "active" | "paused" | "auto" | "ai";

const FILTERS: Array<{ id: Filter; label: string; test: (r: AutomationRule) => boolean }> = [
  { id: "all", label: "Toutes", test: () => true },
  { id: "active", label: "Actives", test: (r) => r.isActive },
  { id: "paused", label: "En pause", test: (r) => !r.isActive },
  { id: "auto", label: "Envoi auto", test: (r) => r.autoSend },
  { id: "ai", label: "Par IA", test: (r) => r.useAi },
];

type View = "list" | "table" | "grid";

const VIEWS: Array<{ id: View; label: string; icon: LucideIcon; pageSize: number }> = [
  { id: "list", label: "Liste", icon: List, pageSize: 20 },
  { id: "table", label: "Tableau", icon: Table2, pageSize: 30 },
  { id: "grid", label: "Grille", icon: LayoutGrid, pageSize: 24 },
];

const SORTS: Array<{ id: RuleSort; label: string }> = [
  { id: "priority", label: "Ordre d'évaluation" },
  { id: "hits", label: "Plus utilisées" },
  { id: "recent", label: "Déclenchées récemment" },
  { id: "name", label: "Nom (A → Z)" },
  { id: "created", label: "Plus récentes" },
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
    return v === "table" || v === "grid" ? v : "list";
  } catch {
    return "list";
  }
};

// Recherche sans tenir compte des accents ni de la casse
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AutomationPage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  return (
    <>
      <PageHeader
        description={
          sub === AI_SUB
            ? "L'assistant IA répond aux messages qu'aucune règle ne couvre, à partir des informations de votre activité, dans la langue de votre choix."
            : "Vos règles de réponse et l'assistant IA répondent à vos clients en commentaire comme en message privé, 24h/24."
        }
      />
      {sub === AI_SUB ? <AiAssistantView /> : <RulesView channel={SUB_CHANNEL[sub] ?? null} onOpenAi={() => setSub(AI_SUB)} />}
    </>
  );
}

function RulesView({ channel, onOpenAi }: { channel: Exclude<RuleChannel, "ALL"> | null; onOpenAi: () => void }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>(null);
  const [revision, setRevision] = useState(0); // règles modifiées : le diagnostic est relancé
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setViewState] = useState<View>(readView);
  const [sort, setSort] = useState<RuleSort>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
        setRevision((n) => n + 1);
      })
      .catch(() => setRules([]))
      .finally(() => setLoading(false));

  useEffect(() => {
    void loadRules();
    accountApi.list().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const inChannel = useMemo(
    () => (channel ? rules.filter((r) => r.channel === "ALL" || r.channel === channel) : rules),
    [rules, channel],
  );
  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)!.test;
    const q = fold(query.trim());
    const list = inChannel.filter(
      (r) => test(r) && (!q || fold(`${r.name} ${r.trigger} ${r.response ?? ""} ${r.account?.name ?? ""}`).includes(q)),
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
      setRevision((n) => n + 1);
    } catch (e) {
      swal.toast({ variant: "error", title: "Modification impossible", text: (e as Error).message });
      void loadRules();
    }
  };

  const remove = async (rule: AutomationRule) => {
    if (!(await swal.confirm({ title: `Supprimer la règle « ${rule.name} » ?`, text: "Les réponses automatiques qu'elle envoyait s'arrêtent immédiatement.", confirmText: "Supprimer", variant: "danger" }))) return;
    await automationApi.remove(rule.id);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    setRevision((n) => n + 1);
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
        accountId: rule.accountId,
        postId: rule.postId,
        postLabel: rule.postLabel,
      },
    });

  // Modèle adapté au canal sans réponse, pour tous les comptes
  const createFor = (kind: "COMMENT" | "DIRECT") => {
    const preset = RULE_PRESETS.find((p) => (kind === "DIRECT" ? p.id === "welcome" : p.id === "price"))!;
    setEditor({ rule: null, preset: { ...preset.rule, accountId: null } });
  };

  const onSaved = (saved: AutomationRule) => {
    swal.toast({ title: editor?.rule ? "Règle enregistrée" : "Règle créée", text: saved.autoSend ? "Elle répond automatiquement dès maintenant." : "Ses réponses vous seront proposées dans « À traiter »." });
    setEditor(null);
    void loadRules(); // recharge pour l'ordre (priorité) et le compte associé
  };

  const actions = {
    onToggle: toggleActive,
    onEdit: (r: AutomationRule) => setEditor({ rule: r }),
    onDuplicate: duplicate,
    onDelete: remove,
  };

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, inChannel.filter(f.test).length])) as Record<Filter, number>;

  return (
    <div className="flex flex-col gap-5">
      <AutomationHero rules={rules} onSynced={loadRules} onOpenAi={onOpenAi} onCreateDefault={() => createFor("DIRECT")} />

      {/* Vue liste : aide sur le côté ; tableau et grille : pleine largeur, aide en dessous */}
      <div className={`grid grid-cols-1 items-start gap-5 ${view === "list" ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        {/* Règles */}
        <section className="rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <Title className="text-base">Règles de réponse</Title>
              <p className="text-[12px]" style={{ color: theme.textMuted }}>
                La règle de plus haute priorité dont les mots-clés correspondent répond en premier.
              </p>
            </div>
            <Button icon={Plus} onClick={() => setEditor({ rule: null })}>Nouvelle règle</Button>
          </div>

          {/* Recherche, tri, affichage et filtres */}
          {rules.length > 0 && (
            <div className="flex flex-col gap-2 border-y px-5 py-2.5" style={{ borderColor: theme.border, background: theme.bg }}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                  <Search size={14} style={{ color: theme.textMuted }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher une règle ou un mot-clé…"
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                    style={{ color: theme.text }}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} aria-label="Effacer la recherche">
                      <X size={14} style={{ color: theme.textMuted }} />
                    </button>
                  )}
                </label>
                <label className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                  <ArrowUpDown size={14} style={{ color: theme.textMuted }} />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as RuleSort)}
                    className="cursor-pointer bg-transparent text-[13px] outline-none"
                    style={{ color: theme.text }}
                    aria-label="Trier les règles"
                  >
                    {SORTS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <div className="flex rounded-lg p-0.5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }} role="radiogroup" aria-label="Affichage">
                  {VIEWS.map((v) => {
                    const on = view === v.id;
                    return (
                      <button
                        key={v.id}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setView(v.id)}
                        title={v.label}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors"
                        style={{ background: on ? theme.goldSoft : "transparent", color: on ? theme.goldDark : theme.textMuted }}
                      >
                        <v.icon size={14} />
                        <span className="hidden md:inline">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => {
                  const on = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors"
                      style={{ background: on ? theme.bgDark : theme.bgCard, color: on ? "#fff" : theme.text, border: `1px solid ${on ? theme.bgDark : theme.border}` }}
                      aria-pressed={on}
                    >
                      {f.label}
                      <span className="rounded px-1 text-[11px] tabular-nums" style={{ background: on ? "#ffffff26" : theme.bg, color: on ? "#fff" : theme.textMuted }}>
                        {counts[f.id]}
                      </span>
                    </button>
                  );
                })}
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
                ) : view === "grid" ? (
                  <RuleGrid rules={rulesPage.pageItems} {...actions} />
                ) : (
                  rulesPage.pageItems.map((r) => (
                    <RuleRow
                      key={r.id}
                      rule={r}
                      onToggle={() => toggleActive(r)}
                      onEdit={() => setEditor({ rule: r })}
                      onDuplicate={() => duplicate(r)}
                      onDelete={() => remove(r)}
                    />
                  ))
                )}
                <Pagination
                  page={rulesPage.page}
                  pageCount={rulesPage.pageCount}
                  onChange={rulesPage.setPage}
                  total={rulesPage.total}
                  pageSize={VIEWS.find((v) => v.id === view)!.pageSize}
                />
              </div>
            )}
          </div>
        </section>

        {/* Colonne d'aide */}
        <aside className={view === "list" ? "flex flex-col gap-5" : "grid grid-cols-1 items-start gap-5 lg:grid-cols-2"}>
          <RuleTester accounts={accounts} />
          <Tips />
        </aside>
      </div>

      <AutomationHealth onCreateRule={createFor} onOpenAi={onOpenAi} refreshKey={revision} />

      {editor && (
        <RuleEditor rule={editor.rule} preset={editor.preset} accounts={accounts} onClose={() => setEditor(null)} onSaved={onSaved} />
      )}
    </div>
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

function Tips() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-5 py-4 text-left" aria-expanded={open}>
        <Info size={16} style={{ color: theme.gold }} />
        <span className="flex-1 text-[15px] font-semibold" style={{ color: theme.text }}>Bon à savoir</span>
        <ChevronDown size={16} className="transition-transform" style={{ color: theme.textMuted, transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <ul className="flex flex-col gap-2.5 px-5 pb-5 text-[12.5px] leading-relaxed" style={{ color: theme.textMuted }}>
          {TIPS.map(([t, d]) => (
            <li key={t}>
              <strong style={{ color: theme.text }}>{t}.</strong> {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
