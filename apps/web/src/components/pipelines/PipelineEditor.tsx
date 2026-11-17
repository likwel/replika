import { useState, type CSSProperties } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Plus, Trash2, Zap, X } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { ApiError } from "@/lib/api";
import type { SocialAccount } from "@/lib/account.api";
import type { AutomationRule } from "@/lib/automation.api";
import { pipelineApi, type Pipeline, type PipelineInput, type PipelineStep, type PipelineTrigger } from "@/lib/pipeline.api";
import { LEAD_STATUSES, STEP_TYPES, TRIGGERS, newId, stepError, stepMeta, triggerOf, type StepMeta } from "./meta";

interface Props {
  pipeline: Pipeline | null; // null : création
  preset?: Partial<PipelineInput>; // modèle ou copie
  rules: AutomationRule[];
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: (p: Pipeline) => void;
}

const tile = (tint: string): CSSProperties => ({ "--a": `color-mix(in srgb, ${tint} 78%, #fff)`, "--b": tint, color: "#fff" }) as CSSProperties;

// Création et modification d'un pipeline : le déclencheur, puis le flux d'étapes dans l'ordre où elles s'exécutent
export function PipelineEditor({ pipeline, preset, rules, accounts, onClose, onSaved }: Props) {
  const [name, setName] = useState(pipeline?.name ?? preset?.name ?? "");
  const [description, setDescription] = useState(pipeline?.description ?? preset?.description ?? "");
  const [trigger, setTrigger] = useState<PipelineTrigger>(pipeline?.trigger ?? preset?.trigger ?? "NEW_COMMENT");
  const [accountId, setAccountId] = useState<string>(pipeline?.accountId ?? preset?.accountId ?? "");
  const [steps, setSteps] = useState<PipelineStep[]>(pipeline?.steps ?? preset?.steps ?? []);
  const [activate, setActivate] = useState(false);
  const [adding, setAdding] = useState(steps.length === 0);
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
  const add = (m: StepMeta) => {
    setSteps((list) => [...list, m.make(newId())]);
    setAdding(false);
  };

  const nameError = name.trim() ? null : "Donnez un nom au pipeline";
  const stepsError = steps.length === 0 ? "Ajoutez au moins une étape" : steps.length > 12 ? "12 étapes au maximum" : null;
  const invalid = Boolean(nameError || stepsError || steps.some(stepError));

  const save = async () => {
    setShowErrors(true);
    if (invalid) return;
    setSaving(true);
    setServerError(null);
    const body: PipelineInput = { name: name.trim(), description: description.trim() || null, trigger, accountId: accountId || null, steps, ...(pipeline ? {} : { isActive: activate }) };
    try {
      const saved = pipeline ? await pipelineApi.update(pipeline.id, body) : await pipelineApi.create(body);
      onSaved(saved);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Enregistrement impossible.");
      setSaving(false);
    }
  };

  const t = triggerOf(trigger);

  return (
    <Modal
      size="lg"
      title={pipeline ? "Modifier le pipeline" : "Nouveau pipeline"}
      subtitle="Quand un événement se produit, les étapes s'exécutent l'une après l'autre."
      onClose={onClose}
      footer={
        <>
          {!pipeline && (
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-[12.5px] font-medium" style={{ color: theme.text }}>
              <Toggle checked={activate} onChange={setActivate} label="Activer tout de suite" />
              Activer tout de suite
            </label>
          )}
          <Button icon={X} variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" icon={Check} onClick={() => void save()} disabled={saving}>{pipeline ? "Enregistrer" : "Créer le pipeline"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {serverError && <p className="row-s text-[13px]" style={{ color: theme.red }}><AlertTriangle size={15} className="flex-shrink-0" />{serverError}</p>}

        {/* Identité */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Nom</span>
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
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Compte concerné</span>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="field-in h-10 w-full rounded-xl px-3 text-[14px] font-medium" style={{ border: 0 }} aria-label="Compte concerné">
              <option value="">Tous les comptes</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Description <span className="font-normal" style={{ color: theme.textMuted }}>(facultatif)</span></span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="À quoi sert ce pipeline ?" className="field-in h-10 w-full rounded-xl px-3 text-[14px] font-medium outline-none" style={{ border: 0 }} />
          </label>
        </div>

        {/* Déclencheur */}
        <section>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>1 · Quand ?</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Déclencheur">
            {TRIGGERS.map((tr) => {
              const on = trigger === tr.id;
              return (
                <button
                  key={tr.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTrigger(tr.id)}
                  className="row-s text-left"
                  style={on ? { background: theme.goldSoft, boxShadow: "inset 0 0 0 1.5px rgb(var(--color-gold-rgb) / 0.55)" } : undefined}
                >
                  <span className="ico-tile sm" style={tile(tr.tint)}><tr.icon size={17} strokeWidth={2.1} /></span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-semibold" style={{ color: on ? theme.goldDark : theme.text }}>{tr.label}</b>
                    <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{tr.text}</small>
                  </span>
                  {on && <span className="tr-ico ok-solid sm"><Check strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Étapes */}
        <section>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>2 · Puis, dans l'ordre</p>

          <ol className="mt-2 flex flex-col">
            {/* Départ : rappel du déclencheur */}
            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="ico-tile sm" style={tile(t.tint)}><Zap size={16} strokeWidth={2.2} /></span>
                <span className="w-px flex-1" style={{ background: "var(--line-2)", minHeight: 14 }} />
              </div>
              <p className="pb-3 pt-1.5 text-[13px] font-semibold" style={{ color: theme.text }}>
                {t.label} <span className="font-normal" style={{ color: theme.textMuted }}>· départ</span>
              </p>
            </li>

            {steps.map((s, i) => {
              const m = stepMeta(s.type);
              const err = showErrors ? stepError(s) : null;
              return (
                <li key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="ico-tile sm" style={tile(m.tint)}><m.icon size={16} strokeWidth={2.1} /></span>
                    <span className="w-px flex-1" style={{ background: "var(--line-2)", minHeight: 14 }} />
                  </div>
                  <div className="row-s mb-3 min-w-0 flex-1 !flex-col !items-stretch !gap-2.5" style={err ? { boxShadow: "inset 0 0 0 1.5px rgba(225,29,72,0.45)" } : undefined}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{m.label}</b>
                        <small className="block text-[11.5px]" style={{ color: theme.textMuted }}>
                          <span className={`chip ${m.kind === "condition" ? "off" : "brand"} !text-[10.5px]`}>{m.kind === "condition" ? "Condition" : "Action"}</span>
                          <span className="ml-1.5">{m.kind === "condition" ? "sinon le pipeline s'arrête" : m.text}</span>
                        </small>
                      </div>
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 hover:bg-black/5 disabled:opacity-30" aria-label="Monter l'étape"><ArrowUp size={15} style={{ color: theme.textMuted }} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded-lg p-1.5 hover:bg-black/5 disabled:opacity-30" aria-label="Descendre l'étape"><ArrowDown size={15} style={{ color: theme.textMuted }} /></button>
                      <button onClick={() => setSteps((l) => l.filter((_, k) => k !== i))} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Supprimer l'étape"><Trash2 size={15} style={{ color: theme.red }} /></button>
                    </div>

                    {s.type === "MATCH_RULE" && (
                      <Select value={s.config.ruleId} onChange={(e) => setConfig(i, { ruleId: e.target.value })} className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium" style={{ border: 0 }} aria-label="Règle" placeholder="Rechercher une règle…">
                        <option value="">Choisir une règle…</option>
                        {rules.map((r) => <option key={r.id} value={r.id}>{r.name}{r.isActive ? "" : " (en pause)"}</option>)}
                      </Select>
                    )}
                    {s.type === "MIN_SCORE" && (
                      <label className="flex items-center gap-3 text-[13px]" style={{ color: theme.text }}>
                        Note d'au moins
                        <input type="number" min={1} max={100} value={s.config.min} onChange={(e) => setConfig(i, { min: Number(e.target.value) })} className="field-in h-9 w-20 rounded-xl px-3 text-[13px] font-semibold outline-none" style={{ border: 0 }} />
                        <span style={{ color: theme.textMuted }}>sur 100 (chaud à partir de 70)</span>
                      </label>
                    )}
                    {(s.type === "SEND_DM" || s.type === "NOTIFY") && (
                      <textarea
                        value={s.config.text}
                        onChange={(e) => setConfig(i, { text: e.target.value })}
                        rows={s.type === "SEND_DM" ? 3 : 2}
                        maxLength={s.type === "SEND_DM" ? 1000 : 300}
                        placeholder={s.type === "SEND_DM" ? "Bonjour {nom}, merci pour votre message…" : "Ex. Lead chaud : à rappeler"}
                        className="field-in w-full rounded-xl px-3 py-2 text-[13px] font-medium outline-none"
                        style={{ border: 0 }}
                      />
                    )}
                    {s.type === "SET_LEAD_STATUS" && (
                      <Select value={s.config.status} onChange={(e) => setConfig(i, { status: e.target.value })} className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium sm:w-64" style={{ border: 0 }} aria-label="Statut">
                        {LEAD_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                      </Select>
                    )}
                    {s.type === "SET_LEAD_STATUS" && <small className="text-[11.5px]" style={{ color: theme.textMuted }}>Sans lead associé au message, cette étape ne fait rien.</small>}
                    {err && <span className="text-[12px] font-medium" style={{ color: theme.red }}>{err}</span>}
                  </div>
                </li>
              );
            })}

            {/* Ajout */}
            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px]" style={{ background: "var(--surface-3)", color: theme.textMuted }}><Plus size={16} /></span>
              </div>
              <div className="min-w-0 flex-1">
                {adding ? (
                  <div className="flex flex-col gap-3">
                    {(["condition", "action"] as const).map((kind) => (
                      <div key={kind}>
                        <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: theme.textMuted }}>{kind === "condition" ? "Conditions : sinon le pipeline s'arrête" : "Actions : font quelque chose"}</p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {STEP_TYPES.filter((m) => m.kind === kind).map((m) => (
                            <button key={m.type} type="button" onClick={() => add(m)} className="row-s !gap-2.5 !py-2 text-left">
                              <span className="ico-tile sm" style={tile(m.tint)}><m.icon size={16} strokeWidth={2.1} /></span>
                              <span className="min-w-0">
                                <b className="block text-[13px] font-semibold" style={{ color: theme.text }}>{m.label}</b>
                                <small className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{m.text}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {steps.length > 0 && <button className="lnk self-start" onClick={() => setAdding(false)}>Annuler</button>}
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)} disabled={steps.length >= 12}>Ajouter une étape</Button>
                )}
                {showErrors && stepsError && <span className="mt-1.5 block text-[12px]" style={{ color: theme.red }}>{stepsError}</span>}
              </div>
            </li>
          </ol>
        </section>
      </div>
    </Modal>
  );
}
