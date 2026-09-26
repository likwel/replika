import { useEffect, useState, type FormEvent } from "react";
import {
  Sparkles, Cpu, AlertTriangle, ExternalLink, Loader2, Layers, MessageCircle, Mail,
  Facebook, Instagram, Check, UserCheck, CircleSlash,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { IntentChip } from "@/components/messages/IntentChip";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { aiApi, type AiAccount, type AiOverview, type AiReply } from "@/lib/ai.api";
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

const SAMPLES = ["C'est combien ?", "Vous livrez à Toamasina ?", "Colis reçu abîmé 😡", "Mbola misy ve ?"];

const inputClass = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };
const card = { background: theme.bgCard, border: `1px solid ${theme.border}` };

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

  if (loading) return <div className="h-40 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />;
  if (!overview) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm" style={{ ...card, color: theme.textMuted }}>
        Impossible de charger la configuration de l'assistant IA.
      </div>
    );
  }

  const account = overview.accounts.find((a) => a.id === selectedId);

  return (
    <div className="flex flex-col gap-5">
      <ModelStatus overview={overview} />

      {overview.accounts.length === 0 ? (
        <div className="rounded-2xl p-8 text-center text-sm" style={{ ...card, color: theme.textMuted }}>
          Connectez une Page Facebook ou un compte Instagram pour configurer l'assistant.
        </div>
      ) : (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {overview.accounts.map((a) => {
              const active = a.id === selectedId;
              const Icon = a.platform === "INSTAGRAM" ? Instagram : Facebook;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="flex flex-shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-all"
                  style={{
                    background: active ? theme.bgDark : theme.bgCard,
                    color: active ? "#fff" : theme.text,
                    border: `1px solid ${active ? theme.bgDark : theme.border}`,
                  }}
                >
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                      <Icon size={13} color={a.platform === "INSTAGRAM" ? "#E4405F" : "#1877F2"} />
                    </span>
                  )}
                  {a.name}
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: a.aiEnabled ? theme.gold : active ? "#FFFFFF40" : theme.border }}
                    title={a.aiEnabled ? "IA active" : "IA inactive"}
                  />
                </button>
              );
            })}
          </div>

          {account && (
            <AccountPanel key={account.id} account={account} configured={overview.configured} onSaved={onSaved} />
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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4" style={card}>
      <div className="rounded-xl p-2.5" style={{ background: theme.goldSoft }}>
        <Cpu size={18} style={{ color: theme.goldDark }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: theme.text }}>
          {overview.provider} · <span className="font-normal">{overview.model}</span>
        </p>
        <p className="text-[11px]" style={{ color: theme.textMuted }}>
          Utilisé pour les messages qu'aucune règle à mots-clés ne couvre.
        </p>
      </div>
      {overview.lastError && (
        <p className="flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "#FDECEC", color: theme.red }}>
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          {timeAgo(overview.lastError.at)} : {overview.lastError.message}
        </p>
      )}
    </div>
  );
}

interface PanelProps {
  account: AiAccount;
  configured: boolean;
  onSaved: (a: AiAccount) => void;
}

function AccountPanel({ account, configured, onSaved }: PanelProps) {
  const initial = {
    aiEnabled: account.aiEnabled,
    aiAutoSend: account.aiAutoSend,
    aiChannel: account.aiChannel,
    aiContext: account.aiContext ?? "",
    aiInstructions: account.aiInstructions ?? "",
  };
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

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

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-4 rounded-2xl p-5 lg:col-span-2" style={card}>
        <Title className="text-base">Assistant IA du Compte</Title>

        <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
          <div className="flex-1">
            <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Répondre avec l'IA sur {account.name}</p>
            <p className="text-[11px]" style={{ color: theme.textMuted }}>
              Pour les messages qu'aucune règle à mots-clés ne couvre. Les réponses par défaut « tout message » servent
              de secours si le modèle est indisponible.
            </p>
          </div>
          <Toggle checked={draft.aiEnabled} onChange={(v) => set("aiEnabled", v)} label="Activer l'IA" />
        </div>

        <div className={draft.aiEnabled ? "flex flex-col gap-4" : "pointer-events-none flex flex-col gap-4 opacity-50"}>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold" style={{ color: theme.text }}>Messages traités</p>
            <Segmented options={CHANNELS} value={draft.aiChannel} onChange={(v) => set("aiChannel", v)} />
          </div>

          <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Envoi automatique</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                {draft.aiAutoSend
                  ? "Publiée directement. Réclamations et questions sans réponse restent escaladées vers vous."
                  : "Proposée dans la file d'attente : vous relisez avant l'envoi. Recommandé pour commencer."}
              </p>
            </div>
            <Toggle checked={draft.aiAutoSend} onChange={(v) => set("aiAutoSend", v)} label="Envoi automatique" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Informations sur votre activité</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                L'IA ne répond qu'à partir de ces informations : elle n'invente ni prix, ni stock, ni délai.
              </p>
            </div>
            {!draft.aiContext.trim() && (
              <Button size="sm" variant="soft" onClick={() => set("aiContext", CONTEXT_TEMPLATE)}>Insérer un modèle</Button>
            )}
          </div>
          <textarea
            rows={9}
            maxLength={8000}
            className={inputClass}
            style={inputStyle}
            value={draft.aiContext}
            onChange={(e) => set("aiContext", e.target.value)}
            placeholder={"Produits et prix : panier S 25 000 Ar, panier M 35 000 Ar…\nLivraison : Tana 5 000 Ar sous 48 h…"}
          />
          <div className="mt-1 flex justify-between text-[11px]" style={{ color: theme.textMuted }}>
            <span>
              {draft.aiEnabled && !draft.aiContext.trim() &&
                "Sans ces informations, l'IA restera générique et escaladera les questions précises."}
            </span>
            <span>{draft.aiContext.length} / 8000</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold" style={{ color: theme.text }}>Consignes (optionnel)</p>
          <textarea
            rows={3}
            maxLength={2000}
            className={inputClass}
            style={inputStyle}
            value={draft.aiInstructions}
            onChange={(e) => set("aiInstructions", e.target.value)}
            placeholder="Vouvoyer les clients, ton chaleureux, signer « L'équipe ShopRaphia »…"
          />
        </div>

        {error && <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>}

        <div className="flex items-center justify-end gap-3">
          {dirty ? (
            <span className="text-[11px]" style={{ color: theme.goldDark }}>Modifications non enregistrées</span>
          ) : (
            justSaved && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: theme.goldDark }}>
                <Check size={12} /> Enregistré
              </span>
            )
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </div>

      <AiTester accountId={account.id} configured={configured} aiContext={draft.aiContext} aiInstructions={draft.aiInstructions} />
    </div>
  );
}

interface TesterProps {
  accountId: string;
  configured: boolean;
  aiContext: string;
  aiInstructions: string;
}

// Teste le brouillon en cours (même non enregistré) : rien n'est publié
function AiTester({ accountId, configured, aiContext, aiInstructions }: TesterProps) {
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
      setResult(await aiApi.test({ accountId, text: message, kind, aiContext, aiInstructions }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Test impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={card}>
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={16} style={{ color: theme.gold }} />
        <Title className="text-base">Tester l'Assistant</Title>
      </div>
      <p className="mb-3 text-[11px]" style={{ color: theme.textMuted }}>
        Utilise votre brouillon, même non enregistré. Rien n'est publié.
      </p>

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
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "COMMENT" | "DIRECT")}
            className="flex-1 rounded-xl px-2.5 py-2 text-xs outline-none"
            style={inputStyle}
          >
            <option value="COMMENT">Commentaire public</option>
            <option value="DIRECT">Message privé</option>
          </select>
          <Button type="submit" size="sm" variant="dark" disabled={!configured || loading || !text.trim()}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Tester
          </Button>
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
