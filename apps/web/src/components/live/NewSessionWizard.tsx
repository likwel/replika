import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Play, Radio, Newspaper, MessageCircle } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { liveApi, type ContactField, type LiveSession, type LiveSettings, type LiveSource } from "@/lib/live.api";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";
import { ProductsEditor } from "./ProductsEditor";
import { SessionSettingsForm } from "./SessionSettingsForm";
import { fromRows, type ProductRow } from "./live";

interface Props {
  onClose: () => void;
  onCreated: (s: LiveSession) => void;
}

const STEPS = ["Source", "Articles", "Messages"] as const;
const LIVE_LABEL: Record<string, { label: string; color: string }> = {
  LIVE: { label: "EN DIRECT", color: "#dc2626" },
  VOD: { label: "Rediffusion", color: "#6b7280" },
  LIVE_STOPPED: { label: "Terminé", color: "#6b7280" },
  SCHEDULED_UNPUBLISHED: { label: "Programmé", color: "#2563eb" },
};

export function NewSessionWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<WsAccount[] | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [sources, setSources] = useState<{ lives: LiveSource[]; posts: LiveSource[]; livesError: string | null; postsError: string | null } | null>(null);
  const [source, setSource] = useState<LiveSource | null>(null);
  const [includeExisting, setIncludeExisting] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspaceApi.accounts().then((list) => {
      setAccounts(list);
      if (list.length === 1) setAccountId(list[0].id);
    });
    liveApi.defaults().then((d) =>
      setSettings({
        title: "",
        keywords: d.keywords,
        requiredFields: d.requiredFields.split(",") as ContactField[],
        autoMessage: true,
        replyPublic: d.replyPublic,
        firstMessage: d.firstMessage,
        missingMessage: d.missingMessage,
        confirmMessage: d.confirmMessage,
        soldOutMessage: d.soldOutMessage,
        recapMessage: d.recapMessage,
        recapUpdateMessage: d.recapUpdateMessage,
        deliveryFee: d.deliveryFee,
      })
    );
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setSources(null);
    setSource(null);
    liveApi
      .sources(accountId)
      .then((s) => {
        setSources(s);
        const live = s.lives.find((l) => l.status === "LIVE");
        if (live) setSource(live); // un live en cours est présélectionné
      })
      .catch((e) => setSources({ lives: [], posts: [], livesError: e instanceof ApiError ? e.message : "Chargement impossible.", postsError: null }));
  }, [accountId]);

  useEffect(() => {
    if (source && settings && !settings.title) setSettings({ ...settings, title: source.title.slice(0, 80) });
  }, [source]);

  const { products, error: productError } = fromRows(rows);
  const canNext = step === 0 ? Boolean(accountId && source) : step === 1 ? !productError : true;

  const create = async () => {
    if (!accountId || !source || !settings) return;
    setSaving(true);
    setError(null);
    try {
      const session = await liveApi.createSession({
        accountId,
        source: { type: source.type, objectId: source.objectId, liveVideoId: source.liveVideoId, permalink: source.permalink, thumbnail: source.thumbnail },
        includeExisting,
        products,
        ...settings,
        title: settings.title.trim() || source.title.slice(0, 80) || "Session live",
      });
      onCreated(session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  const sourceItem = (s: LiveSource) => {
    const on = source?.objectId === s.objectId;
    const badge = s.type === "live" ? (LIVE_LABEL[s.status] ?? { label: s.status, color: "#6b7280" }) : null;
    return (
      <li key={`${s.type}:${s.objectId}`}>
        <button
          type="button"
          onClick={() => setSource(s)}
          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left"
          style={{ background: on ? theme.goldSoft : theme.bg, border: `1px solid ${on ? theme.gold : theme.border}` }}
          aria-pressed={on}
        >
          <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: theme.border }}>
            {s.thumbnail ? <img src={s.thumbnail} alt="" className="h-full w-full object-cover" /> : s.type === "live" ? <Radio size={18} style={{ color: theme.textMuted }} /> : <Newspaper size={18} style={{ color: theme.textMuted }} />}
            {s.type === "live" && <Play size={14} className="absolute" fill="#fff" color="#fff" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {badge && (
                <span className="rounded px-1.5 text-[9px] font-bold text-white" style={{ background: badge.color }}>{badge.label}</span>
              )}
              <span className="truncate text-sm font-medium" style={{ color: theme.text }}>{s.title}</span>
            </span>
            <span className="flex items-center gap-2 text-[11px]" style={{ color: theme.textMuted }}>
              {s.createdAt && timeAgo(s.createdAt)}
              {s.comments !== undefined && <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {s.comments}</span>}
            </span>
          </span>
          {on && <Check size={16} style={{ color: theme.goldDark }} />}
        </button>
      </li>
    );
  };

  return (
    <Modal
      title="Nouvelle Session Live"
      subtitle={
        <span className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <span key={s} className="flex items-center gap-1" style={{ color: i === step ? theme.goldDark : theme.textMuted, fontWeight: i === step ? 600 : 400 }}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]" style={{ background: i <= step ? theme.gold : theme.border, color: "#1A1410" }}>
                {i < step ? <Check size={9} /> : i + 1}
              </span>
              {s}
            </span>
          ))}
        </span>
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          {(error || (step === 1 && productError)) && (
            <p className="mr-auto flex items-center gap-1 text-xs" style={{ color: theme.red }}><AlertTriangle size={12} /> {error ?? productError}</p>
          )}
          {step > 0 && <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Retour</Button>}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Continuer <ArrowRight size={15} />
            </Button>
          ) : (
            <Button size="sm" onClick={create} disabled={saving || !settings}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />} Démarrer la capture
            </Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Page ou compte</p>
            <div className="flex flex-wrap gap-2">
              {(accounts ?? []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium"
                  style={{ background: accountId === a.id ? theme.goldSoft : theme.bg, border: `1px solid ${accountId === a.id ? theme.gold : theme.border}`, color: theme.text }}
                >
                  <AccountAvatar name={a.accountName} src={a.accountAvatar} platform={a.platform} size={24} />
                  {a.accountName}
                </button>
              ))}
              {accounts === null && <div className="h-8 w-48 animate-pulse rounded-full" style={{ background: theme.bg }} />}
            </div>
          </div>

          {accountId && (
            sources === null ? (
              <p className="flex items-center gap-2 text-sm" style={{ color: theme.textMuted }}><Loader2 size={14} className="animate-spin" /> Recherche des lives et publications…</p>
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Vidéos en direct</p>
                  {sources.livesError && <p className="mb-2 text-xs" style={{ color: theme.red }}>{sources.livesError}</p>}
                  {sources.lives.length ? (
                    <ul className="flex flex-col gap-2">{sources.lives.map(sourceItem)}</ul>
                  ) : (
                    !sources.livesError && (
                      <p className="rounded-xl px-3 py-3 text-sm" style={{ background: theme.bg, color: theme.textMuted }}>
                        Aucun live pour l'instant. Lancez votre live sur Facebook puis actualisez, ou choisissez une publication ci-dessous.
                      </p>
                    )
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Ou une publication (vente par commentaires)</p>
                  {sources.postsError && <p className="mb-2 text-xs" style={{ color: theme.red }}>{sources.postsError}</p>}
                  <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">{sources.posts.map(sourceItem)}</ul>
                </div>
              </>
            )
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: theme.textMuted }}>
            Facultatif : avec un catalogue, le nom et le prix de l'article sont repris dans le message au client, et le stock est
            suivi (liste d'attente quand il est épuisé).
          </p>
          <ProductsEditor rows={rows} onChange={setRows} />
        </div>
      )}

      {step === 2 && settings && (
        <div className="flex flex-col gap-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Nom de la session</span>
            <input
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
            />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl p-3" style={{ background: theme.goldSoft }}>
            <span>
              <span className="block text-sm font-medium" style={{ color: theme.text }}>Traiter aussi les commentaires déjà publiés</span>
              <span className="block text-xs" style={{ color: theme.textMuted }}>
                Utile si le live a commencé avant la session. Sinon, seuls les nouveaux commentaires comptent.
              </span>
            </span>
            <Toggle checked={includeExisting} onChange={setIncludeExisting} label="Commentaires déjà publiés" />
          </label>
          <SessionSettingsForm value={settings} onChange={setSettings} products={products} />
        </div>
      )}
    </Modal>
  );
}
