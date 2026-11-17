import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Coins, Gauge, Loader2, Mail, RefreshCw, RotateCcw, Save, Sparkles } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Panel, SkeletonCards } from "@/components/ui/Dash";
import { StatCard } from "@/components/ui/StatCard";
import { swal } from "@/lib/swal";
import { adminApi, type AiUsageReport, type AiUsageSettings } from "@/lib/admin.api";
import { ColumnChart } from "./Charts";

const fmt = (n: number) => n.toLocaleString("fr-FR");
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M` : n >= 10_000 ? `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : fmt(n));
const usd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })} $`;
const PERIODS = [{ days: 7, label: "7 jours" }, { days: 30, label: "30 jours" }, { days: 90, label: "90 jours" }];

// Suivi des tokens du modèle IA : entrée, sortie, cache, coût estimé, limite mensuelle et alertes par e-mail aux administrateurs
export function AiTokens() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<AiUsageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .aiUsage(days)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);
  useEffect(load, [load]);

  if (error && !report) return <Alert variant="error">{error}</Alert>;
  if (!report) return <SkeletonCards count={4} height={104} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />;
  const r = report;
  const s = r.settings;

  return (
    <Panel
      title="Consommation du modèle IA"
      subtitle={`${r.model} · tokens, coût estimé et limite mensuelle`}
      icon={Gauge}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="radiogroup" aria-label="Période">
            {PERIODS.map((p) => (
              <button key={p.days} role="radio" aria-checked={p.days === days} onClick={() => setDays(p.days)} className={`seg-b ${p.days === days ? "on" : ""}`}>{p.label}</button>
            ))}
          </div>
          <Button size="sm" variant="ghost" icon={loading ? Loader2 : RefreshCw} onClick={load} disabled={loading} className={loading ? "[&>svg]:animate-spin" : ""}>Actualiser</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
        <Budget r={r} />

        {!r.pricesSet && (
          <Alert variant="warning" icon={AlertTriangle}>
            Les prix du modèle ne sont pas renseignés : les tokens sont comptés, mais le coût reste à 0. Saisissez les prix du fournisseur (en dollars par million de tokens) ci-dessous.
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Sparkles} label={`Appels · ${days} j`} value={fmt(r.totals.calls)} color="#f05a1a" />
          <StatCard icon={ArrowUpFromLine} label="Tokens d'entrée" value={compact(r.totals.inputTokens)} detail={`${fmt(r.totals.inputTokens)} au total`} color="#3B82F6" />
          <StatCard icon={ArrowDownToLine} label="Tokens de sortie" value={compact(r.totals.outputTokens)} detail={`${fmt(r.totals.outputTokens)} au total`} color="#8B5CF6" />
          <StatCard icon={Coins} label="Coût estimé" value={usd(r.totals.costUsd)} detail={`≈ ${fmt(Math.round(r.totals.costUsd * s.usdToAr))} Ar`} color="#10B981" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ColumnChart title="Tokens par jour" subtitle="Entrée + sortie" data={r.daily.map((d) => ({ date: d.day, value: d.inputTokens + d.outputTokens }))} format={fmt} icon={Sparkles} tint="#3B82F6" loading={loading} integer />
          <ColumnChart title="Coût par jour" subtitle="En dollars, estimé avec vos prix" data={r.daily.map((d) => ({ date: d.day, value: Math.round(d.costUsd * 100) / 100 }))} format={usd} icon={Coins} tint="#10B981" loading={loading} />
        </div>

        <ByModel r={r} />
        <Settings r={r} onSaved={(next) => setReport(next)} />
      </div>
    </Panel>
  );
}

// Mois en cours : part de la limite consommée, avec le seuil d'alerte
function Budget({ r }: { r: AiUsageReport }) {
  const s = r.settings;
  const m = r.month;
  const hasLimit = Boolean(s.monthlyBudgetUsd || s.monthlyTokenLimit);
  const pct = m.percent;
  const tone = pct === null ? theme.textMuted : pct >= 100 ? theme.red : pct >= s.alertPercent ? theme.amber : theme.green;
  const label = new Date(`${m.key}-15`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold capitalize" style={{ color: theme.text }}>{label}</p>
        {pct !== null ? (
          <p className="text-[22px] font-extrabold tabular-nums" style={{ color: tone }}>{Math.round(pct)} %<span className="ml-1 text-[12px] font-medium" style={{ color: theme.textMuted }}>de la limite</span></p>
        ) : (
          <p className="text-[12.5px]" style={{ color: theme.textMuted }}>Aucune limite définie</p>
        )}
      </div>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct ?? 0))} aria-label="Part de la limite mensuelle consommée">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: pct !== null && pct >= 100 ? "linear-gradient(90deg,#f59e0b,#dc2626)" : pct !== null && pct >= s.alertPercent ? "#f59e0b" : "#22C55E" }} />
        {hasLimit && <span className="absolute top-0 h-full w-0.5" style={{ left: `${s.alertPercent}%`, background: "rgba(0,0,0,0.35)" }} title={`Alerte e-mail à ${s.alertPercent} %`} aria-hidden />}
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: theme.textMuted }}>
        {fmt(m.inputTokens + m.outputTokens)} tokens · {usd(m.costUsd)}
        {s.monthlyBudgetUsd ? ` sur ${usd(s.monthlyBudgetUsd)}` : ""}
        {s.monthlyTokenLimit ? ` · limite ${fmt(s.monthlyTokenLimit)} tokens` : ""}
      </p>
      <p className="mt-1.5 flex items-start gap-1.5 text-[12px]" style={{ color: m.alertLevelSent ? theme.amber : theme.textMuted }}>
        {m.alertLevelSent ? <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> : <Mail size={13} className="mt-0.5 flex-shrink-0" />}
        {m.alertLevelSent
          ? `E-mail d'alerte envoyé aux administrateurs (seuil de ${m.alertLevelSent} %).`
          : hasLimit
            ? `Un e-mail part aux administrateurs à ${s.alertPercent} %, puis à 100 % de la limite.`
            : "Définissez un budget ou une limite de tokens pour recevoir une alerte par e-mail."}
      </p>
    </div>
  );
}

function ByModel({ r }: { r: AiUsageReport }) {
  if (r.byModel.length === 0) {
    return <p className="rounded-xl px-4 py-6 text-center text-[13px]" style={{ background: "var(--surface-2)", color: theme.textMuted }}>Aucun appel au modèle enregistré sur la période. Le suivi démarre à la prochaine réponse IA.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--line)" }}>
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead style={{ background: "var(--surface-2)", color: theme.textMuted }}>
          <tr>{["Modèle", "Appels", "Entrée", "dont cache", "Sortie", "dont raisonnement", "Coût"].map((h) => <th key={h} className="px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide">{h}</th>)}</tr>
        </thead>
        <tbody>
          {r.byModel.map((m) => (
            <tr key={m.model} style={{ borderTop: "1px solid var(--line)", color: theme.text }}>
              <td className="px-3 py-2 font-semibold">{m.model}</td>
              <td className="px-3 py-2 tabular-nums">{fmt(m.calls)}</td>
              <td className="px-3 py-2 tabular-nums">{fmt(m.inputTokens)}</td>
              <td className="px-3 py-2 tabular-nums" style={{ color: theme.textMuted }}>{fmt(m.cachedTokens)}</td>
              <td className="px-3 py-2 tabular-nums">{fmt(m.outputTokens)}</td>
              <td className="px-3 py-2 tabular-nums" style={{ color: theme.textMuted }}>{fmt(m.reasoningTokens)}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{usd(m.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FIELDS: Array<{ id: keyof AiUsageSettings; label: string; hint: string; unit: string; optional?: boolean }> = [
  { id: "inputPerM", label: "Prix d'entrée", hint: "par million de tokens", unit: "$" },
  { id: "outputPerM", label: "Prix de sortie", hint: "par million de tokens", unit: "$" },
  { id: "cachedPerM", label: "Prix du cache", hint: "facultatif : sinon prix d'entrée", unit: "$", optional: true },
  { id: "usdToAr", label: "Taux de change", hint: "ariary pour 1 dollar", unit: "Ar" },
  { id: "monthlyBudgetUsd", label: "Budget mensuel", hint: "vide : pas de limite en dollars", unit: "$", optional: true },
  { id: "monthlyTokenLimit", label: "Limite de tokens", hint: "vide : pas de limite en tokens", unit: "tokens", optional: true },
  { id: "alertPercent", label: "Alerte e-mail à", hint: "puis une 2e alerte à 100 %", unit: "%" },
];

// Prix, taux de change, limite mensuelle et seuil d'alerte (enregistrés côté serveur, valeurs du .env au départ)
function Settings({ r, onSaved }: { r: AiUsageReport; onSaved: (r: AiUsageReport) => void }) {
  const toDraft = (s: AiUsageSettings) => Object.fromEntries(FIELDS.map((f) => [f.id, s[f.id] === null ? "" : String(s[f.id]).replace(".", ",")])) as Record<keyof AiUsageSettings, string>;
  const [draft, setDraft] = useState(() => toDraft(r.settings));
  const [busy, setBusy] = useState<"save" | "reset" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(toDraft(r.settings)), [r.settings]);

  const parse = (): AiUsageSettings | string => {
    const out: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = draft[f.id].replace(",", ".").trim();
      if (raw === "") {
        if (!f.optional) return `${f.label} : valeur requise.`;
        out[f.id] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return `${f.label} : nombre invalide.`;
      out[f.id] = n;
    }
    if ((out.usdToAr as number) <= 0) return "Taux de change : doit être supérieur à 0.";
    if ((out.alertPercent as number) < 1 || (out.alertPercent as number) > 99) return "Alerte e-mail : entre 1 et 99 %.";
    return out as unknown as AiUsageSettings;
  };

  const save = async (settings: AiUsageSettings | null) => {
    setBusy(settings ? "save" : "reset");
    setError(null);
    try {
      onSaved(await adminApi.saveAiUsageSettings(settings));
      swal.toast({ title: settings ? "Limites et prix enregistrés" : "Valeurs du serveur rétablies" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const t = await adminApi.testAiAlert();
      swal.toast({ title: "E-mail d'essai envoyé", text: `À ${t.to} : vérifiez la boîte de réception.` });
    } catch (e) {
      swal.toast({ variant: "error", title: "Envoi impossible", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const parsed = parse();
  const field = (f: (typeof FIELDS)[number]): ReactNode => (
    <label key={f.id} className="block">
      <span className="mb-1 block text-[12.5px] font-semibold" style={{ color: theme.text }}>{f.label}</span>
      <span className="relative block">
        <input
          inputMode="decimal"
          value={draft[f.id]}
          onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value }))}
          placeholder={f.optional ? "—" : "0"}
          className="field-in h-10 w-full rounded-xl pl-3 pr-14 text-[13px] font-medium tabular-nums outline-none"
          style={{ border: 0 }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: theme.textMuted }}>{f.unit}</span>
      </span>
      <span className="mt-0.5 block text-[11px]" style={{ color: theme.textMuted }}>{f.hint}</span>
    </label>
  );

  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--line)" }}>
      <p className="mb-0.5 text-[13.5px] font-bold" style={{ color: theme.text }}>Prix, limite et alertes</p>
      <p className="mb-3 text-[12px]" style={{ color: theme.textMuted }}>
        Le coût est estimé avec ces prix (tokens × tarif du fournisseur). Quand la consommation du mois atteint le seuil, tous les administrateurs reçoivent un e-mail, une fois par seuil et par mois.
      </p>
      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{FIELDS.map(field)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" icon={busy === "save" ? Loader2 : Save} disabled={typeof parsed === "string" || busy !== null} onClick={() => typeof parsed !== "string" && void save(parsed)} className={busy === "save" ? "[&>svg]:animate-spin" : ""}>Enregistrer</Button>
        <Button size="sm" variant="ghost" icon={busy === "test" ? Loader2 : Mail} disabled={busy !== null} onClick={() => void test()} className={busy === "test" ? "[&>svg]:animate-spin" : ""}>Envoyer un e-mail d'essai</Button>
        {r.customSettings && <Button size="sm" variant="ghost" icon={RotateCcw} disabled={busy !== null} onClick={() => void save(null)}>Rétablir les valeurs du serveur</Button>}
        {typeof parsed === "string" ? (
          <span className="flex items-center gap-1 text-[12px]" style={{ color: theme.amber }}><AlertTriangle size={13} /> {parsed}</span>
        ) : (
          <span className="flex items-center gap-1 text-[12px]" style={{ color: theme.textMuted }}><CheckCircle2 size={13} /> {r.customSettings ? "Valeurs personnalisées" : "Valeurs du serveur (.env)"}</span>
        )}
      </div>
    </div>
  );
}
