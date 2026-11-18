import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronRight, Flag, Info, Plus, Search, Trash2, X, Zap } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { PlatIcon } from "@/components/ui/PlatIcon";
import { AccountMultiSelect } from "@/components/workspace/AccountMultiSelect";
import { ApiError } from "@/lib/api";
import type { SocialAccount } from "@/lib/account.api";
import type { AutomationRule } from "@/lib/automation.api";
import { pipelineApi, type Pipeline, type PipelineInput, type PipelineStep, type PipelineTrigger } from "@/lib/pipeline.api";
import { PipelineFlow } from "./PipelineFlow";
import { LEAD_INTENTS, LEAD_STATUSES, STEP_TYPES, TEMPLATES, TRIGGERS, newId, stepError, stepMeta, stepSummary, triggerOf, type StepMeta } from "./meta";

interface Props {
  pipeline: Pipeline | null; // null : création
  preset?: Partial<PipelineInput>; // modèle ou copie
  rules: AutomationRule[];
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: (p: Pipeline) => void;
}

const MAX_STEPS = 12;
const tile = (tint: string): CSSProperties => ({ "--a": `color-mix(in srgb, ${tint} 78%, #fff)`, "--b": tint, color: "#fff" }) as CSSProperties;
const label = "mb-1 block text-[12.5px] font-semibold";

// Constructeur de pipeline : un canevas (déclencheur → blocs → fin) à gauche, les réglages et les vérifications à droite
export function PipelineEditor({ pipeline, preset, rules, accounts, onClose, onSaved }: Props) {
  const [name, setName] = useState(pipeline?.name ?? preset?.name ?? "");
  const [description, setDescription] = useState(pipeline?.description ?? preset?.description ?? "");
  const [trigger, setTrigger] = useState<PipelineTrigger>(pipeline?.trigger ?? preset?.trigger ?? "NEW_COMMENT");
  const [accountIds, setAccountIds] = useState<string[]>(pipeline?.accountIds ?? preset?.accountIds ?? []);
  const [steps, setSteps] = useState<PipelineStep[]>(pipeline?.steps ?? preset?.steps ?? []);
  const [activate, setActivate] = useState(false);
  const [addingAt, setAddingAt] = useState<number | null>(steps.length === 0 ? 0 : null); // position où l'on insère un bloc
  const [triggerOpen, setTriggerOpen] = useState(!pipeline && !preset?.trigger);
  // Blocs dépliés : ceux à compléter au départ, puis ceux que l'on ouvre ou que l'on vient d'ajouter
  const [open, setOpen] = useState<Set<string>>(() => new Set(steps.filter((s) => stepError(s)).map((s) => s.id)));
  const [stage, setStage] = useState<"start" | "build">(!pipeline && !preset ? "start" : "build"); // création : on choisit d'abord un point de départ
  const [fromTemplate, setFromTemplate] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const setConfig = (i: number, patch: Record<string, unknown>) =>
    setSteps((list) => list.map((s, k) => (k === i ? ({ ...s, config: { ...s.config, ...patch } } as PipelineStep) : s)));
  const move = (i: number, d: -1 | 1) =>
    setSteps((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const add = (m: StepMeta) => {
    const at = addingAt ?? steps.length;
    const step = m.make(newId());
    setSteps((list) => [...list.slice(0, at), step, ...list.slice(at)]);
    setOpen((cur) => new Set(cur).add(step.id));
    setAddingAt(null);
  };

  // Point de départ : page blanche ou modèle
  const startBlank = () => {
    setFromTemplate(null);
    setTriggerOpen(true);
    setAddingAt(0);
    setStage("build");
  };
  const startFrom = (tpl: (typeof TEMPLATES)[number]) => {
    const list = tpl.steps();
    setName(tpl.name);
    setDescription(tpl.description);
    setTrigger(tpl.trigger);
    setSteps(list);
    setOpen(new Set(list.filter((x) => stepError(x)).map((x) => x.id)));
    setAddingAt(null);
    setTriggerOpen(false);
    setFromTemplate(tpl.name);
    setStage("build");
  };

  const invalidSteps = steps.filter((s) => stepError(s)).length;
  const nameError = name.trim() ? null : "Donnez un nom au pipeline";
  const stepsError = steps.length === 0 ? "Ajoutez au moins un bloc" : steps.length > MAX_STEPS ? `${MAX_STEPS} blocs au maximum` : null;
  const invalid = Boolean(nameError || stepsError || invalidSteps);
  const checks: Array<{ ok: boolean; text: string }> = [
    { ok: !nameError, text: "Le pipeline a un nom" },
    { ok: steps.length > 0, text: steps.length ? `${steps.length} bloc${steps.length > 1 ? "s" : ""} dans le flux` : "Au moins un bloc dans le flux" },
    { ok: steps.length > 0 && invalidSteps === 0, text: invalidSteps ? `${invalidSteps} bloc${invalidSteps > 1 ? "s" : ""} à compléter` : "Tous les blocs sont complets" },
  ];

  const save = async () => {
    setShowErrors(true);
    if (invalid) {
      setOpen((cur) => new Set([...cur, ...steps.filter((s) => stepError(s)).map((s) => s.id)])); // ouvre ce qu'il faut corriger
      return;
    }
    setSaving(true);
    setServerError(null);
    const body: PipelineInput = { name: name.trim(), description: description.trim() || null, trigger, accountIds, steps, ...(pipeline ? {} : { isActive: activate }) };
    try {
      const saved = pipeline ? await pipelineApi.update(pipeline.id, body) : await pipelineApi.create(body);
      onSaved(saved);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Enregistrement impossible.");
      setSaving(false);
    }
  };

  const t = triggerOf(trigger);

  // Point d'insertion entre deux nœuds : le « + » sur la ligne ouvre la bibliothèque de blocs à cet endroit
  const insertRow = (index: number) => {
    const isOpen = addingAt === index;
    const last = index === steps.length;
    return (
      <li className="flex gap-3">
        <div className="flex w-[34px] flex-col items-center">
          <span className="w-px flex-1" style={{ background: "var(--line-2)", minHeight: 8 }} />
          <button
            type="button"
            onClick={() => setAddingAt(isOpen ? null : index)}
            disabled={steps.length >= MAX_STEPS && !isOpen}
            aria-label="Ajouter un bloc ici"
            aria-expanded={isOpen}
            title="Ajouter un bloc ici"
            className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 disabled:opacity-40"
            style={{ background: isOpen ? theme.goldSoft : "var(--surface)", color: isOpen ? theme.goldDark : theme.textMuted, boxShadow: `inset 0 0 0 1.5px ${isOpen ? "rgb(var(--color-gold-rgb) / 0.55)" : "var(--line-2)"}` }}
          >
            <Plus size={14} style={{ transform: isOpen ? "rotate(45deg)" : undefined, transition: "transform .15s" }} />
          </button>
          <span className="w-px flex-1" style={{ background: "var(--line-2)", minHeight: 8 }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
          {isOpen ? (
            <BlockPicker key={index} defaultKind={index === 0 ? "condition" : "action"} onPick={add} onCancel={steps.length > 0 ? () => setAddingAt(null) : undefined} />
          ) : last ? (
            <button type="button" className="lnk self-start text-[12.5px]" onClick={() => setAddingAt(index)} disabled={steps.length >= MAX_STEPS}>
              {steps.length === 0 ? "Ajouter le premier bloc" : "Ajouter un bloc"}
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  if (stage === "start") {
    return (
      <Modal
        size="xl"
        title="Nouveau pipeline"
        subtitle="Partez d'un modèle prêt à l'emploi, ou d'une page blanche."
        onClose={onClose}
        footer={<Button icon={X} variant="ghost" size="sm" onClick={onClose}>Annuler</Button>}
      >
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startBlank}
            className="flex min-h-[10.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-solid"
            style={{ borderColor: "var(--line-2)", background: "var(--surface-2)" }}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: theme.goldSoft, color: theme.goldDark }}><Plus size={22} /></span>
            <b className="text-[14.5px] font-bold" style={{ color: theme.text }}>Partir de zéro</b>
            <small className="max-w-[16rem] text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>Choisissez le déclencheur, puis ajoutez vos blocs un par un.</small>
          </button>
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => startFrom(tpl)} className="row-s !flex-col !items-stretch !gap-3 !p-4 text-left">
              <PipelineFlow pipeline={{ trigger: tpl.trigger, steps: tpl.steps() }} />
              <span className="flex items-end gap-2">
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] font-bold" style={{ color: theme.text }}>{tpl.name}</b>
                  <small className="block text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{tpl.description}</small>
                </span>
                <ChevronRight size={18} className="flex-shrink-0" style={{ color: theme.textMuted }} />
              </span>
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      size="xl"
      title={pipeline ? "Modifier le pipeline" : "Nouveau pipeline"}
      subtitle="Un déclencheur, puis des blocs exécutés l'un après l'autre : une condition non remplie arrête le flux."
      onClose={onClose}
      footer={
        <>
          {!invalid && <span className="mr-auto hidden items-center gap-1.5 text-[12.5px] font-medium sm:flex" style={{ color: theme.green }}><Check size={14} strokeWidth={3} /> Prêt à enregistrer</span>}
          {invalid && showErrors && <span className="mr-auto flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: theme.red }}><AlertTriangle size={14} /> À corriger avant d'enregistrer</span>}
          <Button icon={X} variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" icon={Check} onClick={() => void save()} disabled={saving}>{pipeline ? "Enregistrer" : "Créer le pipeline"}</Button>
        </>
      }
    >
      {!pipeline && !preset && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: theme.textMuted }}>
          <button type="button" className="lnk inline-flex items-center gap-1" onClick={() => setStage("start")}><ArrowLeft size={13} /> Changer de point de départ</button>
          <span>· {fromTemplate ? <>Modèle : <b style={{ color: theme.text }}>{fromTemplate}</b></> : "Page blanche"}</span>
        </div>
      )}
      {serverError && <p className="row-s mb-3 text-[13px]" style={{ color: theme.red }}><AlertTriangle size={15} className="flex-shrink-0" />{serverError}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18.5rem]">
        {/* ── Réglages et vérifications (en premier sur mobile, à droite sur grand écran) */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:order-2">
          <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Réglages</p>
            <label className="block">
              <span className={label} style={{ color: theme.text }}>Nom</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Ex. Lead chaud → équipe"
                className="field-in h-10 w-full rounded-xl px-3 text-[14px] font-medium outline-none"
                style={{ border: 0 }}
                aria-invalid={showErrors && Boolean(nameError)}
              />
              {showErrors && nameError && <span className="mt-1 block text-[12px]" style={{ color: theme.red }}>{nameError}</span>}
            </label>
            <div>
              <span className={label} style={{ color: theme.text }}>Pages concernées</span>
              <AccountMultiSelect accounts={accounts} value={accountIds} onChange={setAccountIds} label="Pages concernées" />
            </div>
            <label className="block">
              <span className={label} style={{ color: theme.text }}>Description <span className="font-normal" style={{ color: theme.textMuted }}>(facultatif)</span></span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} placeholder="À quoi sert ce pipeline ?" className="field-in w-full rounded-xl px-3 py-2 text-[13px] font-medium outline-none" style={{ border: 0 }} />
            </label>
            {!pipeline && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                <span className="min-w-0">
                  <b className="block text-[13px] font-semibold" style={{ color: theme.text }}>Activer tout de suite</b>
                  <small className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>Sinon il reste en pause.</small>
                </span>
                <Toggle checked={activate} onChange={setActivate} label="Activer tout de suite" />
              </label>
            )}
          </div>

          <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Vérifications</p>
            <ul className="flex flex-col gap-2">
              {checks.map((c) => (
                <li key={c.text} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: c.ok ? theme.text : theme.amber }}>
                  <span className={`tr-ico ${c.ok ? "ok-solid" : "warn"} sm flex-shrink-0`}>{c.ok ? <Check strokeWidth={3} /> : <AlertTriangle />}</span>
                  {c.text}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Canevas : le flux, du départ à la fin */}
        <section
          className="rounded-2xl p-4 lg:order-1"
          style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)", backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        >
          <ol className="flex flex-col">
            {/* Départ : le déclencheur, modifiable sur place */}
            <li className="flex gap-3">
              <div className="flex w-[34px] flex-col items-center">
                <span className="ico-tile sm" style={tile(t.tint)}><Zap size={16} strokeWidth={2.2} /></span>
                <span className="w-px flex-1" style={{ background: "var(--line-2)", minHeight: 8 }} />
              </div>
              <div className="mb-0 min-w-0 flex-1 overflow-hidden rounded-2xl" style={{ background: "var(--surface)", boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${t.tint} 50%, transparent)` }}>
                <button type="button" onClick={() => setTriggerOpen((o) => !o)} aria-expanded={triggerOpen} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                  <span className="min-w-0 flex-1">
                    <small className="block text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Départ · quand ?</small>
                    <b className="block text-[13.5px] font-bold" style={{ color: theme.text }}>{t.label}</b>
                    <small className="block text-[11.5px]" style={{ color: theme.textMuted }}>{t.text}</small>
                  </span>
                  <span className="tr-ico ok-solid sm flex-shrink-0" aria-hidden><Check strokeWidth={3} /></span>
                  <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: triggerOpen ? "rotate(180deg)" : undefined }} />
                </button>
                {triggerOpen && (
                  <div className="animate-fade-in grid grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2" style={{ borderColor: "var(--line)" }} role="radiogroup" aria-label="Déclencheur">
                    {TRIGGERS.map((tr) => {
                      const on = trigger === tr.id;
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => {
                            setTrigger(tr.id);
                            setTriggerOpen(false);
                          }}
                          className="row-s text-left"
                          style={on ? { background: theme.goldSoft, boxShadow: "inset 0 0 0 1.5px rgb(var(--color-gold-rgb) / 0.55)" } : undefined}
                        >
                          <span className="ico-tile sm" style={tile(tr.tint)}><tr.icon size={17} strokeWidth={2.1} /></span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[13px] font-semibold" style={{ color: on ? theme.goldDark : theme.text }}>{tr.label}</b>
                            <small className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{tr.text}</small>
                          </span>
                          {on && <span className="tr-ico ok-solid sm"><Check strokeWidth={3} /></span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>

            {insertRow(0)}

            {steps.map((s, i) => {
              const m = stepMeta(s.type);
              const err = stepError(s);
              const cond = m.kind === "condition";
              const expanded = open.has(s.id);
              return (
                <Fragment key={s.id}>
                  <li className="flex gap-3">
                    <div className="flex w-[34px] flex-col items-center">
                      <span className="ico-tile sm" style={tile(m.tint)}><m.icon size={16} strokeWidth={2.1} /></span>
                      <span className="mt-1 text-[10px] font-bold tabular-nums" style={{ color: theme.textMuted }}>{i + 1}</span>
                      <span className="w-px flex-1" style={{ background: "var(--line-2)", minHeight: 8 }} />
                    </div>
                    <div
                      className="min-w-0 flex-1 overflow-hidden rounded-2xl"
                      style={{
                        background: "var(--surface)",
                        ...(showErrors && err
                          ? { boxShadow: "inset 0 0 0 1.5px rgba(225,29,72,0.5)" }
                          : cond
                            ? { outline: `1.5px dashed color-mix(in srgb, ${m.tint} 60%, transparent)`, outlineOffset: -1.5 }
                            : { boxShadow: "inset 0 0 0 1px var(--line-2)" }),
                      }}
                    >
                      <div className="flex items-center gap-1.5 pr-1.5">
                        <button type="button" onClick={() => toggleOpen(s.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] font-bold leading-tight" style={{ color: theme.text }}>
                              <span className={`chip ${cond ? "off" : "brand"} !text-[10px]`}>{cond ? "Si" : "Alors"}</span>
                              {m.label}
                            </span>
                            <small className="mt-0.5 block truncate text-[12px]" style={{ color: err ? theme.amber : theme.textMuted }}>{err ?? stepSummary(s, rules)}</small>
                          </span>
                          <span className={`tr-ico ${err ? "warn" : "ok-solid"} sm flex-shrink-0`} title={err ? "À compléter" : "Complet"} aria-label={err ? "À compléter" : "Complet"}>{err ? <AlertTriangle /> : <Check strokeWidth={3} />}</span>
                          <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: expanded ? "rotate(180deg)" : undefined }} />
                        </button>
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 hover:bg-black/5 disabled:opacity-30" aria-label="Monter le bloc"><ArrowUp size={15} style={{ color: theme.textMuted }} /></button>
                        <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded-lg p-1.5 hover:bg-black/5 disabled:opacity-30" aria-label="Descendre le bloc"><ArrowDown size={15} style={{ color: theme.textMuted }} /></button>
                        <button onClick={() => setSteps((l) => l.filter((_, k) => k !== i))} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Supprimer le bloc"><Trash2 size={15} style={{ color: theme.red }} /></button>
                      </div>
                      {expanded && (
                        <div className="animate-fade-in flex flex-col gap-2.5 border-t px-3.5 py-3" style={{ borderColor: "var(--line)" }}>
                          <p className="text-[12px] leading-snug" style={{ color: theme.textMuted }}>{cond ? `${m.text}. Sinon, le pipeline s'arrête.` : m.text}</p>
                          <StepConfig step={s} rules={rules} onChange={(patch) => setConfig(i, patch)} />
                          {showErrors && err && <span className="text-[12px] font-medium" style={{ color: theme.red }}>{err}</span>}
                        </div>
                      )}
                    </div>
                  </li>
                  {insertRow(i + 1)}
                </Fragment>
              );
            })}

            {/* Arrivée */}
            <li className="flex gap-3">
              <div className="flex w-[34px] flex-col items-center">
                <span className="ico-tile sm" style={tile("#94A3B8")}><Flag size={15} strokeWidth={2.2} /></span>
              </div>
              <p className="py-1.5 text-[13px] font-semibold" style={{ color: theme.textMuted }}>Fin du pipeline</p>
            </li>
          </ol>
          {showErrors && stepsError && <span className="mt-2 block text-[12px] font-medium" style={{ color: theme.red }}>{stepsError}</span>}
        </section>
      </div>
    </Modal>
  );
}

// ─── Bibliothèque de blocs : deux niveaux (Conditions / Actions, puis famille) ; la recherche couvre tout ───────

function BlockItem({ m, onPick }: { m: StepMeta; onPick: (m: StepMeta) => void }) {
  return (
    <button type="button" onClick={() => onPick(m)} className="row-s !gap-2.5 !py-2 text-left">
      <span className="ico-tile sm" style={tile(m.tint)}><m.icon size={16} strokeWidth={2.1} /></span>
      <span className="min-w-0">
        <b className="block text-[13px] font-semibold" style={{ color: theme.text }}>{m.label}</b>
        <small className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{m.text}</small>
      </span>
    </button>
  );
}

function BlockPicker({ onPick, onCancel, defaultKind }: { onPick: (m: StepMeta) => void; onCancel?: () => void; defaultKind: "condition" | "action" }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"condition" | "action">(defaultKind);
  const familiesOf = (k: "condition" | "action") => [...new Set(STEP_TYPES.filter((m) => m.kind === k).map((m) => m.group))];
  const [group, setGroup] = useState<string>(familiesOf(defaultKind)[0]);
  const families = familiesOf(kind);
  const needle = q.trim().toLowerCase();
  const found = needle ? STEP_TYPES.filter((m) => `${m.label} ${m.text} ${m.group}`.toLowerCase().includes(needle)) : [];
  const items = STEP_TYPES.filter((m) => m.kind === kind && m.group === group);
  const countOf = (k: "condition" | "action") => STEP_TYPES.filter((m) => m.kind === k).length;

  const pickKind = (k: "condition" | "action") => {
    setKind(k);
    setGroup(familiesOf(k)[0]);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-3 rounded-2xl p-3" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1.5px rgb(var(--color-gold-rgb) / 0.4)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="field-bare flex h-9 min-w-[10rem] flex-1 items-center gap-2 rounded-xl px-3">
          <Search size={14} style={{ color: theme.textMuted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Chercher parmi ${STEP_TYPES.length} blocs…`} aria-label="Chercher un bloc" autoFocus className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none" style={{ color: theme.text }} />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Effacer"><X size={14} style={{ color: theme.textMuted }} /></button>}
        </label>
        {onCancel && <button type="button" className="lnk text-[12.5px]" onClick={onCancel}>Annuler</button>}
      </div>

      {needle ? (
        // Recherche : résultats de toutes les familles
        found.length === 0 ? (
          <p className="py-3 text-center text-[12.5px]" style={{ color: theme.textMuted }}>Aucun bloc ne correspond à « {q} ».</p>
        ) : (
          <div className="grid max-h-[22rem] grid-cols-1 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
            {found.map((m) => <BlockItem key={m.type} m={m} onPick={onPick} />)}
          </div>
        )
      ) : (
        <>
          {/* Niveau 1 : que veut-on ajouter ? */}
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Type de bloc">
            {([
              { k: "condition" as const, title: "Condition", hint: "Filtrer : sinon le flux s'arrête", tag: "Si" },
              { k: "action" as const, title: "Action", hint: "Faire quelque chose", tag: "Alors" },
            ]).map((o) => {
              const on = kind === o.k;
              return (
                <button
                  key={o.k}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => pickKind(o.k)}
                  className="rounded-xl px-3 py-2 text-left transition-colors"
                  style={{ background: on ? theme.goldSoft : "var(--surface-2)", boxShadow: `inset 0 0 0 1.5px ${on ? "rgb(var(--color-gold-rgb) / 0.55)" : "var(--line)"}` }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`chip ${o.k === "condition" ? "off" : "brand"} !text-[10px]`}>{o.tag}</span>
                    <b className="text-[13.5px] font-bold" style={{ color: on ? theme.goldDark : theme.text }}>{o.title}</b>
                    <span className="ml-auto text-[11.5px] font-semibold tabular-nums" style={{ color: theme.textMuted }}>{countOf(o.k)}</span>
                  </span>
                  <small className="mt-0.5 block text-[11.5px]" style={{ color: theme.textMuted }}>{o.hint}</small>
                </button>
              );
            })}
          </div>

          {/* Niveau 2 : la famille */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Famille de blocs">
            {families.map((f) => {
              const on = group === f;
              const n = STEP_TYPES.filter((m) => m.kind === kind && m.group === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setGroup(f)}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
                  style={{ background: on ? theme.bgDark : "var(--surface-3)", color: on ? "#fff" : theme.text }}
                >
                  {f}
                  <span className="rounded-full px-1.5 text-[10.5px] tabular-nums" style={{ background: on ? "rgba(255,255,255,0.18)" : "var(--surface)", color: on ? "#fff" : theme.textMuted }}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {items.map((m) => <BlockItem key={m.type} m={m} onPick={onPick} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Réglages propres à chaque bloc ───────────────────────────────────────────────────────────

const input = "field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium outline-none";
const area = "field-in w-full rounded-xl px-3 py-2 text-[13px] font-medium outline-none";

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>
      <Info size={12} className="mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Boutons qui ajoutent {nom} ou {page} au texte
function Variables({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
      Insérer :
      {["{nom}", "{page}"].map((v) => (
        <button key={v} type="button" onClick={() => onInsert(v)} className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold" style={{ background: "var(--surface-3)", color: theme.text }}>{v}</button>
      ))}
    </span>
  );
}

// Choix multiples sous forme de pastilles à cocher
function ChipPicker<T extends string>({ options, value, onChange, ariaLabel }: { options: Array<{ id: T; label: string }>; value: T[]; onChange: (v: T[]) => void; ariaLabel: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
            style={{ background: on ? theme.goldSoft : "var(--surface-3)", color: on ? theme.goldDark : theme.text, boxShadow: on ? "inset 0 0 0 1.5px rgb(var(--color-gold-rgb) / 0.55)" : undefined }}
          >
            {on && <Check size={12} strokeWidth={3} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StepConfig({ step: s, rules, onChange }: { step: PipelineStep; rules: AutomationRule[]; onChange: (patch: Record<string, unknown>) => void }) {
  switch (s.type) {
    case "MATCH_RULE":
      return (
        <Select value={s.config.ruleId} onChange={(e) => onChange({ ruleId: e.target.value })} className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium" style={{ border: 0 }} aria-label="Règle" placeholder="Rechercher une règle…">
          <option value="">Choisir une règle…</option>
          {rules.map((r) => <option key={r.id} value={r.id}>{r.name}{r.isActive ? "" : " (en pause)"}</option>)}
        </Select>
      );
    case "KEYWORD":
      return (
        <>
          <input value={s.config.keywords} onChange={(e) => onChange({ keywords: e.target.value })} maxLength={300} placeholder="prix, combien, tarif" aria-label="Mots" className={input} style={{ border: 0 }} />
          <Segmented value={s.config.mode} onChange={(v) => onChange({ mode: v })} options={[{ value: "CONTAINS", label: "Contient l'un des mots" }, { value: "EXACT", label: "Est exactement l'un des mots" }]} />
          <Note>Sans tenir compte des majuscules ni des accents.</Note>
        </>
      );
    case "CHANNEL":
      return <Segmented value={s.config.kind} onChange={(v) => onChange({ kind: v })} options={[{ value: "COMMENT", label: "Commentaire public" }, { value: "DIRECT", label: "Message privé" }]} />;
    case "PLATFORM":
      return (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Réseau">
          {(["FACEBOOK", "INSTAGRAM"] as const).map((p) => {
            const on = s.config.platform === p;
            return (
              <button key={p} type="button" role="radio" aria-checked={on} onClick={() => onChange({ platform: p })} className="row-s !py-2 text-left" style={on ? { background: theme.goldSoft, boxShadow: "inset 0 0 0 1.5px rgb(var(--color-gold-rgb) / 0.55)" } : undefined}>
                <PlatIcon p={p === "FACEBOOK" ? "fb" : "ig"} size={20} />
                <b className="text-[13px] font-semibold" style={{ color: on ? theme.goldDark : theme.text }}>{p === "FACEBOOK" ? "Facebook" : "Instagram"}</b>
              </button>
            );
          })}
        </div>
      );
    case "MIN_SCORE":
      return (
        <label className="flex flex-wrap items-center gap-3 text-[13px]" style={{ color: theme.text }}>
          Note d'au moins
          <input type="number" min={1} max={100} value={s.config.min} onChange={(e) => onChange({ min: Number(e.target.value) })} className="field-in h-9 w-20 rounded-xl px-3 text-[13px] font-semibold outline-none" style={{ border: 0 }} />
          <span style={{ color: theme.textMuted }}>sur 100 (chaud à partir de 70)</span>
        </label>
      );
    case "LEAD_STATUS":
      return <ChipPicker ariaLabel="Statuts" options={LEAD_STATUSES} value={s.config.statuses} onChange={(v) => onChange({ statuses: v })} />;
    case "LEAD_INTENT":
      return <ChipPicker ariaLabel="Intentions" options={LEAD_INTENTS} value={s.config.intents} onChange={(v) => onChange({ intents: v })} />;
    case "LEAD_CONTACT":
      return <Note>Aucun réglage : le flux continue si le lead a donné un téléphone ou une adresse e-mail.</Note>;
    case "BUSINESS_HOURS":
      return (
        <>
          <Segmented value={s.config.mode} onChange={(v) => onChange({ mode: v })} options={[{ value: "OUTSIDE", label: "En dehors des horaires" }, { value: "INSIDE", label: "Pendant les horaires" }]} />
          <div className="flex flex-wrap items-center gap-2 text-[13px]" style={{ color: theme.text }}>
            Ouvert de
            <input type="time" value={s.config.from} onChange={(e) => onChange({ from: e.target.value })} aria-label="Ouverture" className="field-in h-9 rounded-xl px-3 text-[13px] font-semibold outline-none" style={{ border: 0 }} />
            à
            <input type="time" value={s.config.to} onChange={(e) => onChange({ to: e.target.value })} aria-label="Fermeture" className="field-in h-9 rounded-xl px-3 text-[13px] font-semibold outline-none" style={{ border: 0 }} />
          </div>
          <Note>Heure de Madagascar. Une plage qui passe minuit (22:00 à 06:00) fonctionne aussi.</Note>
        </>
      );
    case "SEND_DM":
    case "SEND_PUBLIC_REPLY":
    case "SET_LEAD_NOTE":
    case "NOTIFY":
    case "EMAIL_OWNER": {
      const max = s.type === "SEND_DM" ? 1000 : s.type === "SEND_PUBLIC_REPLY" ? 500 : 300;
      const placeholder: Record<string, string> = {
        SEND_DM: "Bonjour {nom}, merci pour votre message…",
        SEND_PUBLIC_REPLY: "Merci {nom} ! Je vous écris en privé 😊",
        SET_LEAD_NOTE: "Ex. Intéressé par le panier M",
        NOTIFY: "Ex. Lead chaud : à rappeler",
        EMAIL_OWNER: "Ex. Un client très intéressé vient d'écrire",
      };
      const withVars = s.type === "SEND_DM" || s.type === "SEND_PUBLIC_REPLY";
      return (
        <>
          <textarea value={s.config.text} onChange={(e) => onChange({ text: e.target.value })} rows={s.type === "SEND_DM" ? 3 : 2} maxLength={max} placeholder={placeholder[s.type]} aria-label="Texte" className={area} style={{ border: 0 }} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {withVars ? <Variables onInsert={(v) => onChange({ text: `${s.config.text}${v}`.slice(0, max) })} /> : <span />}
            <span className="text-[11.5px] tabular-nums" style={{ color: theme.textMuted }}>{s.config.text.length} / {max}</span>
          </div>
          {s.type === "EMAIL_OWNER" && <Note>L'e-mail part à l'adresse de votre compte SuiteFlow, avec le message du client en dessous.</Note>}
          {s.type === "SEND_PUBLIC_REPLY" && <Note>Sans effet si le message reçu est un message privé.</Note>}
        </>
      );
    }
    case "SET_LEAD_STATUS":
      return (
        <>
          <Select value={s.config.status} onChange={(e) => onChange({ status: e.target.value })} className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium sm:w-64" style={{ border: 0 }} aria-label="Statut">
            {LEAD_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
          </Select>
          <Note>Sans lead associé au message, ce bloc ne fait rien.</Note>
        </>
      );
    case "SET_LEAD_VALUE":
      return (
        <>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: theme.text }}>
            <input type="number" min={0} step={1000} value={s.config.value} onChange={(e) => onChange({ value: Math.max(0, Math.round(Number(e.target.value) || 0)) })} aria-label="Montant" className="field-in h-9 w-40 rounded-xl px-3 text-[13px] font-semibold tabular-nums outline-none" style={{ border: 0 }} />
            Ar
          </label>
          <Note>Sans lead associé au message, ce bloc ne fait rien.</Note>
        </>
      );
    case "IGNORE_MESSAGE":
      return <Note>Aucun réglage : le message est marqué « ignoré » et quitte « À traiter ».</Note>;
    case "ESCALATE":
      return <Note>Aucun réglage : le message est placé dans « À traiter » comme escaladé.</Note>;
    case "WEBHOOK":
      return (
        <>
          <input type="url" value={s.config.url} onChange={(e) => onChange({ url: e.target.value })} maxLength={2000} placeholder="https://hooks.zapier.com/…" aria-label="Adresse web" className={input} style={{ border: 0 }} />
          <Note>SuiteFlow envoie (POST, JSON) le message, le lead et le compte à cette adresse. Seules les adresses publiques en https:// sont acceptées ; elle est jointe sans redirection, en 8 secondes maximum.</Note>
        </>
      );
  }
}
