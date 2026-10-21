import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { X, Layers, MessageCircle, Mail, Loader2, Sparkles, BookOpen, Plus, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { ApiError } from "@/lib/api";
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

const inputClass = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

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
}

export function RuleEditor({ rule, preset, accounts, onClose, onSaved }: Props) {
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
          accountId: rule.accountId,
          postId: rule.postId,
          postLabel: rule.postLabel,
        }
      : { ...EMPTY_RULE, ...preset }
  );
  // Création : modèle choisi (les autres sont grisés). Un modèle transmis par la page est présélectionné.
  const [modelId, setModelId] = useState<string | null>(() =>
    rule ? null : (RULE_PRESETS.find((m) => m.rule.name && m.rule.name === preset?.name)?.id ?? (preset ? "custom" : null))
  );
  const [lang, setLang] = useState<RuleLang>("fr"); // langue des textes des modèles
  const pickModel = (id: string, l: RuleLang = lang) => {
    const m = presetFor(RULE_PRESETS.find((x) => x.id === id)!, l);
    setModelId(id);
    // Langue de la règle alignée sur celle du modèle (l'IA suit le compte en français)
    const language = id === "custom" ? "ACCOUNT" : l === "mg" ? "MG" : id === "ai" ? "ACCOUNT" : "FR";
    setForm((f) => ({ ...EMPTY_RULE, accountId: f.accountId, postId: null, postLabel: null, ...m.rule, language }));
    setError(null);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<WsPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Les publications ne peuvent être listées que pour un compte précis
  useEffect(() => {
    if (!form.accountId) return setPosts([]);
    setPostsLoading(true);
    workspaceApi
      .posts([form.accountId])
      .then((d) => setPosts(d.posts))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.accountId]);

  // Fermeture au clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(28,24,19,0.55)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-2xl"
        style={{ background: theme.bgCard }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: theme.border }}>
          <h3 className="font-semibold" style={{ color: theme.text }}>
            {rule ? "Modifier la règle" : "Nouvelle règle"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Fermer">
            <X size={18} style={{ color: theme.textMuted }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {!rule && (
            <div>
              <div className="flex items-start justify-between gap-3">
                <Label hint="Le modèle remplit la règle pour vous : vous pourrez tout ajuster ensuite.">1. Choisissez un modèle</Label>
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {RULE_PRESETS.map((base) => {
                  const m = presetFor(base, lang);
                  const selected = modelId === m.id;
                  const dim = modelId !== null && !selected; // les autres modèles sont grisés (toujours cliquables)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pickModel(m.id)}
                      aria-pressed={selected}
                      className="flex flex-col items-start gap-1 rounded-xl p-2.5 text-left transition-all hover:opacity-100 hover:grayscale-0"
                      style={{
                        background: selected ? theme.goldSoft : theme.bg,
                        border: `1.5px solid ${selected ? theme.gold : theme.border}`,
                        opacity: dim ? 0.5 : 1,
                        filter: dim ? "grayscale(1)" : undefined,
                      }}
                    >
                      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: selected ? theme.goldDark : theme.text }}>
                        <m.icon size={14} /> {m.label}
                      </span>
                      <span className="text-[11px] leading-snug" style={{ color: theme.textMuted }}>{m.desc}</span>
                    </button>
                  );
                })}
              </div>
              {modelId === null && (
                <p className="mt-2 text-[11px]" style={{ color: theme.textMuted }}>Sélectionnez un modèle pour afficher le reste de la règle.</p>
              )}
            </div>
          )}

          {(rule || modelId !== null) && (<>
          {!rule && <p className="-mb-2 text-[13px] font-semibold" style={{ color: theme.text }}>2. Personnalisez</p>}
          <div>
            <Label>Nom</Label>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex. Demande de prix"
              autoFocus
            />
          </div>

          <div>
            <Label>S'applique à</Label>
            <Segmented options={CHANNELS} value={form.channel} onChange={(v) => set("channel", v)} />
          </div>

          <div>
            <Label>Compte</Label>
            <select
              className={inputClass}
              style={inputStyle}
              value={form.accountId ?? ""}
              onChange={(e) => {
                const accountId = e.target.value || null;
                setForm((f) => ({ ...f, accountId, postId: null, postLabel: null }));
              }}
            >
              <option value="">Tous les comptes</option>
              {replyAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}
                </option>
              ))}
            </select>
          </div>

          {form.accountId && (
            <div>
              <Label hint="Laissez sur « Toutes les publications » pour une règle valable sur l'ensemble du compte.">
                Publication (optionnel)
              </Label>
              <select
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
                {form.postId && !posts.some((p) => p.id === form.postId) && (
                  <option value={form.postId}>{form.postLabel ?? "Publication choisie"}</option>
                )}
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {postSnippet(p)} · {p.comments} commentaire{p.comments > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              {postsLoading && <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>Chargement des publications…</p>}
            </div>
          )}

          <div>
            <Label>Déclencheur</Label>
            <Segmented options={MATCHES} value={form.matchType} onChange={(v) => set("matchType", v)} />
            {form.matchType === "ANY" ? (
              <p className="mt-2 text-[11px]" style={{ color: theme.textMuted }}>
                Répond à tout message qu'aucune règle à mots-clés ni l'assistant IA n'a pris en charge. En message
                privé, elle n'est envoyée qu'une fois par personne toutes les 24 h.
              </p>
            ) : (
              <>
                <input
                  className={`${inputClass} mt-2`}
                  style={inputStyle}
                  value={form.trigger}
                  onChange={(e) => set("trigger", e.target.value)}
                  placeholder="prix, combien, tarif"
                />
                <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>
                  Séparés par des virgules. Majuscules et accents ignorés
                  {form.matchType === "CONTAINS" ? " ; le mot doit apparaître entier." : "."}
                </p>
                {keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {keywords.map((k) => (
                      <span key={k} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: theme.text }}>
                <Sparkles size={13} style={{ color: theme.gold }} /> Réponse par IA
                {!can("postAiRules") && form.postId && (
                  <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>PRO</span>
                )}
              </p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                {form.useAi
                  ? "L'IA rédige chaque réponse, dans la langue choisie, à partir des connaissances de la règle ci-dessous et des informations du compte (Assistant IA)."
                  : "Désactivé : la règle envoie un texte fixe, écrit ci-dessous."}
              </p>
            </div>
            <Toggle
              checked={form.useAi}
              onChange={(v) => set("useAi", v)}
              disabled={!can("postAiRules") && Boolean(form.postId) && !form.useAi}
              label="Réponse par IA"
            />
          </div>
          {postAiLocked && (
            <p className="-mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: theme.amberSoft, color: theme.amber }}>
              Les règles IA ciblées sur une publication sont réservées à la formule Pro : choisissez « Toutes les publications »,
              ou une réponse fixe pour cette publication.{" "}
              <a href="/app/facturation" className="font-semibold underline">Voir les formules</a>
            </p>
          )}

          {/* Langue de la réponse */}
          <div>
            <Label
              hint={
                form.useAi
                  ? "Langue dans laquelle l'IA rédige la réponse de cette règle. « Comme le compte » suit le réglage de l'Assistant IA."
                  : "Langue de votre texte de réponse : elle vous aide à organiser vos règles (le texte est envoyé tel quel)."
              }
            >
              Langue de la réponse
            </Label>
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
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors"
                    style={{
                      background: on ? theme.goldSoft : theme.bg,
                      border: `1.5px solid ${on ? theme.gold : theme.border}`,
                      color: on ? theme.goldDark : theme.text,
                    }}
                  >
                    <span aria-hidden>{l.flag}</span> {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connaissances de la règle : mini base donnée à l'IA */}
          {form.useAi && (
            <KnowledgeField
              value={form.aiKnowledge ?? ""}
              onChange={(v) => set("aiKnowledge", v || null)}
              lang={form.language === "MG" ? "mg" : "fr"}
            />
          )}
          {form.useAi && (
            <RuleAiPreview
              accountId={form.accountId ?? replyAccounts[0]?.id ?? null}
              channel={form.channel}
              language={form.language}
              knowledge={form.aiKnowledge}
            />
          )}

          {!form.useAi && (
            <div>
              <Label hint="Variables : {nom} (prénom de l'auteur), {page}. Séparez plusieurs variantes par || : l'une sera choisie au hasard.">
                Réponse
              </Label>
              <textarea
                className={inputClass}
                style={inputStyle}
                rows={3}
                value={form.response ?? ""}
                onChange={(e) => set("response", e.target.value)}
                placeholder="Bonjour {nom} ! Nous vous envoyons le prix en message privé 📩"
              />
              {variants.length > 1 && (
                <p className="mt-1 text-[11px]" style={{ color: theme.goldDark }}>{variants.length} variantes</p>
              )}
            </div>
          )}

          {form.channel !== "DIRECT" && (
            <div>
              <Label hint="Commentaires uniquement : envoyé en plus, en privé, à l'auteur du commentaire (une fois par commentaire).">
                Message privé à l'auteur (optionnel)
              </Label>
              <textarea
                className={inputClass}
                style={inputStyle}
                rows={2}
                value={form.privateReply ?? ""}
                onChange={(e) => set("privateReply", e.target.value)}
                placeholder="Bonjour {nom}, voici nos tarifs : …"
              />
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Envoi automatique</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                {form.autoSend
                  ? "La réponse est publiée immédiatement, sans validation."
                  : "La réponse est proposée dans la file d'attente : vous la validez avant envoi."}
              </p>
            </div>
            <Toggle checked={form.autoSend} onChange={(v) => set("autoSend", v)} label="Envoi automatique" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Priorité</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                Si plusieurs règles correspondent, la plus haute l'emporte.
              </p>
            </div>
            <input
              type="number"
              min={-100}
              max={100}
              className={`${inputClass} !w-20 text-center`}
              style={inputStyle}
              value={form.priority}
              onChange={(e) => set("priority", Math.max(-100, Math.min(100, Number(e.target.value) || 0)))}
            />
          </div>
          </>)}

          {error && (
            <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: theme.border }}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" disabled={saving || (!rule && modelId === null)}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
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
