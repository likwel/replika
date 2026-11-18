import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import { AiModelPicker } from "@/components/automation/AiModelPicker";
import { AlertTriangle, BookOpen, Cpu, Power, SlidersHorizontal, Sparkles, ExternalLink, Loader2, Layers, MessageCircle, Mail, Check, UserCheck, CircleSlash, FilePlus, FlaskConical, Save, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { CardTitle } from "@/components/ui/Dash";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { StepCard, type StepTone } from "@/components/ui/StepCard";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { KnowledgeImportModal } from "@/components/automation/KnowledgeImportModal";
import { IntentChip } from "@/components/messages/IntentChip";
import { ApiError } from "@/lib/api";
import { offerReplyCredits } from "@/lib/replyCredits";
import { aiApi, type AiAccount, type AiLanguage, type AiOverview, type AiReply } from "@/lib/ai.api";
import type { RuleChannel } from "@/lib/automation.api";

const CHANNELS: Array<{ value: RuleChannel; label: string; icon: LucideIcon }> = [
  { value: "ALL", label: "Tout", icon: Layers },
  { value: "COMMENT", label: "Commentaires", icon: MessageCircle },
  { value: "DIRECT", label: "Messages privés", icon: Mail },
];

const CONTEXT_TEMPLATE = `Activité : …
Produits et prix : …
Livraison (zones, frais, délais) : …
Paiement : MVola, Orange Money, espèces à la livraison…
Horaires : …
Contact / adresse : …
Questions fréquentes : …`;

// Langue des réponses : Auto suit la langue du client ; Malagasy / Français l'imposent
const LANGS: Array<{ value: AiLanguage; flag: string; label: string; short: string; hint: string }> = [
  { value: "MG", flag: "🇲🇬", label: "Malagasy", short: "MG", hint: "Valiny amin'ny teny malagasy foana" },
  { value: "FR", flag: "🇫🇷", label: "Français", short: "FR", hint: "Toujours en français" },
  { value: "AUTO", flag: "🌐", label: "Automatique", short: "AUTO", hint: "Dans la langue du client" },
];

function LanguagePicker({ value, onChange }: { value: AiLanguage; onChange: (v: AiLanguage) => void }) {
  return (
    <div role="radiogroup" aria-label="Langue des réponses">
      <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Langue des réponses</p>
      <p className="mb-2 text-[11.5px]" style={{ color: theme.textMuted }}>
        Choisissez la langue dans laquelle l'assistant répond à vos clients, quelle que soit la langue de leur message.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LANGS.map((l) => {
          const on = value === l.value;
          return (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(l.value)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
              style={{
                background: on ? theme.goldSoft : theme.bg,
                border: `1.5px solid ${on ? theme.gold : theme.border}`,
                opacity: on ? 1 : 0.75,
              }}
            >
              <span className="text-xl leading-none" aria-hidden>{l.flag}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold" style={{ color: on ? theme.goldDark : theme.text }}>{l.label}</span>
                <span className="block text-[11px] leading-snug" style={{ color: theme.textMuted }}>{l.hint}</span>
              </span>
              <span
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                style={{ border: `1.5px solid ${on ? theme.gold : theme.border}` }}
              >
                {on && <span className="h-2 w-2 rounded-full" style={{ background: theme.gold }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SAMPLES = ["C'est combien ?", "Vous livrez à Toamasina ?", "Colis reçu abîmé 😡", "Mbola misy ve ?", "Ohatrinona ny akanjo ?"];

const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

export function AiAssistantView() {
  const [overview, setOverview] = useState<AiOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    aiApi
      .overview()
      .then((o) => {
        setOverview(o);
        setSelectedId((id) => id ?? o.accounts[0]?.id ?? null);
      })
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, []);

  const onSaved = (updated: AiAccount) =>
    setOverview((o) => o && { ...o, accounts: o.accounts.map((a) => (a.id === updated.id ? updated : a)) });

  if (loading) return <div className="h-40 animate-pulse rounded-2xl" style={{ background: theme.bg }} />;
  if (!overview) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm card-x" style={{ color: theme.textMuted }}>
        Impossible de charger la configuration de l'assistant IA.
      </div>
    );
  }

  const account = overview.accounts.find((a) => a.id === selectedId);

  return (
    <div className="flex flex-col gap-5">
      {overview.accounts.length === 0 ? (
        <>
          <ModelStatus overview={overview} />
          <AiModelPicker overview={overview} />
          <div className="rounded-2xl p-8 text-center text-sm card-x" style={{ color: theme.textMuted }}>
            Connectez une Page Facebook ou un compte Instagram pour configurer l'assistant.
          </div>
        </>
      ) : (
        <>
          {/* Choix du compte à configurer : flèches quand la liste dépasse la largeur */}
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 px-0.5 text-[12.5px] font-semibold" style={{ color: theme.textMuted }}>
              Compte à configurer
              <span className="chip off !text-[10.5px]">{overview.accounts.length}</span>
            </p>
            <ScrollRow label="Comptes" activeKey={selectedId}>
              {overview.accounts.map((a) => {
                const active = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    data-active={active}
                    aria-pressed={active}
                    onClick={() => setSelectedId(a.id)}
                    className="flex h-11 flex-shrink-0 items-center gap-2.5 rounded-full pl-2 pr-3.5 text-left transition-all hover:-translate-y-px"
                    style={{
                      background: active ? theme.bgDark : theme.bgCard,
                      color: active ? "#fff" : theme.text,
                      border: `1px solid ${active ? theme.bgDark : theme.border}`,
                      boxShadow: active ? "0 8px 16px -10px rgba(15,23,42,0.55)" : undefined,
                    }}
                  >
                    <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK"} size={28} />
                    <span className="min-w-0 leading-tight">
                      <span className="block max-w-[150px] truncate text-[13px] font-semibold">{a.name}</span>
                      <span className="block text-[10.5px]" style={{ color: active ? "rgba(255,255,255,0.65)" : theme.textMuted }}>
                        {a.aiEnabled ? `IA active · ${LANGS.find((l) => l.value === (a.aiLanguage ?? "AUTO"))!.short}` : "IA inactive"}
                      </span>
                    </span>
                    {/* Statut de l'assistant sur ce compte */}
                    {a.aiEnabled ? (
                      <span className="tr-ico ok-solid sm flex-shrink-0" title="Assistant actif"><Check strokeWidth={3} /></span>
                    ) : (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: active ? "rgba(255,255,255,0.35)" : "var(--line-2)" }} title="Assistant inactif" />
                    )}
                  </button>
                );
              })}
            </ScrollRow>
          </div>

          {account && (
            <AccountPanel key={account.id} account={account} overview={overview} onSaved={onSaved} />
          )}
        </>
      )}
    </div>
  );
}

function ModelStatus({ overview }: { overview: AiOverview }) {
  if (!overview.configured) {
    return (
      <div className="rounded-2xl p-5" style={{ background: theme.goldSoft, border: `1px solid ${theme.gold}40` }}>
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="mt-0.5 flex-shrink-0" style={{ color: theme.goldDark }} />
          <div className="text-sm" style={{ color: theme.text }}>
            <p className="font-semibold">Activez un modèle IA gratuit</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">
              <li>
                Créez une clé gratuite (sans carte bancaire) sur{" "}
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline" style={{ color: theme.goldDark }}>
                  console.groq.com <ExternalLink size={11} />
                </a>
              </li>
              <li>
                Ajoutez-la dans <code className="rounded px-1" style={{ background: theme.bgCard }}>apps/api/.env</code> :{" "}
                <code className="rounded px-1" style={{ background: theme.bgCard }}>AI_API_KEY="votre-clé"</code>
              </li>
              <li>Redémarrez l'API.</li>
            </ol>
            <p className="mt-2 text-[11px]" style={{ color: theme.textMuted }}>
              Autres options gratuites (Google Gemini, Ollama en local) : voir <code>.env.example</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null; // modèle configuré : il est présenté dans le sélecteur « Modèle IA »
}

interface PanelProps {
  account: AiAccount;
  overview: AiOverview;
  onSaved: (a: AiAccount) => void;
}

const channelLabel = (c: RuleChannel) => CHANNELS.find((x) => x.value === c)!.label.toLowerCase();

function AccountPanel({ account, overview, onSaved }: PanelProps) {
  const configured = overview.configured;
  const initial = {
    aiEnabled: account.aiEnabled,
    aiAutoSend: account.aiAutoSend,
    aiChannel: account.aiChannel,
    aiLanguage: account.aiLanguage ?? "AUTO",
    aiContext: account.aiContext ?? "",
    aiInstructions: account.aiInstructions ?? "",
  };
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [importing, setImporting] = useState<"aiContext" | "aiInstructions" | null>(null); // champ qui reçoit l'import

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setJustSaved(false);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await aiApi.updateAccount(account.id, draft);
      onSaved(updated);
      setSaved(draft);
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const field = "field-in w-full rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium outline-none";
  const hasContext = draft.aiContext.trim().length > 0;
  const lang = LANGS.find((l) => l.value === draft.aiLanguage)!;

  // Les quatre étapes et leur état actuel (calculé sur le brouillon : l'icône réagit en direct)
  const steps: Array<{ id: number; icon: LucideIcon; title: string; summary: string; tone: StepTone; optional?: boolean }> = [
    {
      id: 1,
      icon: Cpu,
      title: "Modèle IA",
      summary: configured ? `${overview.model} · ${overview.provider}` : "Non configuré sur ce serveur",
      tone: configured ? "ok" : "todo",
    },
    {
      id: 2,
      icon: Power,
      title: `Activer sur ${account.name}`,
      summary: draft.aiEnabled ? "Activé : répond aux messages sans règle" : "Désactivé : aucun message ne passe par l'IA",
      tone: draft.aiEnabled ? "ok" : "todo",
    },
    {
      id: 3,
      icon: BookOpen,
      title: "Ce qu'il doit savoir",
      summary: hasContext ? `${draft.aiContext.trim().length} caractères${draft.aiInstructions.trim() ? " · avec consignes" : ""}` : "Aucune information : l'IA restera générique",
      tone: hasContext ? "ok" : draft.aiEnabled ? "todo" : "info",
    },
    {
      id: 4,
      icon: SlidersHorizontal,
      title: "Sa façon de répondre",
      summary: `${lang.label} · ${channelLabel(draft.aiChannel)} · ${draft.aiAutoSend ? "envoi automatique" : "vous relisez avant l'envoi"}`,
      tone: "ok",
      optional: true,
    },
  ];
  const ready = steps.filter((s) => s.tone === "ok").length;
  // Dépliées au départ : les étapes à configurer (choisies une fois, pour ne pas se replier pendant la saisie)
  const [openSteps, setOpenSteps] = useState<Set<number>>(() => new Set(steps.filter((s) => s.tone === "todo").map((s) => s.id)));
  const toggle = (id: number) =>
    setOpenSteps((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const card = (id: number, children: ReactNode) => {
    const st = steps.find((x) => x.id === id)!;
    return (
      <StepCard n={id} icon={st.icon} title={st.title} summary={st.summary} tone={st.tone} optional={st.optional} open={openSteps.has(id)} onToggle={() => toggle(id)}>
        {children}
      </StepCard>
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-3 lg:col-span-2">
        {/* Avancement : combien d'étapes sont en place */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 card-x">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-[14px] font-bold" style={{ color: theme.text }}>Configuration de l'assistant</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="progressbar" aria-valuenow={ready} aria-valuemin={0} aria-valuemax={steps.length}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(ready / steps.length) * 100}%`, background: ready === steps.length ? theme.green : theme.gold }} />
            </div>
          </div>
          <span className={`chip ${ready === steps.length ? "ok" : "warn"}`}>{ready === steps.length ? "Prêt" : `${ready} / ${steps.length} étapes`}</span>
        </div>

        {card(1, configured ? <AiModelPicker overview={overview} bare /> : <ModelStatus overview={overview} />)}

        {card(
          2,
          <div className="row-s !p-3.5">
            <span className={`tr-ico ${draft.aiEnabled ? "ok-solid" : ""}`}>{draft.aiEnabled ? <Check strokeWidth={3} /> : <Sparkles />}</span>
            <div className="min-w-0 flex-1">
              <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{draft.aiEnabled ? "L'assistant est activé" : "L'assistant est désactivé"}</b>
              <small className="block text-[12px]" style={{ color: theme.textMuted }}>Pour les messages qu'aucune règle ne couvre. Les réponses par défaut « tout message » servent de secours si le modèle est indisponible.</small>
            </div>
            <Toggle checked={draft.aiEnabled} onChange={(v) => set("aiEnabled", v)} label="Activer l'IA" />
          </div>
        )}

        {card(
          3,
          <>
            <p className="text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>L'IA ne répond qu'à partir de ces informations : elle n'invente ni prix, ni stock, ni délai.</p>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold" style={{ color: theme.text }}>Informations sur votre activité</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {!hasContext && <Button icon={FilePlus} size="sm" variant="soft" onClick={() => set("aiContext", CONTEXT_TEMPLATE)}>Insérer un modèle</Button>}
                  <Button icon={Upload} size="sm" variant="soft" onClick={() => setImporting("aiContext")} title="Depuis un fichier .txt, .csv, .xlsx ou un Google Sheet">Importer</Button>
                </span>
              </div>
              <textarea
                rows={9}
                maxLength={8000}
                className={field}
                value={draft.aiContext}
                onChange={(e) => set("aiContext", e.target.value)}
                placeholder={"Produits et prix : panier S 25 000 Ar, panier M 35 000 Ar…\nLivraison : Tana 5 000 Ar sous 48 h…"}
              />
              <div className="mt-1 flex justify-between text-[11.5px]" style={{ color: theme.textMuted }}>
                <span>{draft.aiEnabled && !hasContext && "Sans ces informations, l'IA restera générique et escaladera les questions précises."}</span>
                <span className="tabular">{draft.aiContext.length} / 8000</span>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold" style={{ color: theme.text }}>Consignes <span className="font-normal" style={{ color: theme.textMuted }}>(facultatif)</span></span>
                <Button icon={Upload} size="sm" variant="soft" onClick={() => setImporting("aiInstructions")} title="Depuis un fichier .txt, .csv, .xlsx ou un Google Sheet">Importer</Button>
              </div>
              <textarea
                rows={3}
                maxLength={2000}
                className={field}
                value={draft.aiInstructions}
                onChange={(e) => set("aiInstructions", e.target.value)}
                placeholder="Vouvoyer les clients, ton chaleureux, signer « L'équipe ShopRaphia »…"
              />
            </div>
          </>
        )}

        {card(
          4,
          <>
            <LanguagePicker value={draft.aiLanguage} onChange={(v) => set("aiLanguage", v)} />
            <div className={draft.aiEnabled ? "flex flex-col gap-3" : "pointer-events-none flex flex-col gap-3 opacity-50"}>
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Messages traités</span>
                <Segmented options={CHANNELS} value={draft.aiChannel} onChange={(v) => set("aiChannel", v)} />
              </div>
              <div className="row-s !p-3.5">
                <div className="min-w-0 flex-1">
                  <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>Envoi automatique</b>
                  <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>
                    {draft.aiAutoSend
                      ? "Publiée directement. Réclamations et questions sans réponse restent escaladées vers vous."
                      : "Proposée dans « À traiter » : vous relisez avant l'envoi. Recommandé pour commencer."}
                  </small>
                </div>
                <Toggle checked={draft.aiAutoSend} onChange={(v) => set("aiAutoSend", v)} label="Envoi automatique" />
              </div>
            </div>
          </>
        )}

        {error && <p className="row-s text-[13px]" style={{ color: theme.red }}>{error}</p>}

        {/* Barre d'enregistrement : reste visible pendant le défilement */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-2xl px-4 py-3 card-x" style={{ boxShadow: "0 -10px 22px -12px rgba(15,23,42,0.25)" }}>
          {dirty ? (
            <span className="mr-auto flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: theme.amber }}><AlertTriangle size={13} /> Modifications non enregistrées</span>
          ) : (
            justSaved && (
              <span className="mr-auto flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: theme.green }}>
                <Check size={13} strokeWidth={3} /> Enregistré
              </span>
            )
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving} className={`${saving ? "[&>svg]:animate-spin" : ""}`} icon={saving ? Loader2 : Save}>Enregistrer</Button>
        </div>
      </div>

      {importing && (
        <KnowledgeImportModal
          title={importing === "aiContext" ? "Importer des informations" : "Importer des consignes"}
          current={draft[importing]}
          maxLength={importing === "aiContext" ? 8000 : 2000}
          onApply={(v) => set(importing, v)}
          onClose={() => setImporting(null)}
        />
      )}

      <div className="lg:sticky lg:top-0">
        <AiTester accountId={account.id} configured={configured} aiContext={draft.aiContext} aiInstructions={draft.aiInstructions} aiLanguage={draft.aiLanguage} />
      </div>
    </div>
  );
}

interface TesterProps {
  accountId: string;
  configured: boolean;
  aiContext: string;
  aiInstructions: string;
  aiLanguage: AiLanguage;
}

// Teste le brouillon en cours (même non enregistré) : rien n'est publié
function AiTester({ accountId, configured, aiContext, aiInstructions, aiLanguage }: TesterProps) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"COMMENT" | "DIRECT">("COMMENT");
  const [result, setResult] = useState<AiReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (e?: FormEvent, sample?: string) => {
    e?.preventDefault();
    const message = sample ?? text;
    if (!message.trim()) return;
    if (sample) setText(sample);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await aiApi.test({ accountId, text: message, kind, aiContext, aiInstructions, aiLanguage }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Test impossible.");
      offerReplyCredits(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5 card-x">
      <CardTitle title="Tester l'Assistant" subtitle="Utilise votre brouillon, même non enregistré. Rien n'est publié." icon={Sparkles} tint="#8B5CF6" />

      <form onSubmit={run} className="flex flex-col gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message d'un client…"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          style={inputStyle}
        />
        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => run(undefined, s)}
              disabled={!configured || loading}
              className="rounded-full px-2.5 py-1 text-[11px] disabled:opacity-50"
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as "COMMENT" | "DIRECT")}
            className="flex-1 rounded-xl px-2.5 py-2 text-xs outline-none"
            style={inputStyle}
          >
            <option value="COMMENT">Commentaire public</option>
            <option value="DIRECT">Message privé</option>
          </Select>
          <Button type="submit" size="sm" variant="dark" disabled={!configured || loading || !text.trim()} className={`${loading ? "[&>svg]:animate-spin" : ""}`} icon={loading ? Loader2 : FlaskConical}>Tester</Button>
        </div>
      </form>

      {!configured && (
        <p className="mt-3 text-[11px]" style={{ color: theme.textMuted }}>Configurez d'abord un modèle IA (voir ci-dessus).</p>
      )}
      {error && <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>}
      {result && (
        <div className="mt-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <IntentChip intent={result.intent} />
            {result.needsHuman && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: theme.red }}>
                <UserCheck size={12} /> Serait escaladé vers vous
              </span>
            )}
          </div>
          {result.reply ? (
            <p className="rounded-lg px-3 py-2 text-sm" style={{ background: theme.goldSoft, color: theme.text }}>{result.reply}</p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
              <CircleSlash size={13} /> Pas de réponse : message jugé hors sujet ou indésirable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
