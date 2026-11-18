import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Select } from "@/components/ui/Select";
import { X, Layers, MessageCircle, Mail, Loader2, Sparkles, BookOpen, Plus, Minus, Play, Save, Check, ArrowLeft, PencilLine, MessageSquareText, Hash, Eye, AlertTriangle, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { IconTile } from "@/components/ui/Dash";
import { Segmented } from "@/components/ui/Segmented";
import { AccountMultiSelect } from "@/components/workspace/AccountMultiSelect";
import { ApiError } from "@/lib/api";
import { offerReplyCredits } from "@/lib/replyCredits";
import type { SocialAccount } from "@/lib/account.api";
import { workspaceApi, type WsPost } from "@/lib/workspace.api";
import {
  EMPTY_RULE, KNOWLEDGE_MAX, KNOWLEDGE_TEMPLATES, RULE_LANGUAGES, RULE_PRESETS, presetFor, splitKeywords, splitVariants, type RuleLang,
} from "./rules";
import { aiApi, type AiReply } from "@/lib/ai.api";
import type { RuleLanguage } from "@/lib/automation.api";
import { usePlan } from "@/hooks/usePlan";
import {
  automationApi,
  type AutomationRule,
  type MatchType,
  type RuleChannel,
  type RuleInput,
} from "@/lib/automation.api";

// Extrait court de la publication, pour l'affichage dans le sélecteur et dans la liste des règles
const postSnippet = (p: Pick<WsPost, "text" | "kind">) =>
  (p.text.trim() || (p.kind === "photo" ? "Photo sans légende" : "Publication sans texte")).slice(0, 80);

const CHANNELS: Array<{ value: RuleChannel; label: string; icon: LucideIcon }> = [
  { value: "ALL", label: "Tout", icon: Layers },
  { value: "COMMENT", label: "Commentaires", icon: MessageCircle },
  { value: "DIRECT", label: "Messages privés", icon: Mail },
];

const MATCHES: Array<{ value: MatchType; label: string }> = [
  { value: "CONTAINS", label: "Contient un mot-clé" },
  { value: "EXACT", label: "Message exact" },
  { value: "ANY", label: "Tout message" },
];

const inputClass = "field-in w-full rounded-xl px-3.5 py-2.5 text-sm outline-none";
const inputStyle = { border: 0 };

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{children}</p>
      {hint && <p className="text-[11px]" style={{ color: theme.textMuted }}>{hint}</p>}
    </div>
  );
}

interface Props {
  rule: AutomationRule | null; // null = création
  preset?: Partial<RuleInput>;
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: (rule: AutomationRule) => void;
  defaultAccountId?: string | null; // création depuis un contexte précis (ex. un live) : compte et canal déjà choisis
  defaultChannel?: RuleChannel;
}

export function RuleEditor({ rule, preset, accounts, onClose, onSaved, defaultAccountId = null, defaultChannel }: Props) {
  const [form, setForm] = useState<RuleInput>(() =>
    rule
      ? {
          name: rule.name,
          channel: rule.channel,
          matchType: rule.matchType,
          trigger: rule.trigger,
          response: rule.response,
          useAi: rule.useAi,
          language: rule.language ?? "ACCOUNT",
          aiKnowledge: rule.aiKnowledge ?? null,
          privateReply: rule.privateReply,
          autoSend: rule.autoSend,
          isActive: rule.isActive,
          priority: rule.priority,
          accountIds: rule.accountIds,
          postId: rule.postId,
          postLabel: rule.postLabel,
        }
      : { ...EMPTY_RULE, channel: defaultChannel ?? EMPTY_RULE.channel, accountIds: defaultAccountId ? [defaultAccountId] : [], ...preset }
  );
  // Création : modèle choisi (les autres sont grisés). Un modèle transmis par la page est présélectionné.
  const [modelId, setModelId] = useState<string | null>(() =>
    rule ? null : (RULE_PRESETS.find((m) => m.rule.name && m.rule.name === preset?.name)?.id ?? (preset ? "custom" : null))
  );
  // Étapes : Modèle (création seulement) → Quand → Réponse → Envoi. Chaque étape affiche son statut (terminée, en cours, à faire, à compléter).
  const stepIds: StepId[] = rule ? ["when", "reply", "send"] : ["model", "when", "reply", "send"];
  const [step, setStep] = useState<StepId>(() => (rule || modelId !== null ? "when" : "model"));
  const [seen, setSeen] = useState<Set<StepId>>(() => new Set<StepId>(rule ? ["when", "reply", "send"] : [modelId !== null ? "when" : "model"]));
  const go = (id: StepId) => {
    setStep(id);
    setSeen((x) => new Set(x).add(id));
    setError(null);
  };
  const [lang, setLang] = useState<RuleLang>("fr"); // langue des textes des modèles
  const pickModel = (id: string, l: RuleLang = lang) => {
    const m = presetFor(RULE_PRESETS.find((x) => x.id === id)!, l);
    setModelId(id);
    // Langue de la règle alignée sur celle du modèle (l'IA suit le compte en français)
    const language = id === "custom" ? "ACCOUNT" : l === "mg" ? "MG" : id === "ai" ? "ACCOUNT" : "FR";
    setForm((f) => ({ ...EMPTY_RULE, channel: defaultChannel ?? EMPTY_RULE.channel, accountIds: f.accountIds, postId: null, postLabel: null, ...m.rule, language }));
    setError(null);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<WsPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Les publications ne se listent que pour un compte précis : un seul compte visé
  const singleAccountId = form.accountIds.length === 1 ? form.accountIds[0] : null;
  useEffect(() => {
    if (!singleAccountId) return setPosts([]);
    setPostsLoading(true);
    workspaceApi
      .posts([singleAccountId])
      .then((d) => setPosts(d.posts))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleAccountId]);

  // Fermeture au clavier
  useEffect(() => {
    // Phase de capture : Échap ferme seulement cette fenêtre, pas celle qui l'a ouverte (assistant de live…)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const keywords = splitKeywords(form.trigger);
  const variants = splitVariants(form.response);
  // Règle IA ciblée sur une publication : formule Pro et plus (mots-clés par publication : toutes formules)
  const { can } = usePlan();
  const postAiLocked = !can("postAiRules") && Boolean(form.postId) && form.useAi;
  const replyAccounts = accounts.filter((a) => a.platform !== "TIKTOK");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    // Entrée dans un champ : étape suivante (si elle est complète), l'enregistrement n'a lieu qu'à la dernière étape
    if (step !== stepIds[stepIds.length - 1]) {
      if (stepMissing(step).length === 0) go(stepIds[stepIds.indexOf(step) + 1]);
      return;
    }
    if (!form.name.trim()) return setError("Donnez un nom à la règle.");
    if (form.matchType !== "ANY" && keywords.length === 0) return setError("Ajoutez au moins un mot-clé.");
    if (!form.useAi && !form.response?.trim()) return setError("Écrivez la réponse à envoyer, ou activez la réponse par IA.");
    if (postAiLocked) return setError("Les règles IA ciblées sur une publication sont réservées à la formule Pro.");

    const body: RuleInput = {
      ...form,
      trigger: form.matchType === "ANY" ? "" : keywords.join(", "),
      privateReply: form.channel === "DIRECT" ? null : form.privateReply?.trim() || null,
    };
    setSaving(true);
    try {
      onSaved(rule ? await automationApi.update(rule.id, body) : await automationApi.create(body));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  // Ce qu'il reste à compléter, par étape (la 1re colonne du pied de fenêtre) et au total
  const stepMissing = (id: StepId): string[] => {
    const out: string[] = [];
    if (id === "model" && modelId === null) out.push("un modèle");
    if (id === "when") {
      if (!form.name.trim()) out.push("le nom");
      if (form.matchType !== "ANY" && keywords.length === 0) out.push("au moins un mot-clé");
    }
    if (id === "reply") {
      if (!form.useAi && !form.response?.trim()) out.push("le texte de la réponse");
      if (postAiLocked) out.push("la formule Pro pour l'IA ciblée");
    }
    return out;
  };
  const missing = stepIds.flatMap(stepMissing);
  const canSave = missing.length === 0 && !saving;
  const idx = stepIds.indexOf(step);
  const isLast = idx === stepIds.length - 1;
  const here = stepMissing(step);
  // Statut affiché sous chaque étape : l'étape en cours, celles déjà vues (terminées ou à compléter), celles à venir
  const statusOf = (id: StepId): StepStatus => (id === step ? "current" : stepIds.indexOf(id) < idx || seen.has(id) ? (stepMissing(id).length ? "warn" : "done") : "todo");
  // On ne saute pas par-dessus une étape incomplète ; revenir en arrière est toujours possible
  const reachable = (id: StepId) => stepIds.slice(0, stepIds.indexOf(id)).every((x) => stepMissing(x).length === 0);
  const model = RULE_PRESETS.find((m) => m.id === modelId);
  const pickedAccounts = replyAccounts.filter((a) => form.accountIds.includes(a.id));
  const accountName = pickedAccounts[0]?.name ?? replyAccounts[0]?.name ?? "Ma Page";
  const accountsText = pickedAccounts.length > 1 ? `${pickedAccounts.length} comptes` : accountName;

  // Portail : sinon la carte de la page (isolation) emprisonne l'overlay sous l'en-tête
  return createPortal(
    <div className="scrim fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="sheet flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] sm:max-h-[92vh] sm:rounded-[22px]"
      >
        <div className="grab sm:hidden" aria-hidden />
        <header className="flex items-center gap-3 border-b px-5 pb-3.5 pt-2 sm:pt-4" style={{ borderColor: "var(--line)" }}>
          <IconTile icon={MessageSquareText} tint="#8B5CF6" size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-extrabold tracking-[-0.02em]" style={{ color: theme.text }}>{rule ? "Modifier la règle" : "Nouvelle règle"}</h3>
            <p className="truncate text-xs" style={{ color: theme.textMuted }}>
              {rule ? rule.name : `Étape ${idx + 1} sur ${stepIds.length}`}{rule ? "" : ` · ${STEP_META[step].title}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[11px] hover:brightness-95" style={{ background: theme.bg, color: theme.textMuted }} aria-label="Fermer">
            <X size={16} />
          </button>
        </header>

        <Stepper ids={stepIds} statusOf={statusOf} reachable={reachable} onSelect={go} />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Étape « Modèle » */}
          {step === "model" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-sm text-[13px]" style={{ color: theme.textMuted }}>Le modèle remplit la règle pour vous : mots-clés et réponse prêts, que vous pourrez ajuster ensuite.</p>
                <div className="w-[190px] flex-shrink-0">
                  <Segmented
                    options={[{ value: "fr", label: "Français" }, { value: "mg", label: "Malagasy" }]}
                    value={lang}
                    onChange={(l) => {
                      setLang(l);
                      if (modelId) pickModel(modelId, l);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {RULE_PRESETS.map((base) => {
                  const m = presetFor(base, lang);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        pickModel(m.id);
                        go("when");
                      }}
                      className="group flex items-start gap-3 rounded-2xl p-3.5 text-left transition-all hover:-translate-y-px"
                      style={{ background: theme.bgCard, border: `1.5px solid ${modelId === m.id ? theme.gold : "var(--line)"}`, boxShadow: "var(--sh-card)" }}
                    >
                      <IconTile icon={m.icon} tint={m.id === "ai" ? "#8B5CF6" : m.id === "custom" ? "#64748B" : "#f59e0b"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold" style={{ color: theme.text }}>{m.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Étapes Quand, Réponse, Envoi */}
          {step !== "model" && (
            <>
              {!rule && model && step === "when" && (
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: theme.goldSoft }}>
                  <model.icon size={15} style={{ color: theme.goldDark }} />
                  <p className="min-w-0 flex-1 truncate text-[13px]" style={{ color: theme.text }}>Modèle : <b>{presetFor(model, lang).label}</b></p>
                  <button type="button" onClick={() => go("model")} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: theme.goldDark }}>
                    <ArrowLeft size={12} /> Changer
                  </button>
                </div>
              )}

              {/* QUAND */}
              {step === "when" && <Block title="Quand répondre ?" subtitle="Le nom, l'endroit et les mots qui déclenchent la règle.">
                <div>
                  <Label>Nom de la règle</Label>
                  <input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Demande de prix" autoFocus={Boolean(rule)} />
                </div>

                <div>
                  <Label>S'applique à</Label>
                  <Segmented options={CHANNELS} value={form.channel} onChange={(v) => set("channel", v)} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={form.accountIds.length > 1 ? "sm:col-span-2" : undefined}>
                    <Label>Comptes</Label>
                    <AccountMultiSelect
                      accounts={replyAccounts}
                      value={form.accountIds}
                      label="Comptes concernés par la règle"
                      onChange={(accountIds) => setForm((f) => ({ ...f, accountIds, ...(accountIds.length === 1 && accountIds[0] === f.accountIds[0] ? {} : { postId: null, postLabel: null }) }))}
                    />
                    {form.accountIds.length > 1 && (
                      <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>Pour cibler une publication précise, ne gardez qu'un seul compte.</p>
                    )}
                  </div>
                  {singleAccountId && (
                    <div>
                      <Label>Publication (facultatif)</Label>
                      <Select
                        className={inputClass}
                        style={inputStyle}
                        value={form.postId ?? ""}
                        disabled={postsLoading}
                        onChange={(e) => {
                          const p = posts.find((x) => x.id === e.target.value);
                          setForm((f) => ({ ...f, postId: p?.id ?? null, postLabel: p ? postSnippet(p) : null }));
                        }}
                      >
                        <option value="">Toutes les publications</option>
                        {form.postId && !posts.some((p) => p.id === form.postId) && <option value={form.postId}>{form.postLabel ?? "Publication choisie"}</option>}
                        {posts.map((p) => (
                          <option key={p.id} value={p.id}>{postSnippet(p)} · {p.comments} commentaire{p.comments > 1 ? "s" : ""}</option>
                        ))}
                      </Select>
                      {postsLoading && <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>Chargement des publications…</p>}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Déclencheur</Label>
                  <Segmented options={MATCHES} value={form.matchType} onChange={(v) => set("matchType", v)} />
                  {form.matchType === "ANY" ? (
                    <p className="mt-2 rounded-xl px-3 py-2 text-[12px]" style={{ background: "var(--surface-3)", color: theme.textMuted }}>
                      Répond à tout message qu'aucune règle à mots-clés ni l'assistant IA n'a pris en charge. En message privé, elle n'est envoyée qu'une fois par personne toutes les 24 h.
                    </p>
                  ) : (
                    <div className="mt-2">
                      <KeywordInput value={form.trigger} onChange={(v) => set("trigger", v)} />
                      <p className="mt-1.5 text-[11.5px]" style={{ color: theme.textMuted }}>
                        Tapez un mot puis Entrée ou virgule. Majuscules et accents ignorés{form.matchType === "CONTAINS" ? " ; le mot doit apparaître entier." : " ; le message doit être exactement ce texte."}
                      </p>
                    </div>
                  )}
                </div>
              </Block>}

              {/* ALORS */}
              {step === "reply" && <Block title="Que répondre ?" subtitle="Un texte que vous écrivez, ou une réponse rédigée par l'IA.">
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type de réponse">
                  <Choice
                    on={!form.useAi}
                    icon={PencilLine}
                    title="Texte fixe"
                    text="Vous écrivez la réponse, avec des variantes possibles."
                    onClick={() => set("useAi", false)}
                  />
                  <Choice
                    on={form.useAi}
                    icon={Sparkles}
                    title="Réponse par IA"
                    text="L'IA rédige chaque réponse à partir de vos informations."
                    badge={!can("postAiRules") && form.postId ? "PRO" : undefined}
                    disabled={!can("postAiRules") && Boolean(form.postId) && !form.useAi}
                    onClick={() => set("useAi", true)}
                  />
                </div>
                {postAiLocked && (
                  <p className="rounded-lg px-3 py-2 text-[12px]" style={{ background: theme.amberSoft, color: theme.amber }}>
                    Les règles IA ciblées sur une publication sont réservées à la formule Pro : choisissez « Toutes les publications », ou un texte fixe pour cette publication.{" "}
                    <a href="/app/parametres" className="font-semibold underline">Voir les formules</a>
                  </p>
                )}

                {!form.useAi ? (
                  <FixedReply value={form.response ?? ""} onChange={(v) => set("response", v)} variants={variants.length} sample={keywords[0]} accountName={accountName} />
                ) : (
                  <>
                    <KnowledgeField value={form.aiKnowledge ?? ""} onChange={(v) => set("aiKnowledge", v || null)} lang={form.language === "MG" ? "mg" : "fr"} />
                    <RuleAiPreview accountId={pickedAccounts[0]?.id ?? replyAccounts[0]?.id ?? null} channel={form.channel} language={form.language} knowledge={form.aiKnowledge} />
                  </>
                )}

                <div>
                  <Label hint={form.useAi ? "Langue dans laquelle l'IA rédige. « Comme le compte » suit le réglage de l'Assistant IA." : "Aide à organiser vos règles : le texte est envoyé tel quel."}>Langue de la réponse</Label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Langue de la réponse">
                    {RULE_LANGUAGES.map((l) => {
                      const on = form.language === l.value;
                      return (
                        <button
                          key={l.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set("language", l.value)}
                          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors"
                          style={{ background: on ? theme.goldSoft : theme.bgCard, border: `1.5px solid ${on ? theme.gold : "var(--line)"}`, color: on ? theme.goldDark : theme.text }}
                        >
                          <span aria-hidden>{l.flag}</span> {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.channel !== "DIRECT" && (
                  <div className="rounded-xl p-3" style={{ background: theme.bgCard, border: "1px solid var(--line)" }}>
                    <label className="flex cursor-pointer items-center gap-3">
                      <Mail size={16} style={{ color: theme.goldDark }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold" style={{ color: theme.text }}>Envoyer aussi un message privé</span>
                        <span className="block text-[11.5px]" style={{ color: theme.textMuted }}>À l'auteur du commentaire, une seule fois par commentaire (ex. les tarifs).</span>
                      </span>
                      <Toggle checked={form.privateReply !== null} onChange={(v) => set("privateReply", v ? "" : null)} label="Message privé en plus" />
                    </label>
                    {form.privateReply !== null && (
                      <textarea className={`${inputClass} mt-3`} style={inputStyle} rows={3} value={form.privateReply} onChange={(e) => set("privateReply", e.target.value)} placeholder="Bonjour {nom}, voici nos tarifs : …" />
                    )}
                  </div>
                )}
              </Block>}

              {/* ENVOI */}
              {step === "send" && <Block title="Comment l'envoyer ?" subtitle="Tout de suite, ou après votre validation.">
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Envoi">
                  <Choice on={form.autoSend} icon={Sparkles} title="Envoi automatique" text="Publiée immédiatement, sans validation." onClick={() => set("autoSend", true)} />
                  <Choice on={!form.autoSend} icon={Eye} title="Je valide avant" text="Proposée dans « À traiter » : vous relisez puis envoyez." onClick={() => set("autoSend", false)} />
                </div>
                <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: theme.bgCard, border: "1px solid var(--line)" }}>
                  <Hash size={16} style={{ color: theme.textMuted }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold" style={{ color: theme.text }}>Priorité</span>
                    <span className="block text-[11.5px]" style={{ color: theme.textMuted }}>Si plusieurs règles correspondent, la plus haute l'emporte.</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => set("priority", Math.max(-100, form.priority - 1))} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: theme.bg }} aria-label="Baisser la priorité"><Minus size={14} /></button>
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      aria-label="Priorité"
                      className="field-in h-8 w-14 rounded-lg text-center text-sm font-semibold outline-none"
                      style={{ border: 0 }}
                      value={form.priority}
                      onChange={(e) => set("priority", Math.max(-100, Math.min(100, Number(e.target.value) || 0)))}
                    />
                    <button type="button" onClick={() => set("priority", Math.min(100, form.priority + 1))} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: theme.bg }} aria-label="Monter la priorité"><Plus size={14} /></button>
                  </div>
                </div>
              </Block>}

              {/* En résumé */}
              {step === "send" && <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px dashed var(--line-2)" }}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>En résumé</p>
                <p className="text-[13.5px] leading-relaxed" style={{ color: theme.text }}>
                  Quand {form.channel === "DIRECT" ? "un message privé" : form.channel === "COMMENT" ? "un commentaire" : "un commentaire ou un message"}
                  {form.accountIds.length ? ` sur ${accountsText}` : ""}
                  {form.matchType === "ANY" ? " n'a pas d'autre réponse" : form.matchType === "EXACT" ? <> est exactement <b>« {keywords.join(" » ou « ") || "…"} »</b></> : <> contient <b>{keywords.length ? keywords.map((k) => `« ${k} »`).join(", ") : "…"}</b></>}
                  {", "}
                  {form.useAi ? "l'IA rédige la réponse" : "le texte fixe est envoyé"}
                  {form.autoSend ? " automatiquement." : ", après votre validation."}
                </p>
              </div>}
            </>
          )}

          {error && <p className="rounded-xl px-3 py-2 text-sm" style={{ background: theme.dangerBg, color: theme.red }}>{error}</p>}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <p className="mr-auto min-w-0 flex-1 basis-40 text-xs" style={{ color: here.length ? theme.amber : isLast && missing.length === 0 ? theme.green : theme.textMuted }}>
            {here.length ? (
              <>Il manque : <b>{here.join(", ")}</b></>
            ) : isLast ? (
              missing.length ? <>À compléter avant d'enregistrer : <b>{missing.join(", ")}</b></> : <span className="inline-flex items-center gap-1"><Check size={13} /> Prête à enregistrer</span>
            ) : (
              "Cette étape est complète."
            )}
          </p>
          <Button icon={X} type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          {idx > 0 && <Button icon={ArrowLeft} type="button" variant="ghost" size="sm" onClick={() => go(stepIds[idx - 1])}>Retour</Button>}
          {!isLast ? (
            <Button icon={ArrowRight} type="button" size="sm" disabled={here.length > 0} onClick={() => go(stepIds[idx + 1])}>Continuer</Button>
          ) : (
            <Button type="submit" size="sm" disabled={!canSave} className={saving ? "[&>svg]:animate-spin" : ""} icon={saving ? Loader2 : Save}>
              {rule ? "Enregistrer" : "Créer la règle"}
            </Button>
          )}
        </footer>
      </form>
    </div>,
    document.body,
  );
}

// Bloc d'une étape du formulaire : titre et sous-titre, puis les champs
function Block({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <div>
        <h4 className="text-[14px] font-bold leading-tight" style={{ color: theme.text }}>{title}</h4>
        <p className="text-[11.5px]" style={{ color: theme.textMuted }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

// Étapes de la règle, chacune avec son statut : terminée (coche verte), en cours, à faire, à compléter (alerte)
type StepId = "model" | "when" | "reply" | "send";
type StepStatus = "done" | "current" | "warn" | "todo";
const STEP_META: Record<StepId, { title: string; label: string }> = {
  model: { title: "Choisissez un modèle", label: "Modèle" },
  when: { title: "Quand répondre", label: "Quand" },
  reply: { title: "Que répondre", label: "Réponse" },
  send: { title: "Comment l'envoyer", label: "Envoi" },
};
const STATUS_LABEL: Record<StepStatus, string> = { done: "Terminé", current: "En cours", warn: "À compléter", todo: "À faire" };

function Stepper({ ids, statusOf, reachable, onSelect }: { ids: StepId[]; statusOf: (id: StepId) => StepStatus; reachable: (id: StepId) => boolean; onSelect: (id: StepId) => void }) {
  return (
    <ol className="flex items-start gap-1 border-b px-4 py-3 sm:px-5" style={{ borderColor: "var(--line)" }} aria-label="Étapes de la règle">
      {ids.map((id, i) => {
        const st = statusOf(id);
        const can = reachable(id) && st !== "current";
        return (
          <li key={id} className="flex min-w-0 flex-1 items-start gap-1">
            <button
              type="button"
              onClick={() => can && onSelect(id)}
              disabled={!can && st !== "current"}
              aria-current={st === "current" ? "step" : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1 text-center transition-colors enabled:hover:bg-black/5 disabled:cursor-default"
            >
              {st === "done" ? (
                <span className="tr-ico ok-solid md"><Check strokeWidth={3} /></span>
              ) : st === "warn" ? (
                <span className="tr-ico warn md"><AlertTriangle /></span>
              ) : (
                <span
                  className="grid h-[26px] w-[26px] place-items-center rounded-full text-[12px] font-bold"
                  style={st === "current" ? { background: "var(--color-gold)", color: theme.onAccent, boxShadow: "0 0 0 4px rgb(var(--color-gold-rgb) / 0.18)" } : { background: "var(--surface-3)", color: theme.textMuted }}
                >
                  {i + 1}
                </span>
              )}
              <span className="max-w-full truncate text-[12px] font-semibold" style={{ color: st === "todo" ? theme.textMuted : theme.text }}>{STEP_META[id].label}</span>
              <span className="hidden text-[10.5px] font-medium sm:block" style={{ color: st === "done" ? theme.green : st === "warn" ? theme.amber : st === "current" ? theme.goldDark : theme.textMuted }}>
                {STATUS_LABEL[st]}
              </span>
            </button>
            {i < ids.length - 1 && <span className="mt-[18px] h-0.5 w-4 flex-shrink-0 rounded-full sm:w-8" style={{ background: st === "done" ? "#22C55E" : "var(--line-2)" }} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

// Carte de choix exclusif (réponse fixe / IA, envoi automatique / validation)
function Choice({ on, icon: Icon, title, text, badge, disabled, onClick }: { on: boolean; icon: LucideIcon; title: string; text: string; badge?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="flex items-start gap-2.5 rounded-xl p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55"
      style={{ background: on ? theme.goldSoft : theme.bgCard, border: `1.5px solid ${on ? theme.gold : "var(--line)"}` }}
    >
      <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg" style={{ background: on ? theme.gold : "var(--surface-3)", color: on ? theme.onAccent : theme.textMuted }}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: theme.text }}>
          {title}
          {badge && <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{badge}</span>}
        </span>
        <span className="block text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{text}</span>
      </span>
      {on && <Check size={15} className="mt-1 flex-shrink-0" style={{ color: theme.goldDark }} />}
    </button>
  );
}

// Mots-clés en pastilles : Entrée ou virgule pour ajouter, croix ou Retour arrière pour retirer. La valeur reste « mot, mot, mot ».
function KeywordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState("");
  const words = splitKeywords(value);
  const commit = (raw: string) => {
    const add = raw.split(",").map((k) => k.trim()).filter((k) => k && !words.some((w) => w.toLowerCase() === k.toLowerCase()));
    if (add.length) onChange([...words, ...add].join(", "));
    setDraft("");
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && words.length) onChange(words.slice(0, -1).join(", "));
  };
  return (
    <div className="field-in flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl px-2.5 py-2" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
      {words.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-[12px] font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
          {k}
          <button type="button" onClick={() => onChange(words.filter((w) => w !== k).join(", "))} className="grid h-4 w-4 place-items-center rounded-full hover:bg-black/10" aria-label={`Retirer ${k}`}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={onKey}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={words.length ? "Ajouter un mot…" : "prix, combien, tarif…"}
        aria-label="Mots-clés"
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        style={{ color: theme.text }}
      />
    </div>
  );
}

// Réponse en texte fixe : variables en un clic, variantes, et aperçu de la conversation
function FixedReply({ value, onChange, variants, sample, accountName }: { value: string; onChange: (v: string) => void; variants: number; sample?: string; accountName: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (text: string) => {
    const el = ref.current;
    const at = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? at;
    onChange(`${value.slice(0, at)}${text}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + text.length, at + text.length);
    });
  };
  const first = splitVariants(value)[0] ?? "";
  const preview = first.replace(/\{nom\}/g, "Rasoa").replace(/\{page\}/g, accountName);
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <Label hint="Séparez plusieurs variantes par || : l'une sera choisie au hasard.">Texte de la réponse</Label>
        <textarea ref={ref} className={inputClass} style={inputStyle} rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Bonjour {nom} ! Nous vous envoyons le prix en message privé 📩" />
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: theme.textMuted }}>Insérer :</span>
          {[["{nom}", "prénom du client"], ["{page}", "nom de votre Page"]].map(([v, hint]) => (
            <button key={v} type="button" onClick={() => insert(v)} title={hint} className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ background: theme.bgCard, border: "1px solid var(--line)", color: theme.goldDark }}>
              {v}
            </button>
          ))}
          <button type="button" onClick={() => insert(" || ")} title="Ajouter une variante" className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: theme.bgCard, border: "1px solid var(--line)", color: theme.text }}>
            + variante
          </button>
          {variants > 1 && <span className="ml-auto text-[11px] font-semibold" style={{ color: theme.goldDark }}>{variants} variantes</span>}
        </div>
      </div>
      {preview && (
        <div className="rounded-xl p-3" style={{ background: theme.bgCard, border: "1px solid var(--line)" }}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Aperçu</p>
          <div className="flex flex-col gap-1.5 text-[13px]">
            <span className="max-w-[80%] self-start rounded-2xl rounded-bl-md px-3 py-1.5" style={{ background: "var(--surface-3)", color: theme.text }}>{sample ? `${sample} ?` : "Bonjour ?"}</span>
            <span className="max-w-[85%] self-end whitespace-pre-line rounded-2xl rounded-br-md px-3 py-1.5" style={{ background: theme.gold, color: theme.onAccent }}>{preview}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Connaissances propres à la règle (500 caractères) : l'IA s'en sert en priorité pour cette question
function KnowledgeField({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: RuleLang }) {
  const left = KNOWLEDGE_MAX - value.length;
  const insert = (text: string) => {
    const next = value.trim() ? `${value.trim()}\n${text}` : text;
    onChange(next.slice(0, KNOWLEDGE_MAX));
  };
  return (
    <div className="rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div className="mb-1.5 flex items-start gap-2">
        <BookOpen size={15} className="mt-0.5 flex-shrink-0" style={{ color: theme.gold }} />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Connaissances pour l'IA (optionnel)</p>
          <p className="text-[11px]" style={{ color: theme.textMuted }}>
            Prix, tailles, délais… propres à cette règle. L'IA les utilise en priorité, en plus des informations du compte, et
            n'invente rien au-delà.
          </p>
        </div>
      </div>
      <textarea
        rows={4}
        maxLength={KNOWLEDGE_MAX}
        className={inputClass}
        style={{ ...inputStyle, background: theme.bgCard }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lang === "mg" ? "Vidiny : akanjo raphia 45 000 Ar\nFanaterana Tana : 5 000 Ar" : "Robe en raphia : 45 000 Ar\nLivraison Tana : 5 000 Ar sous 48 h"}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {KNOWLEDGE_TEMPLATES[lang].map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => insert(t.text)}
            disabled={left <= 0}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-40"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
          >
            <Plus size={11} /> {t.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: left < 50 ? theme.amber : theme.textMuted }}>
          {value.length} / {KNOWLEDGE_MAX}
        </span>
      </div>
    </div>
  );
}

// Essai de la réponse IA de la règle en brouillon (langue + connaissances), sans rien publier
function RuleAiPreview({
  accountId, channel, language, knowledge,
}: { accountId: string | null; channel: RuleInput["channel"]; language: RuleLanguage; knowledge: string | null }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!accountId || !text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await aiApi.test({
          accountId,
          text,
          kind: channel === "DIRECT" ? "DIRECT" : "COMMENT",
          ruleLanguage: language,
          ruleKnowledge: knowledge ?? "",
        }),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Test impossible.");
      offerReplyCredits(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-3" style={{ border: `1px dashed ${theme.border}` }}>
      <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: theme.text }}>Essayer la réponse de l'IA</p>
      {!accountId ? (
        <p className="text-[11.5px]" style={{ color: theme.textMuted }}>Connectez une Page pour essayer la réponse.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void run();
                }
              }}
              placeholder="Message d'un client, ex. « Ohatrinona ? »"
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-gold/40"
              style={inputStyle}
            />
            <Button type="button" size="sm" variant="dark" icon={loading ? undefined : Play} onClick={() => void run()} disabled={loading || !text.trim()}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              Essayer
            </Button>
          </div>
          {error && <p className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: theme.dangerBg, color: theme.red }}>{error}</p>}
          {result && (
            <p className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ background: theme.goldSoft, color: theme.text }}>
              {result.reply || <em style={{ color: theme.textMuted }}>Aucune réponse (message classé comme spam ou hors sujet).</em>}
              {result.needsHuman && <span className="mt-1 block text-[11px]" style={{ color: theme.amber }}>L'IA demanderait votre validation pour ce message.</span>}
            </p>
          )}
          <p className="mt-1.5 text-[11px]" style={{ color: theme.textMuted }}>Compte une réponse IA dans votre quota du mois. Rien n'est publié.</p>
        </>
      )}
    </div>
  );
}
