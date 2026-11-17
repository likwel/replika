import { useEffect, useState } from "react";
import { IconTile } from "@/components/ui/Dash";
import { AlertTriangle, Bot, Coins, Facebook, Loader2, RefreshCw } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { StatusDot } from "@/components/ui/StatusDot";
import { ApiError } from "@/lib/api";
import { plural } from "@/lib/format";
import { swal } from "@/lib/swal";
import { automationApi, type AutomationSettings } from "@/lib/automation.api";
import { facebookApi } from "@/lib/facebook.api";
import { isPermissionError } from "@/lib/meta";
import { billingApi, repliesLeft, type BillingOverview } from "@/lib/billing.api";
import { BILLING_UPDATED } from "@/lib/payment";
import { replyCredits } from "@/lib/replyCredits";
import { fmtNum } from "@/hooks/usePlan";

interface Props {
  onSynced: () => void;
}

// Bandeau d'état : interrupteur général, solde de réponses et activité du jour, d'un seul coup d'œil
export function AutomationHero({ onSynced }: Props) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [busy, setBusy] = useState<"toggle" | "sync" | null>(null);

  const load = () => automationApi.settings().then(setSettings).catch(() => setSettings(null));
  useEffect(() => {
    void load();
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


  return (
    <section className="overflow-hidden rounded-2xl card-x">
      {/* Interrupteur général */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
        <IconTile icon={Bot} tint={enabled ? "#16a34a" : "#64748B"} size="md" />
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>Réponses automatiques</h2>
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
          <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>
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

      {/* Activité du jour et solde : une seule rangée ; le solde ne devient bannière que s'il faut agir */}
      <div className="flex flex-wrap items-stretch border-t" style={{ borderColor: "var(--line)" }}>
        <Kpi label="envoyées aujourd'hui" value={stats?.autoRepliedToday} />
        <Kpi label="à valider" value={stats?.suggested} tone={stats?.suggested ? "amber" : undefined} />
        <Kpi label="escaladées" value={stats?.escalated} tone={stats?.escalated ? "amber" : undefined} />
        <Kpi label="échecs" value={stats?.failed} tone={stats?.failed ? "red" : undefined} />
        <ReplyBalance />
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

  const healthy = s.active && !empty && !low;
  if (healthy) {
    return (
      <div className="ml-auto flex items-center gap-2 px-5 py-1.5">
        <Coins size={14} className="flex-shrink-0" style={{ color: theme.goldDark }} />
        <span className="text-[12.5px] font-medium" style={{ color: theme.text }}>{text}</span>
        {quota !== null && (
          <button onClick={() => replyCredits.open()} className="text-[12px] font-semibold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>Recharger</button>
        )}
      </div>
    );
  }
  return (
    <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-2 border-t px-5 py-2.5" style={{ borderColor: "var(--line)", background: bg }}>
      <Coins size={16} className="flex-shrink-0" style={{ color: tone }} />
      <p className="min-w-0 flex-1 basis-60 text-[13px] font-medium" style={{ color: empty ? theme.red : theme.text }}>{text}</p>
      {quota !== null && (
        <Button size="sm" variant="primary" icon={Coins} onClick={() => replyCredits.open()}>
          Recharger des réponses
        </Button>
      )}
    </div>
  );
}

// Compteur compact : le chiffre et son libellé sur la même ligne
function Kpi({ label, value, tone }: { label: string; value: number | undefined; tone?: "amber" | "red" }) {
  const color = tone === "red" ? theme.red : tone === "amber" ? theme.amber : theme.text;
  return (
    <div className="flex items-baseline gap-1.5 px-5 py-2.5">
      <span className="tabular text-[17px] font-extrabold tracking-[-0.02em]" style={{ color }}>{value ?? "–"}</span>
      <span className="text-[12px]" style={{ color: theme.textMuted }}>{label}</span>
    </div>
  );
}
