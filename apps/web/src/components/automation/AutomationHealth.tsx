import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Facebook, Loader2, Plus, Power, RefreshCw, Sparkles, X, Activity, Zap } from "lucide-react";
import { theme } from "@/theme";
import { CardTitle } from "@/components/ui/Dash";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusDot } from "@/components/ui/StatusDot";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ReconnectDialog } from "@/components/connections/ReconnectDialog";
import { accountApi } from "@/lib/account.api";
import { aiApi, type AiAccount } from "@/lib/ai.api";
import { swal } from "@/lib/swal";
import { automationApi, type Diagnostic, type HealthCheck } from "@/lib/automation.api";

interface Props {
  onCreateRule: (channel: "COMMENT" | "DIRECT") => void;
  onOpenAi: () => void;
  refreshKey?: number; // règles modifiées : nouveau diagnostic
}

type Status = "ok" | "warning" | "blocked";
type Account = Diagnostic["accounts"][number];

const STATUS: Record<Status, { label: string; chip: string }> = {
  ok: { label: "Opérationnel", chip: "ok" },
  warning: { label: "À compléter", chip: "warn" },
  blocked: { label: "Bloqué", chip: "bad" },
};
const ORDER: Record<Status, number> = { blocked: 0, warning: 1, ok: 2 };

const ACTION_LABEL: Record<NonNullable<HealthCheck["action"]>, { label: string; icon: typeof Plus }> = {
  reconnect: { label: "Reconnecter", icon: Facebook },
  create_rule: { label: "Créer une règle", icon: Plus },
  enable_ai: { label: "Activer l'IA", icon: Sparkles },
  activate: { label: "Activer", icon: Power },
  resume: { label: "Reprendre", icon: Power },
};

// Pastille ronde d'état : vert plein pour ce qui est terminé, ambre à compléter, rouge bloqué
function StateIcon({ state }: { state: "ok" | "warn" | "bad" }) {
  if (state === "ok") return <span className="tr-ico ok-solid"><Check strokeWidth={3} /></span>;
  if (state === "warn") return <span className="tr-ico warn"><AlertTriangle /></span>;
  return <span className="tr-ico bad"><X strokeWidth={2.6} /></span>;
}
const checkState = (c: HealthCheck): "ok" | "warn" | "bad" => (c.ok && !c.warn ? "ok" : c.ok ? "warn" : "bad");
const accountState = (s: Status): "ok" | "warn" | "bad" => (s === "ok" ? "ok" : s === "warning" ? "warn" : "bad");

// Ce qui empêche réellement une réponse automatique, compte par compte ; le détail d'un compte s'ouvre dans une fenêtre
export function AutomationHealth({ onCreateRule, onOpenAi, refreshKey }: Props) {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null); // compte dont la fenêtre est ouverte
  const [reconnect, setReconnect] = useState<string | null | undefined>(undefined);
  const [aiAccounts, setAiAccounts] = useState<AiAccount[]>([]); // réglages IA de chaque compte, pour les activations rapides
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    return automationApi
      .diagnostic()
      .then(setDiag)
      .catch(() => setDiag(null))
      .finally(() => setLoading(false));
  };

  const loadAi = () => aiApi.overview().then((o) => setAiAccounts(o.accounts)).catch(() => undefined);
  useEffect(() => {
    void load();
    void loadAi();
  }, [refreshKey]);

  const act = async (check: HealthCheck, accountId: string, name: string) => {
    if (check.action === "reconnect") {
      setSelected(null);
      setReconnect(name);
    } else if (check.action === "create_rule") {
      setSelected(null);
      onCreateRule(check.id === "direct" ? "DIRECT" : "COMMENT");
    } else if (check.action === "enable_ai") {
      setSelected(null);
      onOpenAi();
    } else if (check.action === "activate") {
      await accountApi.toggle(accountId, true);
      void load();
    }
  };

  // Activations rapides, directement depuis la fenêtre d'un compte : l'assistant IA sur le canal concerné, ou son envoi automatique
  const quick = async (kind: "ai" | "autosend", check: HealthCheck, accountId: string, name: string) => {
    const channel = check.id === "direct" ? "DIRECT" : "COMMENT";
    const ai = aiAccounts.find((a) => a.id === accountId);
    setBusy(`${check.id}:${kind}`);
    try {
      if (kind === "ai") {
        // Le canal doit être couvert : si l'assistant ne traitait que l'autre canal, on passe à « tout »
        const aiChannel = ai?.aiEnabled && ai.aiChannel !== "ALL" && ai.aiChannel !== channel ? "ALL" : ai?.aiEnabled ? ai.aiChannel : channel === "DIRECT" ? "DIRECT" : "ALL";
        await aiApi.updateAccount(accountId, { aiEnabled: true, aiChannel });
        swal.toast({ title: "Assistant IA activé", text: `${name} : les ${channel === "DIRECT" ? "messages privés" : "commentaires"} reçoivent une réponse proposée par l'IA.` });
      } else {
        await aiApi.updateAccount(accountId, { aiAutoSend: true });
        swal.toast({ title: "Envoi automatique activé", text: `${name} : les réponses de l'assistant partent sans validation.` });
      }
      await Promise.all([load(), loadAi()]);
    } catch (e) {
      swal.toast({ variant: "error", title: "Activation impossible", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  if (!diag) {
    return <div className="sk h-40 !rounded-2xl" />;
  }

  const accounts = [...diag.accounts].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const working = accounts.filter((a) => a.status === "ok").length;
  const blocked = accounts.filter((a) => a.status === "blocked");
  const current: Account | undefined = accounts.find((a) => a.id === selected);

  return (
    <div className="flex flex-col rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${blocked.length ? `${theme.red}40` : theme.border}` }}>
      <CardTitle
        title="État de chaque compte"
        subtitle="Ce qui permet, ou empêche, les réponses automatiques."
        icon={Activity}
        tint={blocked.length ? "#be123c" : "#16a34a"}
        action={
          <button onClick={() => void load()} className="rounded-lg p-1.5 hover:bg-black/5" title="Relancer le diagnostic" aria-label="Relancer le diagnostic">
            {loading ? <Loader2 size={15} className="animate-spin" style={{ color: theme.textMuted }} /> : <RefreshCw size={15} style={{ color: theme.textMuted }} />}
          </button>
        }
      />

      <p className="text-sm" style={{ color: theme.text }}>
        {accounts.length === 0
          ? "Aucun compte associé : ajoutez vos Pages depuis Connexions."
          : working === accounts.length
            ? "Tout est prêt : les nouveaux commentaires et messages reçoivent une réponse automatique."
            : `${working} compte${working > 1 ? "s" : ""} sur ${accounts.length} répond${working > 1 ? "ent" : ""} automatiquement.${blocked.length ? ` ${blocked.length} bloqué${blocked.length > 1 ? "s" : ""} : Facebook ne donne plus l'accès.` : ""}`}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
        <span className={`chip ${diag.autoReplyEnabled ? "ok" : "bad"}`}>
          <StatusDot color={diag.autoReplyEnabled ? theme.green : theme.red} size={6} pulse={diag.autoReplyEnabled} />
          Réponses automatiques {diag.autoReplyEnabled ? "en ligne" : "en pause"}
        </span>
        <span className="chip off">{diag.sync.mode === "webhook" ? "Réception instantanée (webhooks)" : `Relève toutes les ${diag.sync.pollSeconds} s`}</span>
        <span className={`chip ${diag.ai.configured ? "off" : "warn"}`}>{diag.ai.configured ? `IA : ${diag.ai.provider}` : "IA non configurée (clé gratuite : AI_API_KEY)"}</span>
        <span className="chip off">
          {diag.rules.active} règle{diag.rules.active > 1 ? "s" : ""} active{diag.rules.active > 1 ? "s" : ""} · {diag.rules.autoSend} en envoi auto
        </span>
      </div>

      {diag.brokenRules.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: theme.amberSoft, color: theme.amber }}>
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <span>
            {diag.brokenRules.map((r) => `« ${r.name} » ne vise que ${r.account}`).join(" · ")} — ce compte n'est plus utilisable : la règle ne se
            déclenchera pas. Reconnectez-le, ou modifiez la règle pour « Tous les comptes ».
          </span>
        </p>
      )}

      {/* Une ligne par compte : l'état en un coup d'œil, le détail dans une fenêtre */}
      {accounts.length > 0 && (
        <ul className="mt-4 flex max-h-[340px] flex-col gap-2 overflow-y-auto">
          {accounts.map((a) => {
            const failing = a.checks.filter((c) => !c.ok || c.warn);
            return (
              <li key={a.id}>
                <button onClick={() => setSelected(a.id)} className="row-s w-full text-left" aria-haspopup="dialog" aria-label={`Voir l'état de ${a.name}`}>
                  <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={34} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{a.name}</b>
                    <small className="block truncate text-[12px]" style={{ color: theme.textMuted }}>
                      {failing.length ? failing[0].detail : "Relève, autorisations et réponses : tout fonctionne."}
                    </small>
                  </span>
                  <StateIcon state={accountState(a.status)} />
                  <ChevronRight size={15} className="flex-shrink-0" style={{ color: theme.textMuted }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {current && (
        <Modal
          title="État du compte"
          subtitle={current.name}
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button variant="ghost" size="sm" icon={loading ? Loader2 : RefreshCw} onClick={() => void load()} disabled={loading} className={loading ? "[&>svg]:animate-spin" : ""}>
                Relancer le diagnostic
              </Button>
              <Button icon={X} size="sm" onClick={() => setSelected(null)}>Fermer</Button>
            </>
          }
        >
          <div className="row-s !gap-3.5 !p-3.5">
            <AccountAvatar name={current.name} src={current.avatarUrl} platform={current.platform} size={44} />
            <div className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-bold" style={{ color: theme.text }}>{current.name}</b>
              <small className="block text-[12.5px]" style={{ color: theme.textMuted }}>
                {current.checks.filter((c) => c.ok && !c.warn).length} contrôle{current.checks.length > 1 ? "s" : ""} réussi{current.checks.filter((c) => c.ok && !c.warn).length > 1 ? "s" : ""} sur {current.checks.length}
              </small>
            </div>
            <span className={`chip ${STATUS[current.status].chip} flex-shrink-0`}>{STATUS[current.status].label}</span>
          </div>

          <ul className="stagger mt-3 flex flex-col gap-2">
            {current.checks.map((c) => {
              const action = c.action ? ACTION_LABEL[c.action] : null;
              const todo = !c.ok || c.warn;
              const isCoverage = c.id === "comments" || c.id === "direct";
              const ai = aiAccounts.find((a) => a.id === current.id);
              return (
                <li key={c.id} className="row-s flex-wrap !items-start">
                  <StateIcon state={checkState(c)} />
                  <div className="min-w-0 flex-1 basis-48">
                    <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{c.label}</b>
                    <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{c.detail}</small>
                  </div>
                  {todo && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Réponse non couverte : activer l'assistant IA, ou écrire une règle */}
                      {isCoverage && !c.ok && (
                        <Button size="sm" variant="primary" icon={Sparkles} disabled={busy !== null} onClick={() => void quick("ai", c, current.id, current.name)}>
                          Activer l'assistant IA
                        </Button>
                      )}
                      {/* Réponses préparées mais pas envoyées : activer l'envoi automatique de l'assistant */}
                      {isCoverage && c.ok && c.warn && ai?.aiEnabled && !ai.aiAutoSend && (
                        <Button size="sm" variant="primary" icon={Zap} disabled={busy !== null} onClick={() => void quick("autosend", c, current.id, current.name)}>
                          Activer l'envoi auto
                        </Button>
                      )}
                      {isCoverage && c.ok && c.warn && !ai?.aiEnabled && (
                        <Button size="sm" variant="primary" icon={Sparkles} disabled={busy !== null} onClick={() => void quick("ai", c, current.id, current.name)}>
                          Activer l'assistant IA
                        </Button>
                      )}
                      {action && (
                        <Button size="sm" variant={c.action === "reconnect" ? "danger" : isCoverage ? "ghost" : "soft"} icon={action.icon} onClick={() => void act(c, current.id, current.name)}>
                          {action.label}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      )}

      {reconnect !== undefined && <ReconnectDialog accountName={reconnect ?? undefined} onClose={() => setReconnect(undefined)} />}
    </div>
  );
}
