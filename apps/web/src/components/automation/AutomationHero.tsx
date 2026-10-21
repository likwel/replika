import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Bot, Coins, Facebook, Hash, Loader2, MessageSquareDashed, RefreshCw, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { StatusDot } from "@/components/ui/StatusDot";
import { ApiError } from "@/lib/api";
import { plural } from "@/lib/format";
import { swal } from "@/lib/swal";
import { automationApi, type AutomationRule, type AutomationSettings } from "@/lib/automation.api";
import { aiApi, type AiOverview } from "@/lib/ai.api";
import { facebookApi } from "@/lib/facebook.api";
import { isPermissionError } from "@/lib/meta";
import { billingApi, repliesLeft, type BillingOverview } from "@/lib/billing.api";
import { BILLING_UPDATED } from "@/lib/payment";
import { replyCredits } from "@/lib/replyCredits";
import { fmtNum } from "@/hooks/usePlan";

const LANG_LABEL = { AUTO: "langue du client", MG: "malagasy", FR: "français" } as const;

interface Props {
  rules: AutomationRule[];
  onSynced: () => void;
  onOpenAi: () => void;
  onCreateDefault: () => void;
}

// En-tête de l'automatisation : interrupteur général, activité du jour, et chaîne de réponse en 3 étapes
export function AutomationHero({ rules, onSynced, onOpenAi, onCreateDefault }: Props) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [ai, setAi] = useState<AiOverview | null>(null);
  const [busy, setBusy] = useState<"toggle" | "sync" | null>(null);

  const load = () => automationApi.settings().then(setSettings).catch(() => setSettings(null));
  useEffect(() => {
    void load();
    aiApi.overview().then(setAi).catch(() => setAi(null));
  }, []);

  const enabled = settings?.autoReplyEnabled ?? false;
  const stats = settings?.stats;

  const toggle = async (value: boolean) => {
    if (!settings) return;
    if (!value && !(await swal.confirm({ title: "Mettre en pause toutes les réponses automatiques ?", text: "Les nouveaux messages arriveront dans « À traiter » sans réponse, jusqu'à la réactivation.", confirmText: "Mettre en pause", variant: "warning" }))) return;
    setBusy("toggle");
    try {
      setSettings(await automationApi.setEnabled(value));
      swal.toast({ title: value ? "Réponses automatiques activées" : "Réponses automatiques en pause", variant: value ? "success" : "info" });
    } catch (e) {
      swal.toast({ variant: "error", title: "Action impossible", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const r = await automationApi.sync();
      swal.toast({
        variant: "info",
        title: "Synchronisation terminée",
        text: r.initialized
          ? `${plural(r.initialized, "compte initialisé", "comptes initialisés")} : seuls les nouveaux messages seront traités.`
          : r.processed
            ? `${plural(r.processed, "nouveau message traité", "nouveaux messages traités")}.`
            : "Aucun nouveau message.",
      });
      await load();
      onSynced();
    } catch (e) {
      swal.toast({ variant: "error", title: "Synchronisation impossible", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const active = rules.filter((r) => r.isActive);
  const keywordRules = active.filter((r) => r.matchType !== "ANY");
  const defaultRules = active.filter((r) => r.matchType === "ANY");
  const aiAccounts = ai?.accounts.filter((a) => a.aiEnabled) ?? [];
  const languages = [...new Set(aiAccounts.map((a) => a.aiLanguage ?? "AUTO"))];

  return (
    <section className="overflow-hidden rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      {/* Interrupteur général */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: enabled ? theme.greenSoft : theme.bg }}>
          <Bot size={22} style={{ color: enabled ? theme.green : theme.textMuted }} />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold" style={{ color: theme.text }}>Réponses automatiques</h2>
            {settings && (
              <span
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: enabled ? theme.greenSoft : theme.dangerBg, color: enabled ? theme.green : theme.red }}
              >
                <StatusDot color={enabled ? theme.greenLight : theme.red} size={6} pulse={enabled} />
                {enabled ? "En ligne 24h/24" : "En pause"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px]" style={{ color: theme.textMuted }}>
            {!settings
              ? "Chargement…"
              : enabled
                ? "SuiteFlow répond à vos clients en commentaire et en message privé, même la nuit."
                : "Aucune réponse n'est envoyée : les messages attendent dans « À traiter »."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={busy === "sync" ? Loader2 : RefreshCw} onClick={sync} disabled={busy !== null} className={busy === "sync" ? "[&>svg]:animate-spin" : ""}>
            Synchroniser
          </Button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <span className="text-[13px] font-medium" style={{ color: theme.text }}>{enabled ? "Activées" : "Désactivées"}</span>
            <Toggle checked={enabled} onChange={toggle} disabled={!settings || busy !== null} label="Réponses automatiques" />
          </label>
        </div>
      </div>

      <ReplyBalance />

      {/* Activité du jour */}
      <div className="grid grid-cols-2 border-t sm:grid-cols-4" style={{ borderColor: theme.border }}>
        <Kpi i={0} label="Réponses envoyées aujourd'hui" value={stats?.autoRepliedToday} />
        <Kpi i={1} label="Suggestions à valider" value={stats?.suggested} tone={stats?.suggested ? "amber" : undefined} />
        <Kpi i={2} label="Escaladés vers vous" value={stats?.escalated} tone={stats?.escalated ? "amber" : undefined} />
        <Kpi i={3} label="Échecs d'envoi" value={stats?.failed} tone={stats?.failed ? "red" : undefined} />
      </div>

      {/* Chaîne de réponse : ordre réel d'évaluation */}
      <div className="border-t px-5 py-4" style={{ borderColor: theme.border, background: theme.bg }}>
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Comment SuiteFlow choisit sa réponse</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          <Step
            n={1}
            icon={Hash}
            title="Règles à mots-clés"
            ok={keywordRules.length > 0}
            detail={keywordRules.length ? `${plural(keywordRules.length, "règle active", "règles actives")}, par priorité` : "Aucune règle active"}
          />
          <Arrow />
          <Step
            n={2}
            icon={Sparkles}
            title="Assistant IA"
            ok={aiAccounts.length > 0}
            detail={
              !ai
                ? "…"
                : !ai.configured
                  ? "Modèle IA non configuré"
                  : aiAccounts.length
                    ? `${plural(aiAccounts.length, "compte")} · réponses en ${languages.map((l) => LANG_LABEL[l as keyof typeof LANG_LABEL]).join(", ")}`
                    : "Désactivé sur tous les comptes"
            }
            action={<button onClick={onOpenAi} className="text-[12px] font-semibold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>{aiAccounts.length ? "Configurer" : "Activer"}</button>}
          />
          <Arrow />
          <Step
            n={3}
            icon={MessageSquareDashed}
            title="Réponse par défaut"
            ok={defaultRules.length > 0}
            detail={defaultRules.length ? `« ${defaultRules[0].name} »${defaultRules.length > 1 ? ` +${defaultRules.length - 1}` : ""}` : "Aucune : le message reste « À traiter »"}
            action={!defaultRules.length && <button onClick={onCreateDefault} className="text-[12px] font-semibold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>Créer</button>}
          />
        </div>
      </div>

      {/* Relève en échec : sans elle, aucun message n'est vu */}
      {settings && settings.syncIssues.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 border-t px-5 py-3" style={{ borderColor: theme.border, background: theme.dangerBg, color: theme.red }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1 basis-60 text-[13px]">
            <p className="font-semibold">Relève impossible sur {plural(settings.syncIssues.length, "compte")} : aucune réponse ne peut partir</p>
            <p className="mt-0.5 text-[12px]">{settings.syncIssues.map((a) => `${a.name} — ${a.syncError}`).join(" · ")}</p>
          </div>
          {settings.syncIssues.some((a) => isPermissionError(a.syncError)) && (
            <Button size="sm" variant="danger" icon={Facebook} onClick={() => facebookApi.connect()}>Reconnecter</Button>
          )}
        </div>
      )}
    </section>
  );
}

// Réponses IA encore disponibles (quota du mois + crédits achetés), avec la recharge à portée de main
function ReplyBalance() {
  const [data, setData] = useState<BillingOverview | null>(null);
  useEffect(() => {
    const load = () => billingApi.overview().then(setData).catch(() => {});
    void load();
    window.addEventListener(BILLING_UPDATED, load); // recharge confirmée : solde à jour tout de suite
    return () => window.removeEventListener(BILLING_UPDATED, load);
  }, []);
  if (!data || data.subscription.admin) return null;

  const s = data.subscription;
  const { quota, credit } = repliesLeft(data);
  const limit = s.limits.aiReplies;
  const empty = quota === 0 && credit === 0;
  const low = !empty && quota !== null && limit !== null && quota <= limit * 0.1 && credit === 0;
  const tone = empty ? theme.red : low ? theme.amber : theme.goldDark;
  const bg = empty ? theme.dangerBg : low ? theme.amberSoft : theme.goldSoft;

  const text = !s.active
    ? credit > 0
      ? `Abonnement terminé : vos ${fmtNum(credit)} crédits de réponses prennent le relais (1 crédit par réponse envoyée).`
      : "Abonnement terminé et aucun crédit de réponses : plus rien ne part automatiquement."
    : empty
      ? "Quota de réponses IA du mois atteint : les messages pour l'IA attendent dans « À traiter »."
      : [
          quota === null ? "Réponses IA illimitées" : `${fmtNum(quota)} réponse${quota > 1 ? "s" : ""} IA restante${quota > 1 ? "s" : ""} ce mois-ci`,
          credit > 0 ? `+ ${fmtNum(credit)} crédit${credit > 1 ? "s" : ""} achetés` : null,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-5 py-2.5" style={{ borderColor: theme.border, background: bg }}>
      <Coins size={16} className="flex-shrink-0" style={{ color: tone }} />
      <p className="min-w-0 flex-1 basis-60 text-[13px] font-medium" style={{ color: empty ? theme.red : theme.text }}>{text}</p>
      {quota !== null && (
        <Button size="sm" variant={empty || low || !s.active ? "primary" : "ghost"} icon={Coins} onClick={() => replyCredits.open()}>
          Recharger des réponses
        </Button>
      )}
    </div>
  );
}

// Séparateurs : grille 2 × 2 sur mobile, 4 colonnes ensuite
const KPI_BORDERS = ["", "border-l", "border-t sm:border-t-0 sm:border-l", "border-l border-t sm:border-t-0"];

function Kpi({ i, label, value, tone }: { i: number; label: string; value: number | undefined; tone?: "amber" | "red" }) {
  const color = tone === "red" ? theme.red : tone === "amber" ? theme.amber : theme.text;
  return (
    <div className={`px-5 py-3 ${KPI_BORDERS[i]}`} style={{ borderColor: theme.border }}>
      <p className="text-xl font-semibold tabular-nums" style={{ color }}>{value ?? "–"}</p>
      <p className="text-[11.5px]" style={{ color: theme.textMuted }}>{label}</p>
    </div>
  );
}

function Step({ n, icon: Icon, title, detail, ok, action }: { n: number; icon: LucideIcon; title: string; detail: string; ok: boolean; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <span
        className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: ok ? theme.goldSoft : theme.bg, color: ok ? theme.goldDark : theme.textMuted }}
      >
        <Icon size={16} />
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9.5px] font-bold"
          style={{ background: ok ? theme.gold : theme.border, color: ok ? theme.onAccent : theme.textMuted }}
        >
          {n}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{title}</p>
        <p className="text-[12px] leading-snug" style={{ color: theme.textMuted }}>{detail}</p>
        {action && <div className="mt-0.5">{action}</div>}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center md:flex">
      <ArrowRight size={16} style={{ color: theme.textMuted }} />
    </div>
  );
}
