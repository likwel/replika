import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, Check, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2, Workflow, X, Zap } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { PageCard } from "@/components/ui/PageCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { FloatingMenu, MenuItem } from "@/components/ui/FloatingMenu";
import { IconTile } from "@/components/ui/Dash";
import { EmptyState, FilterChips, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { PipelineEditor } from "@/components/pipelines/PipelineEditor";
import { PipelineFlow } from "@/components/pipelines/PipelineFlow";
import { TEMPLATES, stepMeta, triggerOf } from "@/components/pipelines/meta";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import { automationApi, type AutomationRule } from "@/lib/automation.api";
import { pipelineApi, type Pipeline, type PipelineInput, type PipelineRun } from "@/lib/pipeline.api";
import { plural, timeAgo } from "@/lib/format";
import { swal } from "@/lib/swal";
import { refreshSidebarCounts } from "@/hooks/useSidebarCounts";

interface Ctx { sub: number }

type Filter = "all" | "active" | "paused";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actifs" },
  { id: "paused", label: "En pause" },
];

type EditorState = { pipeline: Pipeline | null; preset?: Partial<PipelineInput> } | null;

// Automatisation = des pipelines : un déclencheur, puis des étapes (conditions sur les règles, actions) exécutées dans l'ordre
export function PipelinesPage() {
  const { sub } = useOutletContext<Ctx>();
  return (
    <PageCard
      header={
        <PageHeader
          bare
          className=""
          description={
            sub === 1
              ? "Ce que vos pipelines ont fait : pour chaque exécution, le résultat de chaque étape."
              : "Enchaînez des étapes automatiquement quand un événement se produit : une règle correspond, un lead devient chaud…"
          }
        />
      }
    >
      {sub === 1 ? <RunsView /> : <PipelinesView />}
    </PageCard>
  );
}

function PipelinesView() {
  const [items, setItems] = useState<Pipeline[] | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [paused, setPaused] = useState(false); // interrupteur général des réponses automatiques
  const [editor, setEditor] = useState<EditorState>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = () => pipelineApi.list().then((l) => { setItems(l); refreshSidebarCounts(); }).catch(() => setItems([]));
  useEffect(() => {
    void load();
    automationApi.list().then(setRules).catch(() => setRules([]));
    accountApi.list().then(setAccounts).catch(() => setAccounts([]));
    automationApi.settings().then((s) => setPaused(!s.autoReplyEnabled)).catch(() => undefined);
  }, []);

  const counts = { all: items?.length ?? 0, active: items?.filter((p) => p.isActive).length ?? 0, paused: items?.filter((p) => !p.isActive).length ?? 0 };
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((p) => (filter === "all" || (filter === "active" ? p.isActive : !p.isActive)) && (!q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q)));
  }, [items, filter, query]);

  const toggle = async (p: Pipeline) => {
    setItems((l) => l?.map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x)) ?? null);
    try {
      await pipelineApi.update(p.id, { isActive: !p.isActive });
      refreshSidebarCounts();
      swal.toast({ title: p.isActive ? "Pipeline mis en pause" : "Pipeline activé", variant: p.isActive ? "info" : "success" });
    } catch (e) {
      swal.toast({ variant: "error", title: "Modification impossible", text: (e as Error).message });
      void load();
    }
  };

  const remove = async (p: Pipeline) => {
    if (!(await swal.confirm({ title: `Supprimer « ${p.name} » ?`, text: "Il s'arrête immédiatement et son historique d'exécutions est supprimé.", confirmText: "Supprimer", variant: "warning" }))) return;
    await pipelineApi.remove(p.id);
    setItems((l) => l?.filter((x) => x.id !== p.id) ?? null);
    swal.toast({ title: "Pipeline supprimé" });
  };

  const duplicate = (p: Pipeline) =>
    setEditor({ pipeline: null, preset: { name: `${p.name} (copie)`, description: p.description, trigger: p.trigger, accountId: p.accountId, steps: p.steps.map((s) => ({ ...s, id: Math.random().toString(36).slice(2, 10) })) } });

  const saved = (p: Pipeline) => {
    const isNew = !editor?.pipeline;
    setEditor(null);
    setItems((l) => (l?.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [p, ...(l ?? [])]));
    swal.toast({ title: isNew ? "Pipeline créé" : "Pipeline enregistré", text: isNew && !p.isActive ? "Il est en pause : activez-le quand vous l'avez relu." : undefined });
  };

  return (
    <>
      {paused && (
        <p className="row-s !items-start" style={{ background: "var(--color-amberSoft)" }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: theme.amber }} />
          <span className="text-[13px] leading-snug" style={{ color: theme.text }}>
            Les réponses automatiques sont en pause : <b>les pipelines aussi</b>. Réactivez-les depuis la page Règles pour que les pipelines actifs s'exécutent.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(items?.length ?? 0) > 0 && (
          <>
            <label className="field-in flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3 sm:max-w-xs">
              <Search size={14} style={{ color: theme.textMuted }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un pipeline…" className="min-w-0 flex-1 bg-transparent text-[13px] font-medium" style={{ color: theme.text, outline: "none", boxShadow: "none" }} />
              {query && <button onClick={() => setQuery("")} aria-label="Effacer"><X size={14} style={{ color: theme.textMuted }} /></button>}
            </label>
            <FilterChips items={FILTERS.map((f) => ({ ...f, count: f.id === "all" ? undefined : counts[f.id] }))} value={filter} onChange={setFilter} />
          </>
        )}
        <Button icon={Plus} className="ml-auto" onClick={() => setEditor({ pipeline: null })}>Nouveau pipeline</Button>
      </div>

      {items === null ? (
        <ListSkeleton height={118} count={2} />
      ) : items.length === 0 ? (
        <div className="flex flex-col gap-4 py-2">
          <EmptyState bare icon={Workflow} title="Aucun pipeline pour l'instant">
            Un pipeline fait gagner du temps : à chaque événement, il enchaîne ses étapes sans que vous interveniez.
          </EmptyState>
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Partir d'un modèle</p>
            <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => setEditor({ pipeline: null, preset: { name: t.name, description: t.description, trigger: t.trigger, steps: t.steps() } })} className="row-s !flex-col !items-stretch !gap-3 !p-4 text-left">
                  <PipelineFlow pipeline={{ trigger: t.trigger, steps: t.steps() }} />
                  <span>
                    <b className="block text-[14px] font-bold" style={{ color: theme.text }}>{t.name}</b>
                    <small className="block text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{t.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: theme.textMuted }}>
          Aucun pipeline ne correspond.{" "}
          <button className="font-semibold underline" style={{ color: theme.goldDark }} onClick={() => { setQuery(""); setFilter("all"); }}>Tout afficher</button>
        </p>
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {visible.map((p) => (
            <PipelineCard key={p.id} p={p} onToggle={() => void toggle(p)} onEdit={() => setEditor({ pipeline: p })} onDuplicate={() => duplicate(p)} onDelete={() => void remove(p)} />
          ))}
        </ul>
      )}

      {editor && <PipelineEditor pipeline={editor.pipeline} preset={editor.preset} rules={rules} accounts={accounts} onClose={() => setEditor(null)} onSaved={saved} />}
    </>
  );
}

function PipelineCard({ p, onToggle, onEdit, onDuplicate, onDelete }: { p: Pipeline; onToggle: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const t = triggerOf(p.trigger);
  const act = (fn: () => void) => () => {
    setAnchor(null);
    fn();
  };
  return (
    <li className="row-s !items-start !gap-3.5 !p-4" style={{ opacity: p.isActive ? 1 : 0.75 }}>
      <div className="pt-0.5"><Toggle checked={p.isActive} onChange={onToggle} label={p.isActive ? "Mettre en pause" : "Activer"} /></div>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left" title="Modifier le pipeline">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-[15px] font-bold tracking-[-0.01em]" style={{ color: theme.text }}>{p.name}</b>
          <span className={`chip ${p.isActive ? "ok" : "off"}`}>{p.isActive ? "Actif" : "En pause"}</span>
        </div>
        {p.description && <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{p.description}</p>}
        <div className="mt-2.5"><PipelineFlow pipeline={p} /></div>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: theme.textMuted }}>
          <span>{t.label}</span>
          <span>· {p.account ? p.account.name : "Tous les comptes"}</span>
          <span>· {plural(p.steps.length, "étape")}</span>
          <span className="ml-auto">
            {p.runCount > 0 ? `${plural(p.runCount, "exécution")}${p.lastRunAt ? ` · ${timeAgo(p.lastRunAt)}` : ""}` : "Jamais exécuté"}
          </span>
        </p>
      </button>
      <button onClick={(e) => { const el = e.currentTarget; setAnchor((c) => (c ? null : el)); }} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Actions du pipeline" aria-haspopup="menu" aria-expanded={Boolean(anchor)}>
        <MoreHorizontal size={16} style={{ color: theme.textMuted }} />
      </button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)} width={176}>
          <MenuItem icon={Pencil} label="Modifier" onClick={act(onEdit)} />
          <MenuItem icon={Copy} label="Dupliquer" onClick={act(onDuplicate)} />
          <MenuItem icon={Trash2} label="Supprimer" onClick={act(onDelete)} danger />
        </FloatingMenu>
      )}
    </li>
  );
}

// ─── Exécutions ───────────────────────────────────────────────────────────────

const RUN_STATUS = {
  SUCCESS: { label: "Réussie", chip: "ok" },
  FAILED: { label: "En échec", chip: "bad" },
  STOPPED: { label: "Arrêtée", chip: "off" },
} as const;

function RunsView() {
  const [runs, setRuns] = useState<PipelineRun[] | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [open, setOpen] = useState<PipelineRun | null>(null);

  useEffect(() => {
    pipelineApi.list().then(setPipelines).catch(() => setPipelines([]));
  }, []);
  useEffect(() => {
    setRuns(null);
    pipelineApi.runs(pipelineId || undefined).then(setRuns).catch(() => setRuns([]));
  }, [pipelineId]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium sm:w-72" style={{ border: 0 }} aria-label="Pipeline">
          <option value="">Tous les pipelines</option>
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        {runs && <span className="text-[12.5px]" style={{ color: theme.textMuted }}>{plural(runs.length, "exécution récente", "exécutions récentes")}</span>}
      </div>

      {runs === null ? (
        <ListSkeleton height={64} count={4} />
      ) : runs.length === 0 ? (
        <EmptyState bare icon={Zap} title="Aucune exécution pour l'instant">
          Dès qu'un message correspond à un pipeline actif, son exécution apparaît ici avec le résultat de chaque étape.
        </EmptyState>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {runs.map((r) => {
            const st = RUN_STATUS[r.status];
            return (
              <li key={r.id}>
                <button onClick={() => setOpen(r)} className="row-s w-full text-left" aria-haspopup="dialog">
                  <span className={`tr-ico ${r.status === "SUCCESS" ? "ok-solid sm" : r.status === "FAILED" ? "bad" : ""}`}>{r.status === "SUCCESS" ? <Check strokeWidth={3} /> : r.status === "FAILED" ? <X strokeWidth={2.6} /> : <Zap />}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{r.pipeline.name}</b>
                    <small className="block truncate text-[12px]" style={{ color: theme.textMuted }}>{r.subject}</small>
                  </span>
                  <span className={`chip ${st.chip} hidden flex-shrink-0 sm:inline-flex`}>{st.label}</span>
                  <span className="flex-shrink-0 text-[12px] font-semibold" style={{ color: theme.textMuted }}>{timeAgo(r.createdAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && <RunModal run={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function RunModal({ run, onClose }: { run: PipelineRun; onClose: () => void }) {
  const st = RUN_STATUS[run.status];
  return (
    <Modal title="Détail de l'exécution" subtitle={run.pipeline.name} onClose={onClose} footer={<Button icon={X} size="sm" onClick={onClose}>Fermer</Button>}>
      <div className="row-s !items-start">
        <IconTile icon={Zap} tint="#f05a1a" />
        <div className="min-w-0 flex-1">
          <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{run.subject}</b>
          <small className="block text-[12px]" style={{ color: theme.textMuted }}>{new Date(run.createdAt).toLocaleString("fr-FR")}</small>
        </div>
        <span className={`chip ${st.chip} flex-shrink-0`}>{st.label}</span>
      </div>
      {run.error && <p className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: theme.red }}><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />{run.error}</p>}
      <ol className="stagger mt-3 flex flex-col gap-2">
        {run.trace.map((s) => {
          const m = stepMeta(s.type);
          return (
            <li key={s.stepId} className="row-s !items-start" style={s.status === "skipped" ? { opacity: 0.55 } : undefined}>
              <span className={`tr-ico ${s.status === "ok" ? "ok-solid sm" : s.status === "failed" ? "bad" : ""}`} title={s.status === "ok" ? "Fait" : s.status === "failed" ? "En échec" : "Non exécutée"}>
                {s.status === "ok" ? <Check strokeWidth={3} /> : s.status === "failed" ? <X strokeWidth={2.6} /> : <m.icon />}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{s.label}</b>
                {s.detail && <small className="block text-[12px] leading-snug" style={{ color: s.status === "failed" ? theme.red : theme.textMuted }}>{s.detail}</small>}
                {s.status === "skipped" && <small className="block text-[12px]" style={{ color: theme.textMuted }}>Non exécutée : une étape précédente s'est arrêtée.</small>}
              </div>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
