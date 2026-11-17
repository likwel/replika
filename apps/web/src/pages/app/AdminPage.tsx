import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import { Navigate, useOutletContext } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Bot, CalendarClock, CheckCircle2, Clock, Coins, CreditCard, Gift, Hourglass, Languages, Loader2, Ban, LogOut, Mail, ShieldOff, MessageCircle, MoreHorizontal, PauseCircle, Percent, PiggyBank, PlayCircle, Copy, ChevronRight, RotateCcw, UserX, Plug, Plus, Receipt, Repeat, Trash2, Radio, RefreshCw, Search, ShieldCheck, Smartphone, Sparkles, TrendingUp, UserPlus, Users, Wallet, XCircle, Save, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { BarList, ColumnChart, Sparkline } from "@/components/admin/Charts";
import { FilterChips } from "@/components/workspace/WorkspaceUi";
import { CardTitle, Hero, Panel as DashPanel, SkeletonCards } from "@/components/ui/Dash";
import { StatCard } from "@/components/ui/StatCard";
import { FloatingMenu, MenuItem, MenuSeparator } from "@/components/ui/FloatingMenu";
import {
  EXPENSE_LABELS, adminApi, type AccountFilter, type AccountState, type AdminOverview, type AdminPayment, type AdminStatus, type AdminUser,
  type Expense, type ExpenseCategory, type FeeMethod, type FeeRates, type FeeSettings, type ModerationAction,
} from "@/lib/admin.api";
import { PAYMENT_METHOD_LABEL, fmtHours, type PaymentStatus } from "@/lib/billing.api";
import { fmtAr, fmtDate, fmtNum } from "@/hooks/usePlan";
import { plural, timeAgo } from "@/lib/format";
import { swal } from "@/lib/swal";
import { contactApi, type ContactMessage } from "@/lib/contact.api";
import type { PlanId } from "@/data/plans";

interface Ctx { sub: number; setSub: (i: number) => void }

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 365, label: "12 mois" },
];

const STATUS_META: Record<AdminStatus, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  ACTIVE: { label: "Actif", icon: CheckCircle2, color: theme.green, bg: theme.greenSoft },
  TRIAL: { label: "Essai", icon: Hourglass, color: theme.amber, bg: theme.amberSoft },
  EXPIRED: { label: "Expiré", icon: XCircle, color: theme.red, bg: theme.dangerBg },
};

const PAY_STATUS: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  PAID: { label: "Payé", color: theme.green, bg: theme.greenSoft },
  PENDING: { label: "En attente", color: theme.amber, bg: theme.amberSoft },
  FAILED: { label: "Échoué", color: theme.red, bg: theme.dangerBg },
  EXPIRED: { label: "Expiré", color: theme.textMuted, bg: theme.bg },
};

const LANG_LABEL: Record<string, string> = { AUTO: "Langue du client", MG: "Malagasy", FR: "Français" };
const pct = (n: number) => `${Math.round(n * 100)} %`;

const DESCRIPTIONS = [
  "Suivi de la plateforme : inscriptions, encaissements et activité de vos clients.",
  "Tous les comptes SuiteFlow, leur formule, leur consommation et ce qu'ils ont payé.",
  "Tous les paiements : montant brut, commission et net encaissé, numéro du payeur.",
  "Vos dépenses (hébergement, IA, marketing…) : elles sont déduites du bénéfice.",
  "Modèle IA, consommation, coûts estimés et état des services.",
  "Demandes reçues par le formulaire « Nous contacter » (site et application).",
];

// Tableau de bord administrateur : réservé au rôle ADMIN (le premier compte inscrit)
export function AdminPage() {
  const { user } = useAuth();
  const { sub, setSub } = useOutletContext<Ctx>();
  const [days, setDays] = useState(30);
  const ov = useOverview(days, sub === 0 && user?.role === "ADMIN");
  if (user?.role !== "ADMIN") return <Navigate to="/app" replace />;
  // Pastille sur l'onglet qui demande une action : paiements à suivre, échecs de l'IA
  const d = ov.data;
  const badges = d ? { 2: d.revenue.failed + d.revenue.pending.count, 4: d.ai.failures24h + (d.ai.configured ? 0 : 1) } : undefined;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        description={DESCRIPTIONS[sub] ?? DESCRIPTIONS[0]}
        badges={badges}
        actions={
          sub === 0 ? (
            <>
              <PeriodPicker value={days} onChange={setDays} />
              <Button size="sm" variant="ghost" icon={ov.loading ? Loader2 : RefreshCw} onClick={ov.reload} disabled={ov.loading} className={ov.loading ? "[&>svg]:animate-spin" : ""}>
                Actualiser
              </Button>
            </>
          ) : undefined
        }
      />
      {sub === 1 ? <UsersView /> : sub === 2 ? <PaymentsView /> : sub === 3 ? <ExpensesView /> : sub === 4 ? <AiView /> : sub === 5 ? <MessagesView /> : <OverviewView days={days} ov={ov} go={setSub} />}
    </div>
  );
}

// ─── Briques ─────────────────────────────────────────────────────────────────

// Couleur de la tuile d'icône selon le sujet (palette des modules de l'application)
const TINT = new Map<LucideIcon, string>([
  [Users, "#3B82F6"], [Plug, "#3B82F6"], [TrendingUp, "#10B981"], [BadgeCheck, "#8B5CF6"], [CreditCard, "#F59E0B"], [Smartphone, "#06B6D4"],
  [Sparkles, "#f05a1a"], [Wallet, "#f05a1a"], [Coins, "#F59E0B"], [Receipt, "#10B981"], [AlertTriangle, "#F59E0B"], [Clock, "#06B6D4"],
  [MessageCircle, "#8B5CF6"], [Languages, "#06B6D4"], [ShieldCheck, "#6366F1"], [UserPlus, "#3B82F6"],
]);

function Stat({ icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail?: ReactNode; tone?: "warn" | "bad" }) {
  return <StatCard icon={icon} label={label} value={value} detail={detail} tone={tone} color={TINT.get(icon) ?? "#f05a1a"} />;
}

function Panel({ title, subtitle, icon, children, action }: { title: string; subtitle?: ReactNode; icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <DashPanel title={title} subtitle={subtitle} icon={icon} tint={icon ? TINT.get(icon) : undefined} action={action}>
      {children}
    </DashPanel>
  );
}

// Choix de période : contrôle segmenté (piste en creux, choix en relief)
function PeriodPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Période">
      {PERIODS.map((p) => {
        const on = p.days === value;
        return (
          <button key={p.days} role="radio" aria-checked={on} onClick={() => onChange(p.days)} className={`seg-b ${on ? "on" : ""}`}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function useOverview(days: number, enabled = true) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    adminApi
      .overview(days)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days, enabled]);
  useEffect(load, [load]);
  return { data, loading, error, reload: load };
}

function StatusBadge({ status }: { status: AdminStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.bg, color: m.color }}>
      <m.icon size={11} /> {m.label}
    </span>
  );
}

// ─── Vue d'ensemble ──────────────────────────────────────────────────────────

function OverviewView({ days, ov, go }: { days: number; ov: ReturnType<typeof useOverview>; go: (sub: number) => void }) {
  const { data, loading, error } = ov;
  const periodLabel = PERIODS.find((p) => p.days === days)!.label;

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}
      {!data ? (
        <SkeletonCards count={4} height={104} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
      ) : (
        <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
          <Watchlist data={data} go={go} />
          {/* Chiffre principal : bénéfice net de la période (carte héros), et le compte de résultat qui y mène */}
          <section className="stagger grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-5">
            <Hero
              icon={PiggyBank}
              label={`Bénéfice net · ${periodLabel}`}
              value={fmtAr(data.finance.profit)}
              tone={data.finance.profit < 0 ? "bad" : undefined}
              caption={`Abonnements + crédits de réponses IA + heures de live, moins commissions, coût IA et dépenses · marge ${pct(data.finance.margin)}`}
            >
              <SourceBar bySource={data.finance.bySource} />
              <div className="mb-5">
                <p className="mb-1 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Montant collecté par jour</p>
                <Sparkline data={data.revenue.daily} label={`Montant collecté par jour, ${periodLabel}`} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <Mini dark label="Revenu mensuel récurrent" value={fmtAr(data.subscriptions.mrr)} detail="estimé, formules payées en cours" />
                <Mini dark label="Collecté depuis le début" value={fmtAr(data.revenue.total)} detail={`${fmtNum(data.revenue.totalCount)} paiements, brut`} />
                <Mini dark label="En attente de paiement" value={fmtAr(data.revenue.pending.amount)} detail={`${data.revenue.pending.count} lien${data.revenue.pending.count > 1 ? "s" : ""}`} />
                <Mini dark label="Paiements échoués" value={fmtNum(data.revenue.failed)} detail={periodLabel} />
              </div>
            </Hero>
            <Ledger finance={data.finance} periodLabel={periodLabel} count={data.revenue.periodCount} />
          </section>

          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            <Stat icon={Users} label="Utilisateurs" value={fmtNum(data.users.total)} detail={`+${fmtNum(data.users.new)} sur ${periodLabel}`} />
            <Stat icon={TrendingUp} label="Actifs (7 derniers jours)" value={fmtNum(data.users.active7d)} detail={data.users.total ? `${pct(data.users.active7d / data.users.total)} des comptes` : undefined} />
            <Stat icon={BadgeCheck} label="Abonnés payants" value={fmtNum(data.subscriptions.paying)} detail={`${fmtNum(data.subscriptions.byStatus.TRIAL)} en essai`} />
            <Stat icon={CreditCard} label="Conversion essai → payant" value={pct(data.subscriptions.conversion)} detail={`${fmtNum(data.subscriptions.everPaid)} client${data.subscriptions.everPaid > 1 ? "s" : ""} ont déjà payé`} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ColumnChart title="Montant collecté par jour" subtitle={`Paiements confirmés · ${periodLabel}`} data={data.revenue.daily} format={fmtAr} icon={Wallet} tint="#f05a1a" loading={loading} />
            <ColumnChart title="Inscriptions par jour" subtitle={`Nouveaux comptes · ${periodLabel}`} data={data.users.signups} format={fmtNum} icon={UserPlus} tint="#3B82F6" loading={loading} integer />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Panel title="Comptes par statut" subtitle="Répartition des comptes selon leur abonnement" icon={Users}>
              <BarList
                format={fmtNum}
                rows={(["ACTIVE", "TRIAL", "EXPIRED"] as AdminStatus[]).map((s) => ({ key: s, label: STATUS_META[s].label, value: data.subscriptions.byStatus[s], icon: STATUS_META[s].icon }))}
              />
              <p className="mt-3 text-[11.5px]" style={{ color: theme.textMuted }}>
                Hors administrateurs et comptes supprimés.
                {data.users.moderation.suspended + data.users.moderation.banned + data.users.moderation.deleted > 0 &&
                  ` Modération : ${data.users.moderation.suspended} suspendu${data.users.moderation.suspended > 1 ? "s" : ""}, ${data.users.moderation.banned} banni${data.users.moderation.banned > 1 ? "s" : ""}, ${data.users.moderation.deleted} supprimé${data.users.moderation.deleted > 1 ? "s" : ""}.`}
              </p>
            </Panel>
            <Panel title={`Revenus par formule · ${periodLabel}`} subtitle="Montants encaissés, formule par formule" icon={CreditCard}>
              <BarList
                format={fmtAr}
                empty="Aucun abonnement payé sur la période"
                rows={[
                  ...data.revenue.byPlan.map((p) => ({ key: p.plan, label: p.name, value: p.amount, detail: `${p.count}×` })),
                  ...data.revenue.byKind.filter((k) => k.kind === "LIVE_HOURS").map((k) => ({ key: "live", label: "Heures de live", value: k.amount, icon: Radio, detail: `${k.count}×` })),
                  ...data.revenue.byKind.filter((k) => k.kind === "REPLY_CREDITS").map((k) => ({ key: "credits", label: "Crédits de réponses", value: k.amount, icon: Coins, detail: `${k.count}×` })),
                ].sort((a, b) => b.value - a.value)}
              />
            </Panel>
            <Panel title={`Moyens de paiement · ${periodLabel}`} subtitle="Montants encaissés selon le moyen de paiement" icon={Smartphone}>
              <BarList
                format={fmtAr}
                empty="Aucun paiement sur la période"
                rows={data.revenue.byMethod
                  .map((m) => ({ key: m.method, label: PAYMENT_METHOD_LABEL[m.method] ?? (m.method === "INCONNU" ? "Non précisé" : m.method), value: m.amount, detail: `${m.count}×` }))
                  .sort((a, b) => b.value - a.value)}
              />
            </Panel>
          </div>

          <Panel title={`Activité de la plateforme · ${periodLabel}`} subtitle="Ce que font vos clients avec SuiteFlow" icon={MessageCircle}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              <Mini label="Pages Facebook actives" value={fmtNum(data.usage.pages.active)} detail={`${data.usage.pages.total} connectées`} />
              <Mini label="Comptes Instagram actifs" value={fmtNum(data.usage.instagram.active)} />
              <Mini label="Messages reçus" value={fmtNum(data.usage.messages)} />
              <Mini label="Réponses envoyées" value={fmtNum(data.usage.replied)} detail={`${fmtNum(data.usage.aiGenerated)} par l'IA`} />
              <Mini label="Règles actives" value={fmtNum(data.usage.rulesActive)} />
              <Mini label="Lives en cours" value={fmtNum(data.usage.liveActive)} detail={`${fmtHours(data.usage.liveSeconds)} ce mois-ci`} />
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

// Sources de revenus : le bénéfice net est la somme de toutes (abonnements, crédits de réponses IA, heures de live)
const SOURCES: Array<{ kind: "SUBSCRIPTION" | "REPLY_CREDITS" | "LIVE_HOURS"; label: string; color: string }> = [
  { kind: "SUBSCRIPTION", label: "Abonnements", color: "#f05a1a" },
  { kind: "REPLY_CREDITS", label: "Crédits de réponses IA", color: "#a78bfa" },
  { kind: "LIVE_HOURS", label: "Heures de live", color: "#38bdf8" },
];

// Répartition de l'encaissé net entre les trois sources, dans la carte héros
function SourceBar({ bySource }: { bySource: AdminOverview["finance"]["bySource"] }) {
  const total = SOURCES.reduce((n, s) => n + Math.max(0, bySource[s.kind].net), 0);
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Encaissé net par source</p>
      <div className="flex h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} role="img" aria-label="Répartition de l'encaissé net par source">
        {total > 0 && SOURCES.map((s) => <span key={s.kind} style={{ width: `${(Math.max(0, bySource[s.kind].net) / total) * 100}%`, background: s.color }} />)}
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-3">
        {SOURCES.map((s) => (
          <li key={s.kind} className="min-w-0" style={{ color: "rgba(255,255,255,0.7)" }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 truncate">{s.label}</span>
            </span>
            <b className="block pl-3.5 text-[13px] tabular-nums text-white">{fmtAr(bySource[s.kind].net)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// « À surveiller » : ce qui demande une action de l'administrateur, avec un accès direct à l'onglet concerné
function Watchlist({ data, go }: { data: AdminOverview; go: (sub: number) => void }) {
  type Item = { key: string; tone: "bad" | "warn"; icon: LucideIcon; text: string; sub: number; action: string };
  const items: Item[] = [];
  const s = data.system;
  if (!s.papi.configured) items.push({ key: "papi", tone: "bad", icon: CreditCard, text: "Paiement en ligne non configuré : aucun abonnement ne peut être payé", sub: 4, action: "Voir le système" });
  else if (s.papi.testMode) items.push({ key: "test", tone: "warn", icon: CreditCard, text: "Paiement en mode test : aucun débit réel", sub: 4, action: "Voir le système" });
  if (data.revenue.failed > 0) items.push({ key: "failed", tone: "bad", icon: XCircle, text: `${plural(data.revenue.failed, "paiement échoué", "paiements échoués")} sur la période`, sub: 2, action: "Voir les paiements" });
  if (data.revenue.pending.count > 0) items.push({ key: "pending", tone: "warn", icon: Hourglass, text: `${plural(data.revenue.pending.count, "lien", "liens")} en attente de paiement (${fmtAr(data.revenue.pending.amount)})`, sub: 2, action: "Voir les paiements" });
  if (!data.ai.configured) items.push({ key: "ai", tone: "bad", icon: Bot, text: "Aucun modèle d'IA configuré : l'assistant ne peut pas répondre", sub: 4, action: "Configurer" });
  if (data.ai.failures24h > 0) items.push({ key: "aifail", tone: "bad", icon: AlertTriangle, text: `${plural(data.ai.failures24h, "échec de l'IA", "échecs de l'IA")} en 24 h`, sub: 4, action: "Voir l'IA" });
  if (data.ai.quotaHits > 0) items.push({ key: "quota", tone: "warn", icon: Gift, text: `${plural(data.ai.quotaHits, "compte a", "comptes ont")} atteint son quota de réponses IA`, sub: 1, action: "Voir les comptes" });
  if (!s.mail.configured) items.push({ key: "mail", tone: "warn", icon: Mail, text: "E-mail non configuré : les codes de validation s'affichent dans le terminal du serveur", sub: 4, action: "Voir le système" });
  if (!s.webhookConfigured) items.push({ key: "hook", tone: "warn", icon: Plug, text: "Webhooks Meta non configurés : les commentaires arrivent seulement par relève", sub: 4, action: "Voir le système" });

  if (items.length === 0) {
    return (
      <div className="strip !m-0 !rounded-2xl">
        <CheckCircle2 />
        <span><b>Tout est en ordre</b> : aucun paiement en échec, IA, e-mail et paiement configurés.</span>
      </div>
    );
  }
  const tone = { bad: { bg: theme.dangerBg, fg: theme.red }, warn: { bg: theme.amberSoft, fg: theme.amber } };
  return (
    <section className="card-x rounded-2xl p-3 sm:p-4" aria-label="À surveiller">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <AlertTriangle size={15} style={{ color: theme.amber }} />
        <h2 className="text-[13.5px] font-bold" style={{ color: theme.text }}>À surveiller</h2>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: theme.amberSoft, color: theme.amber }}>{items.length}</span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((it) => (
          <li key={it.key}>
            <button onClick={() => go(it.sub)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-opacity hover:opacity-85" style={{ background: tone[it.tone].bg }}>
              <it.icon size={17} className="flex-shrink-0" style={{ color: tone[it.tone].fg }} />
              <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug" style={{ color: theme.text }}>{it.text}</span>
              <span className="flex-shrink-0 text-[12px] font-semibold" style={{ color: tone[it.tone].fg }}>{it.action} ›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Compte de résultat de la période : du brut au bénéfice
function Ledger({ finance: f, periodLabel, count }: { finance: AdminOverview["finance"]; periodLabel: string; count: number }) {
  const line = (label: ReactNode, value: number, opts: { sign?: "-" | "="; detail?: ReactNode; strong?: boolean } = {}) => (
    <div
      className="flex items-start justify-between gap-4 py-2"
      style={{ borderTop: opts.sign === "=" ? "1px solid var(--line-2)" : undefined, fontWeight: opts.strong ? 700 : 500 }}
    >
      <div className="min-w-0">
        <p style={{ color: theme.text }}>
          <span className="inline-block w-4 tabular-nums" style={{ color: theme.textMuted }}>{opts.sign === "-" ? "−" : opts.sign === "=" ? "=" : ""}</span>
          {label}
        </p>
        {opts.detail && <p className="pl-4 text-[11.5px] font-normal" style={{ color: theme.textMuted }}>{opts.detail}</p>}
      </div>
      <p className="whitespace-nowrap tabular-nums" style={{ color: opts.strong && value < 0 ? theme.red : theme.text }}>
        {opts.sign === "-" && value > 0 ? "− " : ""}
        {fmtAr(value)}
      </p>
    </div>
  );
  return (
    <div className="card-s px-5 py-5 text-[13px]">
      <CardTitle title="Compte de résultat" subtitle={`Du montant collecté au bénéfice · ${periodLabel}`} icon={Receipt} tint="#10B981" className="!mb-1.5" />
      {line("Montant collecté (brut)", f.gross, { detail: `${fmtNum(count)} paiement${count > 1 ? "s" : ""} confirmé${count > 1 ? "s" : ""}` })}
      <ul className="mb-1 ml-4 flex flex-col gap-1 border-l pl-3" style={{ borderColor: "var(--line-2)" }}>
        {SOURCES.map((src) => {
          const t = f.bySource[src.kind];
          return (
            <li key={src.kind} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: src.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate" style={{ color: theme.textMuted }}>{src.label} <span className="text-[11px]">· {fmtNum(t.count)}×</span></span>
              <span className="whitespace-nowrap font-semibold tabular-nums" style={{ color: theme.text }}>{fmtAr(t.gross)}</span>
              <span className="w-10 text-right text-[11px] tabular-nums" style={{ color: theme.textMuted }}>{f.gross ? `${Math.round((t.gross / f.gross) * 100)} %` : "—"}</span>
            </li>
          );
        })}
      </ul>
      {line("Commissions de paiement", f.fees, {
        sign: "-",
        detail: f.feesEstimated
          ? `${f.feesEstimated} estimée${f.feesEstimated > 1 ? "s" : ""} avec vos taux : MVola ${f.feeRates.MVOLA} %, Orange ${f.feeRates.ORANGE_MONEY} %, Airtel ${f.feeRates.AIRTEL_MONEY} %, carte ${f.feeRates.BRED} %`
          : "transmises par l'opérateur",
      })}
      {line("Encaissé net", f.net, { sign: "=", strong: true })}
      {line("Coût IA estimé", f.aiCost, { sign: "-", detail: `${fmtNum(f.aiReplies)} réponses IA sur la période` })}
      {line("Dépenses", f.expenses, {
        sign: "-",
        detail: f.expensesByCategory.length
          ? f.expensesByCategory.map((e) => `${EXPENSE_LABELS[e.category as ExpenseCategory] ?? e.category} ${fmtAr(e.amount)}`).join(" · ")
          : "aucune dépense saisie (onglet Dépenses)",
      })}
      {line("Bénéfice net", f.profit, { sign: "=", strong: true })}
    </div>
  );
}

function Mini({ label, value, detail, dark }: { label: string; value: string; detail?: string; dark?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium" style={{ color: dark ? "rgba(255,255,255,0.6)" : theme.textMuted }}>{label}</p>
      <p className="tabular truncate text-[18px] font-extrabold tracking-[-0.02em]" style={{ color: dark ? "#fff" : theme.text }}>{value}</p>
      {detail && <p className="text-[11.5px]" style={{ color: dark ? "rgba(255,255,255,0.5)" : theme.textMuted }}>{detail}</p>}
    </div>
  );
}

// ─── Briques des listes (utilisateurs, paiements) ────────────────────────────

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {[0, 1, 2, 3].map((i) => <span key={i} className="sk h-[68px] w-full rounded-2xl" />)}
    </div>
  );
}

// Nom, étiquettes (admin, état du compte, 2FA)
function UserName({ u }: { u: AdminUser }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold" style={{ color: theme.text }}>
      <span className="truncate">{u.name}</span>
      {u.role === "ADMIN" && <span className="rounded px-1 text-[10px] font-bold" style={{ background: "#6366F11f", color: "#6366F1" }}>ADMIN</span>}
      {u.account !== "ACTIVE" && <AccountBadge user={u} />}
      {u.twoFactorMethod && (
        <span className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-bold" style={{ background: theme.greenSoft, color: theme.green }} title={u.twoFactorMethod === "TOTP" ? "Validation en deux étapes : application" : "Validation en deux étapes : e-mail"}>
          <ShieldCheck size={10} /> 2FA
        </span>
      )}
    </p>
  );
}

// Échéance en clair : « dans 6 j », « expiré depuis 3 j » (rouge si expiré, ambre si ≤ 3 jours)
function Due({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  const [text, color] = days < 0 ? [`expiré depuis ${-days} j`, theme.red] : days === 0 ? ["aujourd'hui", theme.amber] : days <= 3 ? [`dans ${days} j`, theme.amber] : [`dans ${days} j`, theme.textMuted];
  return <span className="text-[11.5px] font-medium" style={{ color }}>{text}</span>;
}

// Petite jauge : valeur / limite, rouge quand la limite est atteinte
function Meter({ label, value, limit, extra, bad }: { label: string; value: string; limit?: string; extra?: string; bad?: boolean }) {
  const used = Number(value.replace(/\D/g, ""));
  const max = limit ? Number(limit.replace(/\D/g, "")) : 0;
  const ratio = max ? Math.min(1, used / max) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span style={{ color: theme.textMuted }}>{label}</span>
        <span className="tabular-nums" style={{ color: bad ? theme.red : theme.text }}>
          <b className="font-semibold">{value}</b>{limit && <span style={{ color: theme.textMuted }}> / {limit}</span>}
          {extra && <span style={{ color: theme.textMuted }}> {extra}</span>}
        </span>
      </div>
      {max > 0 && (
        <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={used} aria-label={label}>
          <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: bad ? "linear-gradient(90deg,#f59e0b,#dc2626)" : ratio > 0.8 ? "#f59e0b" : "linear-gradient(90deg,#fcd34d,#f05a1a)" }} />
        </div>
      )}
    </div>
  );
}

// Consommation d'un compte : pages, réponses IA, heures de live
function Usage({ u }: { u: AdminUser }) {
  const aiBad = u.aiLimit !== null && u.aiReplies >= u.aiLimit && !u.replyCredits;
  return (
    <div className="flex flex-col gap-2">
      <Meter label="Pages" value={String(u.pages)} limit={u.pagesLimit !== null ? String(u.pagesLimit) : undefined} bad={u.pagesLimit !== null && u.pages > u.pagesLimit} />
      <Meter label="IA" value={fmtNum(u.aiReplies)} limit={u.aiLimit !== null ? fmtNum(u.aiLimit) : undefined} extra={u.replyCredits > 0 ? `+${fmtNum(u.replyCredits)} cr.` : undefined} bad={aiBad} />
      <Meter label="Live" value={fmtHours(u.liveSeconds)} extra={u.liveCreditSeconds > 0 ? `+${fmtHours(u.liveCreditSeconds)} achetées` : undefined} />
    </div>
  );
}

const KIND_ICON: Record<AdminPayment["kind"], LucideIcon> = { SUBSCRIPTION: CreditCard, LIVE_HOURS: Radio, REPLY_CREDITS: Coins };
const payDate = (p: AdminPayment) => new Date(p.paidAt ?? p.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const payItem = (p: AdminPayment) =>
  p.kind === "LIVE_HOURS" ? `${p.liveHours} h de live` : p.kind === "REPLY_CREDITS" ? `${fmtNum(p.replyCredits ?? 0)} réponses IA` : `${p.planName} · ${p.period === "ANNUAL" ? "annuel" : "mensuel"}`;

const PAY_ICON: Record<PaymentStatus, LucideIcon> = { PAID: CheckCircle2, PENDING: Hourglass, FAILED: XCircle, EXPIRED: Clock };

function PayStatus({ p, compact }: { p: AdminPayment; compact?: boolean }) {
  const s = PAY_STATUS[p.status];
  const Icon = PAY_ICON[p.status];
  return (
    <div className="min-w-0">
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}><Icon size={11} /> {s.label}</span>
      {!compact && p.failureMessage && p.status !== "PAID" && <span className="mt-0.5 block max-w-[200px] truncate text-[11px]" style={{ color: theme.textMuted }} title={p.failureMessage}>{p.failureMessage}</span>}
    </div>
  );
}

// Référence du paiement : un clic la copie
function CopyRef({ value, className = "" }: { value: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => swal.toast({ title: "Référence copiée" }), () => undefined)}
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11.5px] hover:bg-black/5 ${className}`}
      style={{ color: theme.textMuted }}
      title="Copier la référence"
    >
      <span className="max-w-[140px] truncate">{value}</span> <Copy size={11} />
    </button>
  );
}

// ─── Utilisateurs ────────────────────────────────────────────────────────────

function UsersView() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState<AccountFilter>("current");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [moderating, setModerating] = useState<{ user: AdminUser; action: ModerationAction } | null>(null);
  const me = useAuth().user?.id;
  const [data, setData] = useState<{ users: AdminUser[]; total: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [gifting, setGifting] = useState<{ user: AdminUser; kind: GiftKind } | null>(null);

  // Recherche différée : pas une requête par touche
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .users({ search: query, plan, status, account, page, pageSize: size })
      .then(setData)
      .catch((e: Error) => swal.toast({ variant: "error", title: "Chargement impossible", text: e.message }))
      .finally(() => setLoading(false));
  }, [query, plan, status, account, page, size]);
  useEffect(load, [load]);

  const select = "field-in h-10 rounded-xl px-3 text-[13px] font-medium outline-none";
  const selectStyle = { border: 0 };
  const filtered = Boolean(query || plan || status || account !== "current");
  const resetFilters = () => {
    setSearch("");
    setQuery("");
    setPlan("");
    setStatus("");
    setAccount("current");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Utilisateurs"
        subtitle={data ? `${fmtNum(data.total)} compte${data.total > 1 ? "s" : ""}${filtered ? " correspondent aux filtres" : ""}` : "Chargement…"}
        icon={Users}
        action={
          filtered ? (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetFilters}>Réinitialiser</Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="field-in flex h-10 items-center gap-2 rounded-xl px-3 sm:col-span-2 lg:col-span-1" style={selectStyle}>
              <Search size={15} className="flex-shrink-0" style={{ color: theme.textMuted }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou e-mail…" aria-label="Rechercher un utilisateur" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" style={{ color: theme.text }} />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full hover:bg-black/10" aria-label="Effacer la recherche"><X size={12} /></button>
              )}
            </label>
            <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className={`${select} w-full`} style={selectStyle} aria-label="Formule">
              <option value="">Toutes les formules</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="BUSINESS">Business</option>
              <option value="AGENCY">Agence</option>
            </Select>
            <Select value={account} onChange={(e) => { setAccount(e.target.value as AccountFilter); setPage(1); }} className={`${select} w-full`} style={selectStyle} aria-label="État du compte">
              <option value="current">Comptes non supprimés</option>
              <option value="active">Actifs</option>
              <option value="suspended">Suspendus</option>
              <option value="banned">Bannis</option>
              <option value="deleted">Supprimés</option>
              <option value="all">Tous, y compris supprimés</option>
            </Select>
          </div>
          <FilterChips
            items={[{ id: "", label: "Tous" }, { id: "ACTIVE", label: "Abonnés actifs" }, { id: "TRIAL", label: "En essai" }, { id: "EXPIRED", label: "Expirés" }]}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
          />
        </div>
      </Panel>

      {(() => {
        const menu = (u: AdminUser) => (
          <UserMenu user={u} self={u.id === me} onEdit={() => setEditing(u)} onGift={(kind) => setGifting({ user: u, kind })} onModerate={(action) => setModerating({ user: u, action })} />
        );
        if (!data) return loading ? <RowsSkeleton /> : null;
        if (data.users.length === 0) return <p className="card-x rounded-2xl px-4 py-10 text-center text-sm" style={{ color: theme.textMuted }}>Aucun compte ne correspond.</p>;
        return (
          <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
            {/* Écrans étroits et moyens : une carte par compte */}
            <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
              {data.users.map((u) => (
                <li key={u.id} className="card-x flex flex-col gap-3 rounded-2xl p-4" style={u.account !== "ACTIVE" ? { background: ACCOUNT_META[u.account].rowBg } : undefined}>
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} src={u.avatarUrl} size={40} />
                    <div className="min-w-0 flex-1">
                      <UserName u={u} />
                      <p className="truncate text-[12px]" style={{ color: theme.textMuted }}>{u.email}</p>
                    </div>
                    {menu(u)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: theme.text }}>{u.planName}</span>
                    <StatusBadge status={u.status} />
                    <Due iso={u.periodEnd} />
                  </div>
                  <Usage u={u} />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-[12px]" style={{ borderColor: "var(--line)", color: theme.textMuted }}>
                    <span>Payé : <b style={{ color: theme.text }}>{u.totalPaid ? fmtAr(u.totalPaid) : "—"}</b></span>
                    <span>{u.lastActivity ? `Actif ${timeAgo(u.lastActivity)}` : "Jamais connecté"} · inscrit le {fmtDate(u.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Grands écrans : tableau, avec la consommation regroupée en une colonne */}
            <div className="card-x hidden overflow-x-auto rounded-2xl xl:block">
              <table className="w-full min-w-[920px] text-[13px]">
                <thead style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                  <tr>
                    {["Utilisateur", "Formule", "Échéance", "Consommation du mois", "Total payé", "Activité", ""].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-black/[0.025]" style={{ borderTop: "1px solid var(--line)", background: u.account !== "ACTIVE" ? ACCOUNT_META[u.account].rowBg : undefined }}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} src={u.avatarUrl} size={34} />
                          <div className="min-w-0">
                            <UserName u={u} />
                            <p className="truncate text-[11.5px]" style={{ color: theme.textMuted }}>{u.email}</p>
                            <p className="flex items-center gap-1 text-[11px]" style={{ color: theme.textMuted }}>
                              inscrit le {fmtDate(u.createdAt)}
                              {u.paymentPhone && <><span aria-hidden>·</span><Smartphone size={10} />{u.paymentPhone}</>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-semibold" style={{ color: theme.text }}>{u.planName}</p>
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-[12.5px]" style={{ color: theme.text }}>{u.periodEnd ? fmtDate(u.periodEnd) : "—"}</p>
                        <Due iso={u.periodEnd} />
                      </td>
                      <td className="px-3 py-3"><div className="w-[230px]"><Usage u={u} /></div></td>
                      <td className="px-3 py-3 whitespace-nowrap font-semibold tabular-nums" style={{ color: theme.text }}>{u.totalPaid ? fmtAr(u.totalPaid) : <span style={{ color: theme.textMuted, fontWeight: 400 }}>—</span>}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-[12px]" style={{ color: theme.textMuted }}>{u.lastActivity ? timeAgo(u.lastActivity) : "jamais"}</td>
                      <td className="px-2 py-3 text-right">{menu(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {data && (
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
          onChange={setPage}
          total={data.total}
          pageSize={data.pageSize}
          pageSizes={[10, 20, 50, 100]}
          onPageSizeChange={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}

      {editing && <EditPlanModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {gifting && <GiftModal user={gifting.user} kind={gifting.kind} onClose={() => setGifting(null)} onSaved={() => { setGifting(null); load(); }} />}
      {moderating && (
        <ModerationModal user={moderating.user} action={moderating.action} onClose={() => setModerating(null)} onDone={() => { setModerating(null); load(); }} />
      )}
    </div>
  );
}

// Actions sur un compte, selon son état. Un administrateur ne peut ni se modérer ni modérer un autre administrateur.
function UserMenu({
  user: u, self, onEdit, onGift, onModerate,
}: {
  user: AdminUser;
  self: boolean;
  onEdit: () => void;
  onGift: (kind: GiftKind) => void;
  onModerate: (a: ModerationAction) => void;
}) {
  const deleted = u.account === "DELETED";
  const protectedAccount = self || u.role === "ADMIN";
  type Item = { icon: LucideIcon; label: string; fn: () => void; danger?: boolean } | "sep";
  const items: Item[] = deleted
    ? [{ icon: RotateCcw, label: "Restaurer le compte", fn: () => onModerate("restore") }]
    : [
        { icon: CalendarClock, label: "Modifier la formule", fn: onEdit },
        { icon: Coins, label: "Offrir des crédits de réponses", fn: () => onGift("credits") },
        { icon: Gift, label: "Offrir des heures de live", fn: () => onGift("hours") },
        ...(!self ? [{ icon: LogOut, label: "Déconnecter partout", fn: () => onModerate("logout") } as Item] : []),
        ...(!self && u.twoFactorMethod ? [{ icon: ShieldOff, label: "Réinitialiser la 2FA", fn: () => onModerate("reset2fa") } as Item] : []),
        ...(!protectedAccount
          ? ([
              "sep",
              u.account === "SUSPENDED"
                ? { icon: PlayCircle, label: "Lever la suspension", fn: () => onModerate("unsuspend") }
                : u.account === "BANNED"
                  ? { icon: PlayCircle, label: "Lever le bannissement", fn: () => onModerate("unban") }
                  : { icon: PauseCircle, label: "Suspendre…", fn: () => onModerate("suspend"), danger: true },
              ...(u.account !== "BANNED" ? [{ icon: Ban, label: "Bannir…", fn: () => onModerate("ban"), danger: true }] : []),
              { icon: UserX, label: "Supprimer…", fn: () => onModerate("delete"), danger: true },
            ] as Item[])
          : []),
      ];
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((cur) => (cur ? null : el));
        }}
        className="rounded-lg p-1.5 hover:bg-black/5"
        aria-label={`Actions sur ${u.name}`}
        aria-expanded={Boolean(anchor)}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={16} style={{ color: theme.textMuted }} />
      </button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)} width={232}>
          {items.map((it, i) =>
            it === "sep" ? (
              <MenuSeparator key={`sep${i}`} />
            ) : (
              <MenuItem
                key={it.label}
                icon={it.icon}
                label={it.label}
                danger={it.danger}
                onClick={() => {
                  setAnchor(null);
                  it.fn();
                }}
              />
            ),
          )}
          {protectedAccount && !deleted && (
            <p className="px-2.5 py-1.5 text-[11px]" style={{ color: theme.textMuted }}>
              {self ? "Votre propre compte ne peut pas être modéré." : "Un administrateur ne peut pas être suspendu, banni ni supprimé."}
            </p>
          )}
        </FloatingMenu>
      )}
    </>
  );
}

const inputClass = "w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

function EditPlanModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [plan, setPlan] = useState<PlanId>(user.plan);
  const [noEnd, setNoEnd] = useState(user.periodEnd === null);
  const [end, setEnd] = useState((user.periodEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString()).slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.setSubscription({ email: user.email, plan, periodEnd: noEnd ? null : new Date(`${end}T23:59:59`).toISOString(), note: note || undefined });
      swal.toast({ title: "Formule modifiée", text: `${user.name} : ${plan === "AGENCY" ? "Agence" : plan.charAt(0) + plan.slice(1).toLowerCase()}` });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Modifier la formule"
      subtitle={`${user.name} · ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <Button icon={X} size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={saving} className={`${saving ? "[&>svg]:animate-spin" : ""}`} icon={saving ? Loader2 : Save}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Formule</span>
          <Select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className={inputClass} style={inputStyle}>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="BUSINESS">Business</option>
            <option value="AGENCY">Agence (illimitée)</option>
          </Select>
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Échéance</span>
          <div className="flex flex-wrap items-center gap-3">
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={noEnd} className={`${inputClass} max-w-[200px] disabled:opacity-50`} style={inputStyle} />
            <label className="flex items-center gap-2 text-[13px]" style={{ color: theme.text }}>
              <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" /> Sans échéance
            </label>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Note interne (optionnel)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Geste commercial, contrat Agence…" className={inputClass} style={inputStyle} />
        </label>
        <Alert variant="info">La formule passe en « manuelle » : elle ne dépend plus d'un paiement en ligne. Les Pages en trop sont désactivées si la nouvelle formule en permet moins.</Alert>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

type GiftKind = "hours" | "credits";

const GIFTS: Record<GiftKind, { title: string; field: string; max: number; initial: number; unit: (n: number) => string; note: string }> = {
  hours: {
    title: "Offrir des heures de live",
    field: "Nombre d'heures",
    max: 500,
    initial: 5,
    unit: (n) => `${n} h`,
    note: "Ajoutées au crédit d'heures de Live Manager du client, sans paiement. L'opération est tracée dans son historique.",
  },
  credits: {
    title: "Offrir des crédits de réponses",
    field: "Nombre de réponses",
    max: 100_000,
    initial: 500,
    unit: (n) => `${fmtNum(n)} réponses`,
    note: "Ajoutés aux crédits de réponses automatiques du client, sans paiement. L'opération est tracée dans son historique.",
  },
};

// Geste commercial : heures de live ou crédits de réponses ajoutés sans paiement
function GiftModal({ user, kind, onClose, onSaved }: { user: AdminUser; kind: GiftKind; onClose: () => void; onSaved: () => void }) {
  const g = GIFTS[kind];
  const [amount, setAmount] = useState(g.initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (kind === "hours") await adminApi.addLiveHours(user.id, amount);
      else await adminApi.addReplyCredits(user.id, amount);
      swal.toast({ title: kind === "hours" ? "Heures offertes" : "Crédits offerts", text: `${g.unit(amount)} ajoutées à ${user.name}.` });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };
  return (
    <Modal
      title={g.title}
      subtitle={`${user.name} · crédit actuel : ${kind === "hours" ? fmtHours(user.liveCreditSeconds) : `${fmtNum(user.replyCredits)} réponses`}`}
      onClose={onClose}
      footer={
        <>
          <Button icon={X} size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" icon={kind === "hours" ? Gift : Coins} onClick={save} disabled={saving || amount < 1}>Offrir {g.unit(amount)}</Button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>{g.field}</span>
        <input type="number" min={1} max={g.max} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(g.max, Number(e.target.value) || 1)))} className={`${inputClass} max-w-[160px]`} style={inputStyle} />
      </label>
      <p className="mt-2 text-[12px]" style={{ color: theme.textMuted }}>{g.note}</p>
      {error && <Alert variant="error" className="mt-3">{error}</Alert>}
    </Modal>
  );
}

// ─── Paiements ───────────────────────────────────────────────────────────────

function PaymentsView() {
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [data, setData] = useState<{ payments: AdminPayment[]; total: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AdminPayment | null>(null); // paiement ouvert dans le modal de détail

  useEffect(() => {
    setLoading(true);
    adminApi
      .payments({ status: status || undefined, page, pageSize: size })
      .then(setData)
      .catch((e: Error) => swal.toast({ variant: "error", title: "Chargement impossible", text: e.message }))
      .finally(() => setLoading(false));
  }, [status, page, size]);

  const filters: Array<{ id: "" | PaymentStatus; label: string }> = [
    { id: "", label: "Tous" },
    { id: "PAID", label: "Payés" },
    { id: "PENDING", label: "En attente" },
    { id: "FAILED", label: "Échoués" },
    { id: "EXPIRED", label: "Expirés" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FeeRatesCard />
      <Panel
        title="Paiements"
        subtitle={data ? `${fmtNum(data.total)} paiement${data.total > 1 ? "s" : ""}${status ? ` · ${filters.find((f) => f.id === status)?.label.toLowerCase()}` : ""}` : "Chargement…"}
        icon={CreditCard}
        action={status ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { setStatus(""); setPage(1); }}>Réinitialiser</Button> : undefined}
      >
        <FilterChips items={filters} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      </Panel>

      {!data ? (
        loading ? <RowsSkeleton /> : null
      ) : data.payments.length === 0 ? (
        <p className="card-x rounded-2xl px-4 py-10 text-center text-sm" style={{ color: theme.textMuted }}>Aucun paiement.</p>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
          {/* Écrans étroits et moyens : une carte par paiement, le détail s'ouvre au toucher */}
          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {data.payments.map((p) => {
              const s = PAY_STATUS[p.status];
              const Kind = KIND_ICON[p.kind];
              return (
                <li key={p.reference}>
                  <button onClick={() => setDetail(p)} className="card-x flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.99]" aria-label={`Détail du paiement de ${p.user.name}`}>
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl" style={{ background: s.bg, color: s.color }}><Kind size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{payItem(p)}</span>
                      <span className="block truncate text-[12px]" style={{ color: theme.textMuted }}>{p.user.name} · {payDate(p)}</span>
                    </span>
                    <span className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="text-[14.5px] font-extrabold tabular-nums" style={{ color: theme.text }}>{fmtAr(p.amount)}</span>
                      <PayStatus p={p} compact />
                    </span>
                    <ChevronRight size={16} className="flex-shrink-0" style={{ color: theme.textMuted }} />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Grands écrans : tableau court (le reste est dans le détail) */}
          <div className="card-x hidden overflow-x-auto rounded-2xl xl:block">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                <tr>
                  {["Date", "Client", "Achat", "Montant", "Statut", ""].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => {
                  const Kind = KIND_ICON[p.kind];
                  return (
                    <tr key={p.reference} onClick={() => setDetail(p)} className="cursor-pointer transition-colors hover:bg-black/[0.03]" style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="px-3 py-3 whitespace-nowrap text-[12.5px]" style={{ color: theme.text }}>{payDate(p)}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold" style={{ color: theme.text }}>{p.user.name}</p>
                        <p className="text-[11.5px]" style={{ color: theme.textMuted }}>{p.user.email}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: theme.text }}>
                        <span className="inline-flex items-center gap-2"><Kind size={15} style={{ color: theme.goldDark }} />{payItem(p)}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-bold tabular-nums" style={{ color: theme.text }}>{fmtAr(p.amount)}</td>
                      <td className="px-3 py-3"><PayStatus p={p} compact /></td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setDetail(p); }} className="inline-flex items-center gap-0.5 whitespace-nowrap text-[12.5px] font-semibold hover:underline" style={{ color: theme.goldDark }}>
                          Détails <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && (
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
          onChange={setPage}
          total={data.total}
          pageSize={data.pageSize}
          pageSizes={[10, 25, 50, 100]}
          onPageSizeChange={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
      {detail && <PaymentDetail p={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// Détail d'un paiement : tout ce que la liste ne montre pas (référence, dates, commission, net, moyen, téléphone, erreur)
function PaymentDetail({ p, onClose }: { p: AdminPayment; onClose: () => void }) {
  const s = PAY_STATUS[p.status];
  const Kind = KIND_ICON[p.kind];
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const row = (label: string, value: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderTop: "1px solid var(--line)" }}>
      <dt className="text-[12.5px]" style={{ color: theme.textMuted }}>{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium" style={{ color: theme.text }}>{value}</dd>
    </div>
  );
  return (
    <Modal title="Détail du paiement" subtitle={<span className="font-mono">{p.reference}</span>} onClose={onClose} footer={<Button variant="ghost" icon={X} onClick={onClose}>Fermer</Button>}>
      <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: s.bg }}>
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl" style={{ background: theme.bgCard, color: s.color }}><Kind size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium" style={{ color: s.color }}>{payItem(p)}</p>
          <p className="text-[24px] font-extrabold leading-tight tabular-nums" style={{ color: theme.text }}>{fmtAr(p.amount)}</p>
        </div>
        <PayStatus p={p} />
      </div>

      {p.failureMessage && p.status !== "PAID" && <Alert variant="error" className="mt-3">{p.failureMessage}</Alert>}

      <dl className="mt-3">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Client</p>
        {row("Nom", p.user.name)}
        {row("E-mail", <a href={`mailto:${p.user.email}`} className="underline" style={{ color: theme.goldDark }}>{p.user.email}</a>)}
        {row("Téléphone du payeur", p.payerPhone ?? "—")}

        <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Achat</p>
        {row("Type", p.kind === "SUBSCRIPTION" ? "Abonnement" : p.kind === "LIVE_HOURS" ? "Heures de live" : "Crédits de réponses IA")}
        {p.kind === "SUBSCRIPTION" && row("Formule", `${p.planName ?? "—"} · ${p.period === "ANNUAL" ? "annuel" : "mensuel"}`)}
        {p.kind === "LIVE_HOURS" && row("Heures achetées", `${p.liveHours} h`)}
        {p.kind === "REPLY_CREDITS" && row("Réponses achetées", fmtNum(p.replyCredits ?? 0))}

        <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Montants</p>
        {row("Montant payé (brut)", <b className="tabular-nums">{fmtAr(p.amount)}</b>)}
        {row(p.feeEstimated ? "Commission (estimée)" : "Commission de l'opérateur", p.fee === null ? "en attente" : <span className="tabular-nums">− {fmtAr(p.fee)}</span>)}
        {row("Encaissé net", p.net === null ? "—" : <b className="tabular-nums">{fmtAr(p.net)}</b>)}

        <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Paiement</p>
        {row("Moyen", p.paymentMethod ? PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod : "Non précisé")}
        {row("Créé le", when(p.createdAt))}
        {row("Payé le", when(p.paidAt))}
        {row("Référence", <CopyRef value={p.reference} />)}
      </dl>
    </Modal>
  );
}

// ─── Messages de contact ─────────────────────────────────────────────────────

function MessagesView() {
  const [status, setStatus] = useState<"" | "NEW" | "HANDLED">("NEW");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [data, setData] = useState<{ messages: ContactMessage[]; total: number; unread: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    contactApi
      .list({ status: status || undefined, page, pageSize: size })
      .then(setData)
      .catch((e: Error) => swal.toast({ variant: "error", title: "Chargement impossible", text: e.message }))
      .finally(() => setLoading(false));
  }, [status, page, size]);
  useEffect(load, [load]);

  const toggle = async (m: ContactMessage) => {
    setBusy(m.id);
    try {
      await contactApi.setStatus(m.id, m.status === "NEW" ? "HANDLED" : "NEW");
      load();
    } catch (e) {
      swal.toast({ variant: "error", title: "Action impossible", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const filters: Array<{ id: "" | "NEW" | "HANDLED"; label: string }> = [
    { id: "NEW", label: data ? `À traiter (${data.unread})` : "À traiter" },
    { id: "HANDLED", label: "Traités" },
    { id: "", label: "Tous" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => {
          const on = status === f.id;
          return (
            <button
              key={f.id || "all"}
              onClick={() => { setStatus(f.id); setPage(1); }}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium"
              style={{ background: on ? theme.bgDark : theme.bgCard, color: on ? "#fff" : theme.text, border: `1px solid ${on ? theme.bgDark : theme.border}` }}
              aria-pressed={on}
            >
              {f.label}
            </button>
          );
        })}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-[12.5px]" style={{ color: theme.textMuted }} title="Actualiser">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      <div className="flex flex-col gap-3" style={{ opacity: loading && data ? 0.6 : 1 }}>
        {data?.messages.length === 0 && (
          <div className="rounded-2xl px-4 py-10 text-center text-[13px] card-x" style={{ color: theme.textMuted }}>
            {status === "NEW" ? "Aucun message à traiter." : "Aucun message."}
          </div>
        )}
        {data?.messages.map((m) => {
          const fresh = m.status === "NEW";
          const reply = `mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.subjectLabel} — SuiteFlow`)}`;
          return (
            <article key={m.id} className="rounded-2xl p-4 card-x" style={{ borderLeft: `3px solid ${fresh ? theme.gold : theme.border}` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold" style={{ color: theme.text }}>
                    {m.name}
                    {m.company && <span className="text-[12.5px] font-normal" style={{ color: theme.textMuted }}>· {m.company}</span>}
                    {m.userId && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>Client</span>}
                  </p>
                  <p className="text-[12.5px]" style={{ color: theme.textMuted }}>
                    <a href={`mailto:${m.email}`} className="underline">{m.email}</a>
                    {m.phone && <> · <span className="tabular-nums">{m.phone}</span></>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.subject === "AGENCY" ? theme.goldSoft : theme.bg, color: m.subject === "AGENCY" ? theme.goldDark : theme.text, border: `1px solid ${theme.border}` }}>
                    {m.subjectLabel}
                  </span>
                  <span className="text-[11.5px]" style={{ color: theme.textMuted }} title={new Date(m.createdAt).toLocaleString("fr-FR")}>{timeAgo(m.createdAt)}</span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed" style={{ color: theme.text }}>{m.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={reply}><Button size="sm" icon={Mail}>Répondre</Button></a>
                <Button size="sm" variant="ghost" icon={fresh ? CheckCircle2 : RotateCcw} disabled={busy === m.id} onClick={() => toggle(m)}>
                  {fresh ? "Marquer comme traité" : "Remettre à traiter"}
                </Button>
                {!fresh && m.handledAt && (
                  <span className="text-[11.5px]" style={{ color: theme.textMuted }}>Traité {timeAgo(m.handledAt)}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {data && (
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
          onChange={setPage}
          total={data.total}
          pageSize={data.pageSize}
          pageSizes={[10, 20, 50]}
          onPageSizeChange={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

// ─── IA & système ────────────────────────────────────────────────────────────

function AiView() {
  const { data, error } = useOverview(30);
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <SkeletonCards count={3} height={104} className="grid grid-cols-1 gap-3 sm:grid-cols-3" />;
  const ai = data.ai;
  const sys = data.system;
  const month = new Date(`${data.usage.month}-15`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 card-x">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: ai.configured ? theme.goldSoft : theme.dangerBg }}>
          <Bot size={22} style={{ color: ai.configured ? theme.goldDark : theme.red }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold" style={{ color: theme.text }}>{ai.provider} · <span className="font-normal">{ai.model}</span></p>
          <p className="text-[12.5px]" style={{ color: theme.textMuted }}>
            {ai.configured ? "Modèle utilisé pour toutes les réponses IA de la plateforme (AI_BASE_URL, AI_MODEL)." : "Aucune clé IA : renseignez AI_API_KEY dans apps/api/.env."}
          </p>
        </div>
        <Health ok={ai.configured} label={ai.configured ? "Configuré" : "Non configuré"} />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Sparkles} label={`Réponses IA · ${month}`} value={fmtNum(ai.repliesThisMonth)} />
        <Stat icon={Wallet} label="Coût IA estimé" value={fmtAr(ai.estimatedCost)} detail={`≈ ${fmtNum(ai.costPerReply)} Ar par réponse`} />
        <Stat icon={AlertTriangle} label="Échecs IA (24 h)" value={fmtNum(ai.failures24h)} tone={ai.failures24h ? "warn" : undefined} />
        <Stat icon={Clock} label="Comptes au quota IA" value={fmtNum(ai.quotaHits)} detail="ce mois-ci" tone={ai.quotaHits ? "warn" : undefined} />
        <Stat icon={Plug} label="Comptes avec l'IA" value={fmtNum(ai.accountsEnabled)} detail="Pages et Instagram actifs" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Plus gros consommateurs d'IA ce mois-ci" subtitle="Les comptes qui génèrent le plus de réponses IA" icon={Users}>
          {ai.top.length === 0 ? (
            <p className="py-4 text-center text-[13px]" style={{ color: theme.textMuted }}>Aucune réponse IA ce mois-ci.</p>
          ) : (
            <BarList format={fmtNum} rows={ai.top.map((t) => ({ key: t.userId, label: `${t.name} · ${t.email}`, value: t.aiReplies, detail: "réponses" }))} />
          )}
        </Panel>
        <Panel title="Langue des réponses IA" subtitle="Langue choisie par compte pour les réponses" icon={Languages}>
          <BarList
            format={fmtNum}
            empty="Aucun compte n'utilise l'IA"
            rows={ai.languages.map((l) => ({ key: l.language, label: LANG_LABEL[l.language] ?? l.language, value: l.count, detail: "comptes" }))}
          />
        </Panel>
      </div>

      <Panel title="Services" subtitle="État des services dont dépend la plateforme" icon={ShieldCheck}>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] md:grid-cols-2">
          <ServiceRow label="Paiement en ligne" ok={sys.papi.configured} value={sys.papi.configured ? (sys.papi.testMode ? "Configuré · mode test" : "Configuré · production") : "Clés absentes"} warn={sys.papi.testMode} />
          <ServiceRow label="Notifications de paiement" ok value={sys.papi.notifications ? "Adresse publique joignable" : "Adresse locale : paiements confirmés par vérification périodique"} warn={!sys.papi.notifications} />
          <li className="md:col-span-2"><MailTest mail={sys.mail} /></li>
          <ServiceRow label="Webhooks Meta" ok={sys.webhookConfigured} value={sys.webhookConfigured ? "Jeton défini" : "Non configurés"} warn={!sys.webhookConfigured} />
          <ServiceRow label="Relève automatique" ok={sys.pollSeconds > 0} value={sys.pollSeconds > 0 ? `Toutes les ${sys.pollSeconds} s` : "Désactivée"} />
          <ServiceRow label="Heures de live à l'unité" ok value={`${fmtAr(sys.liveHourPrice)} l'heure · ${fmtHours(data.usage.liveCreditLeft)} en circulation`} />
          <ServiceRow
            label="Crédits de réponses"
            ok
            value={`${fmtAr(sys.replyPack.price)} les ${fmtNum(sys.replyPack.size)} · ${fmtNum(data.usage.replyCreditLeft)} en circulation · ${fmtNum(data.usage.replyCreditUsed)} utilisés ce mois-ci`}
          />
          <ServiceRow label="Adresse publique de l'API" ok value={sys.publicApiUrl} />
        </ul>
      </Panel>
    </div>
  );
}

function Health({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: ok ? theme.greenSoft : theme.dangerBg, color: ok ? theme.green : theme.red }}>
      <Icon size={13} /> {label}
    </span>
  );
}

function ServiceRow({ label, value, ok, warn }: { label: string; value: string; ok: boolean; warn?: boolean }) {
  const Icon = !ok ? XCircle : warn ? AlertTriangle : CheckCircle2;
  const color = !ok ? theme.red : warn ? theme.amber : theme.green;
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color }} aria-label={!ok ? "Problème" : warn ? "À vérifier" : "OK"} />
      <div className="min-w-0">
        <p className="font-medium" style={{ color: theme.text }}>{label}</p>
        <p className="truncate text-[12px]" style={{ color: theme.textMuted }}>{value}</p>
      </div>
    </li>
  );
}

// ─── Dépenses ────────────────────────────────────────────────────────────────

function ExpensesView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ expenses: Expense[]; total: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const periodLabel = PERIODS.find((p) => p.days === days)!.label;

  const load = useCallback(() => {
    adminApi.expenses(days).then(setData).catch((e: Error) => swal.toast({ variant: "error", title: "Chargement impossible", text: e.message }));
  }, [days]);
  useEffect(load, [load]);

  const remove = async (e: Expense) => {
    const ok = await swal.confirm({
      title: `Supprimer « ${e.label} » ?`,
      text: e.recurring ? "Cette dépense mensuelle ne sera plus comptée, y compris pour les mois passés." : undefined,
      confirmText: "Supprimer",
      variant: "danger",
    });
    if (!ok) return;
    await adminApi.removeExpense(e.id);
    swal.toast({ title: "Dépense supprimée" });
    load();
  };

  const byCategory = Object.entries(
    (data?.expenses ?? []).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.inPeriod }), {}),
  )
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ key: k, label: EXPENSE_LABELS[k as ExpenseCategory] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-5">
      <div className="card-x flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <PeriodPicker value={days} onChange={setDays} />
        <Button size="sm" icon={Plus} onClick={() => setAdding(true)} className="ml-auto">Ajouter une dépense</Button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-x-auto rounded-2xl card-x">
          <table className="w-full min-w-[640px] text-[13px] [&_td]:whitespace-nowrap">
            <thead style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
              <tr>
                {["Date", "Dépense", "Catégorie", "Montant", "Sur la période", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center"><Loader2 size={16} className="mx-auto animate-spin" style={{ color: theme.textMuted }} /></td></tr>
              ) : data.expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center" style={{ color: theme.textMuted }}>
                    Aucune dépense saisie. Ajoutez par exemple l'hébergement (mensuel) ou une campagne publicitaire.
                  </td>
                </tr>
              ) : (
                data.expenses.map((e) => (
                  <tr key={e.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td className="px-3 py-2.5 text-[12.5px]" style={{ color: theme.text }}>{fmtDate(e.date)}</td>
                    <td className="px-3 py-2.5">
                      <p className="flex items-center gap-1.5 font-medium" style={{ color: theme.text }}>
                        {e.label}
                        {e.recurring && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1 text-[10.5px] font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                            <Repeat size={10} /> mensuelle
                          </span>
                        )}
                      </p>
                      {e.note && <p className="max-w-[260px] truncate text-[11.5px]" style={{ color: theme.textMuted }}>{e.note}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px]" style={{ color: theme.textMuted }}>{EXPENSE_LABELS[e.category] ?? e.category}</td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: theme.text }}>
                      {fmtAr(e.amount)}
                      {e.recurring && <span style={{ color: theme.textMuted }}> / mois</span>}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums" style={{ color: e.inPeriod ? theme.text : theme.textMuted }}>
                      {e.inPeriod ? fmtAr(e.inPeriod) : "—"}
                      {e.recurring && e.occurrences > 1 && <span className="ml-1 text-[11px] font-normal" style={{ color: theme.textMuted }}>({e.occurrences} mois)</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => void remove(e)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label={`Supprimer ${e.label}`}>
                        <Trash2 size={15} style={{ color: theme.red }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className="flex flex-col gap-5">
          <div className="rounded-2xl px-5 py-4 card-x">
            <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: theme.textMuted }}><Receipt size={13} /> Total des dépenses · {periodLabel}</p>
            <p className="mt-1 text-[26px] font-semibold tabular-nums" style={{ color: theme.text }}>{fmtAr(data?.total ?? 0)}</p>
            <p className="mt-1 text-[11.5px]" style={{ color: theme.textMuted }}>
              Déduit du bénéfice dans la vue d'ensemble, avec les commissions de paiement et le coût IA estimé.
            </p>
          </div>
          <Panel title="Par catégorie" subtitle="Répartition des dépenses de la période" icon={Receipt}>
            <BarList format={fmtAr} rows={byCategory} empty="Aucune dépense sur la période" />
          </Panel>
        </div>
      </div>

      {adding && <ExpenseModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function ExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("HOSTING");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const value = Number(amount.replace(/\s/g, ""));
    if (!label.trim()) return setError("Donnez un libellé à la dépense.");
    if (!Number.isInteger(value) || value <= 0) return setError("Montant invalide (en ariary, sans décimales).");
    setSaving(true);
    setError(null);
    try {
      await adminApi.addExpense({ date: new Date(`${date}T12:00:00`).toISOString(), category, label: label.trim(), amount: value, recurring, note: note.trim() || undefined });
      swal.toast({ title: "Dépense ajoutée" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ajouter une dépense"
      subtitle="Elle est déduite du bénéfice de la période où elle tombe."
      onClose={onClose}
      footer={
        <>
          <Button icon={X} size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={saving} className={`${saving ? "[&>svg]:animate-spin" : ""}`} icon={saving ? Loader2 : Plus}>Ajouter</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Libellé</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Serveur VPS, campagne Facebook Ads…" className={inputClass} style={inputStyle} autoFocus />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Montant (Ar)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="50 000" className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>{recurring ? "Premier mois" : "Date"}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={inputStyle} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Catégorie</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputClass} style={inputStyle}>
            {(Object.keys(EXPENSE_LABELS) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
            ))}
          </Select>
        </label>
        <label className="flex items-start gap-2.5 sm:col-span-2">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
          <span>
            <span className="block text-[13px] font-semibold" style={{ color: theme.text }}>Dépense mensuelle</span>
            <span className="block text-[11.5px]" style={{ color: theme.textMuted }}>Comptée chaque mois à partir de cette date (hébergement, abonnement logiciel…).</span>
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Note (optionnel)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} style={inputStyle} />
        </label>
        {error && <Alert variant="error" className="sm:col-span-2">{error}</Alert>}
      </div>
    </Modal>
  );
}

// ─── Modération ──────────────────────────────────────────────────────────────

const ACCOUNT_META: Record<AccountState, { label: string; icon: LucideIcon; color: string; bg: string; rowBg: string }> = {
  ACTIVE: { label: "Actif", icon: CheckCircle2, color: theme.green, bg: theme.greenSoft, rowBg: "transparent" },
  SUSPENDED: { label: "Suspendu", icon: PauseCircle, color: theme.amber, bg: theme.amberSoft, rowBg: "color-mix(in srgb, var(--color-amberSoft) 45%, transparent)" },
  BANNED: { label: "Banni", icon: Ban, color: theme.red, bg: theme.dangerBg, rowBg: "color-mix(in srgb, var(--color-dangerBg) 45%, transparent)" },
  DELETED: { label: "Supprimé", icon: UserX, color: theme.textMuted, bg: theme.bg, rowBg: "color-mix(in srgb, var(--color-bg) 70%, transparent)" },
};

function AccountBadge({ user: u }: { user: AdminUser }) {
  const m = ACCOUNT_META[u.account];
  const detail = [
    u.account === "SUSPENDED" ? (u.suspendedUntil ? `jusqu'au ${fmtDate(u.suspendedUntil)}` : "sans date de fin") : null,
    u.moderationReason ? `Motif : ${u.moderationReason}` : null,
    u.moderatedAt ? `le ${fmtDate(u.moderatedAt)}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold" style={{ background: m.bg, color: m.color }} title={detail}>
      <m.icon size={10} /> {m.label}
      {u.account === "SUSPENDED" && u.suspendedUntil && <span className="font-normal">· {fmtDate(u.suspendedUntil)}</span>}
    </span>
  );
}

const MODERATION_COPY: Record<ModerationAction, { title: string; button: string; danger: boolean; needsReason: boolean; effects: string[] }> = {
  suspend: {
    title: "Suspendre le compte",
    button: "Suspendre",
    danger: true,
    needsReason: true,
    effects: [
      "La personne est déconnectée et ne peut plus se connecter (le motif lui est affiché).",
      "Réponses automatiques, IA, lives et publications programmées s'arrêtent.",
      "Ses données, Pages et paiements sont conservés ; la suspension se lève seule à la date choisie.",
    ],
  },
  unsuspend: { title: "Lever la suspension", button: "Réactiver le compte", danger: false, needsReason: false, effects: ["La personne peut se reconnecter ; ses automatisations reprennent selon sa formule."] },
  ban: {
    title: "Bannir le compte",
    button: "Bannir",
    danger: true,
    needsReason: true,
    effects: [
      "Blocage sans date de fin : déconnexion immédiate, connexion refusée avec le motif.",
      "Toutes les automatisations s'arrêtent ; l'e-mail ne peut plus servir à créer un compte.",
      "Rien n'est effacé : vous pouvez lever le bannissement à tout moment.",
    ],
  },
  unban: { title: "Lever le bannissement", button: "Lever le bannissement", danger: false, needsReason: false, effects: ["La personne peut se reconnecter ; ses automatisations reprennent selon sa formule."] },
  delete: {
    title: "Supprimer le compte",
    button: "Supprimer",
    danger: true,
    needsReason: true,
    effects: [
      "Le compte est fermé et masqué des listes (filtre « Supprimés »).",
      "Suppression non définitive : données, paiements et historique restent en base (drapeau de suppression).",
      "Vous pouvez restaurer le compte tant qu'il existe.",
    ],
  },
  restore: { title: "Restaurer le compte", button: "Restaurer", danger: false, needsReason: false, effects: ["Le compte réapparaît dans les listes et la personne peut se reconnecter (sauf s'il est aussi banni)."] },
  reset2fa: {
    title: "Réinitialiser la validation en deux étapes",
    button: "Réinitialiser",
    danger: false,
    needsReason: false,
    effects: [
      "À utiliser si la personne a perdu son téléphone ou l'accès à sa boîte mail, après avoir vérifié son identité.",
      "La validation en deux étapes est désactivée et ses sessions sont fermées : elle se reconnecte avec son seul mot de passe.",
    ],
  },
  logout: { title: "Déconnecter partout", button: "Déconnecter", danger: false, needsReason: false, effects: ["Toutes les sessions ouvertes (ordinateurs, téléphones) sont fermées. La personne peut se reconnecter."] },
};

const SUSPEND_DURATIONS = [
  { label: "24 heures", days: 1 },
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "Sans date de fin", days: 0 },
];

function ModerationModal({ user, action, onClose, onDone }: { user: AdminUser; action: ModerationAction; onClose: () => void; onDone: () => void }) {
  const copy = MODERATION_COPY[action];
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (copy.needsReason && !reason.trim()) return setError("Indiquez le motif : il est montré à la personne et conservé dans l'historique.");
    setSaving(true);
    setError(null);
    try {
      await adminApi.moderate(user.id, {
        action,
        reason: reason.trim() || undefined,
        until: action === "suspend" && days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      });
      swal.toast({ title: `${copy.title} : fait`, text: user.name });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={copy.title}
      subtitle={`${user.name} · ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <Button icon={X} size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" icon={saving ? Loader2 : copy.danger ? Ban : ShieldCheck} className={saving ? "[&>svg]:animate-spin" : ""} variant={copy.danger ? "danger" : "primary"} onClick={submit} disabled={saving}>
            {copy.button}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5 rounded-xl px-4 py-3 text-[13px]" style={{ background: copy.danger ? theme.dangerBg : theme.bg }}>
          {copy.effects.map((e) => (
            <li key={e} className="flex items-start gap-2" style={{ color: theme.text }}>
              <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: copy.danger ? theme.red : theme.gold }} />
              {e}
            </li>
          ))}
        </ul>

        {action === "suspend" && (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Durée</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Durée de la suspension">
              {SUSPEND_DURATIONS.map((d) => {
                const on = days === d.days;
                return (
                  <button
                    key={d.days}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDays(d.days)}
                    className="rounded-lg px-2.5 py-2 text-[12.5px] font-medium"
                    style={{ background: on ? theme.goldSoft : theme.bg, border: `1.5px solid ${on ? theme.gold : theme.border}`, color: on ? theme.goldDark : theme.text }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(copy.needsReason || action === "logout") && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>
              Motif {copy.needsReason ? "" : "(optionnel)"}
            </span>
            <textarea
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === "delete" ? "Demande du client, doublon, compte de test…" : "Spam, non-paiement, vente de produits interdits…"}
              className={inputClass}
              style={inputStyle}
            />
            {copy.needsReason && <span className="mt-1 block text-[11.5px]" style={{ color: theme.textMuted }}>Affiché à la personne lorsqu'elle tente de se connecter.</span>}
          </label>
        )}
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

// ─── Commissions par opérateur ──────────────────────────────────────────

const FEE_FIELDS: Array<{ id: FeeMethod; label: string }> = [
  { id: "MVOLA", label: "MVola" },
  { id: "ORANGE_MONEY", label: "Orange Money" },
  { id: "AIRTEL_MONEY", label: "Airtel Money" },
  { id: "BRED", label: "Carte bancaire" },
];

function FeeRatesCard() {
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [draft, setDraft] = useState<Record<FeeMethod, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toDraft = (r: FeeRates) => Object.fromEntries(FEE_FIELDS.map((f) => [f.id, String(r[f.id]).replace(".", ",")])) as Record<FeeMethod, string>;
  const apply = (s: FeeSettings) => {
    setSettings(s);
    setDraft(toDraft(s.rates));
  };
  useEffect(() => {
    adminApi.feeSettings().then(apply).catch((e: Error) => setError(e.message));
  }, []);

  const parsed = draft
    ? (Object.fromEntries(FEE_FIELDS.map((f) => [f.id, Number(draft[f.id].replace(",", ".").trim())])) as FeeRates)
    : null;
  const invalid = parsed ? FEE_FIELDS.some((f) => !Number.isFinite(parsed[f.id]) || parsed[f.id] < 0 || parsed[f.id] > 20) : true;
  const dirty = settings && parsed ? FEE_FIELDS.some((f) => parsed[f.id] !== settings.rates[f.id]) : false;

  const save = async (rates: FeeRates | null) => {
    setSaving(true);
    setError(null);
    try {
      apply(await adminApi.saveFeeRates(rates));
      swal.toast({ title: "Commissions enregistrées", text: "Les commissions estimées sont recalculées avec ces taux." });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Commissions par opérateur"
      subtitle="Taux appliqués quand la commission n'est pas transmise"
      icon={Percent}
      action={
        settings && (
          <span className="text-[11.5px]" style={{ color: theme.textMuted }}>
            {settings.custom && settings.updatedAt ? `Modifiées le ${fmtDate(settings.updatedAt)}` : "Tarifs publics"}
          </span>
        )
      }
    >
      {!draft ? (
        <Loader2 size={16} className="animate-spin" style={{ color: theme.textMuted }} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {FEE_FIELDS.map((f) => (
              <label key={f.id} className="block">
                <span className="mb-1 block text-[12.5px] font-medium" style={{ color: theme.text }}>{f.label}</span>
                <span className="flex items-center rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-gold/40" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
                  <input
                    value={draft[f.id]}
                    onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tabular-nums outline-none"
                    style={{ color: theme.text }}
                    aria-label={`Commission ${f.label} en pourcentage`}
                  />
                  <span className="text-[13px]" style={{ color: theme.textMuted }}>%</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="mr-auto max-w-xl text-[11.5px]" style={{ color: theme.textMuted }}>
              Utilisées quand l'opérateur ne transmet pas la commission d'un paiement (marquée « ≈ »). Une commission transmise par l'opérateur n'est jamais remplacée.
            </p>
            {settings && (
              <>
                {/* Préremplit les champs avec les tarifs publics ; « Enregistrer » les applique */}
                <Button icon={Percent} size="sm" variant="ghost" onClick={() => setDraft(toDraft(settings.presets.transit))} disabled={saving}>Tarifs Transit</Button>
                <Button icon={Percent} size="sm" variant="ghost" onClick={() => setDraft(toDraft(settings.presets.direct))} disabled={saving}>Tarifs Direct</Button>
              </>
            )}
            <Button size="sm" onClick={() => parsed && void save(parsed)} disabled={!dirty || invalid || saving} className={`${saving ? "[&>svg]:animate-spin" : ""}`} icon={saving ? Loader2 : Save}>Enregistrer</Button>
          </div>
          {invalid && <p className="mt-2 text-[12px]" style={{ color: theme.red }}>Chaque taux doit être compris entre 0 et 20 %.</p>}
          {error && <Alert variant="error" className="mt-3">{error}</Alert>}
        </>
      )}
    </Panel>
  );
}

// E-mails (codes de validation en deux étapes) : état et envoi d'un message de test
function MailTest({ mail }: { mail: AdminOverview["system"]["mail"] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ to: string; delivered: boolean; error: string | null } | null>(null);
  const Icon = mail.configured ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex flex-wrap items-start gap-2.5">
      <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color: mail.configured ? theme.green : theme.amber }} />
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-medium" style={{ color: theme.text }}>E-mails (SMTP)</p>
        <p className="text-[12px]" style={{ color: theme.textMuted }}>
          {mail.configured
            ? `${mail.host} · expéditeur ${mail.from}${mail.user ? ` · compte ${mail.user}` : ""}`
            : "Non configuré : les codes de validation par e-mail ne partent pas (affichés dans le terminal de l'API en développement)."}
        </p>
        {result && (
          <Alert variant={result.delivered ? "success" : "error"} className="mt-2">
            {result.delivered ? `E-mail de test envoyé à ${result.to} : vérifiez la boîte de réception (et les indésirables).` : result.error}
          </Alert>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={busy ? Loader2 : Mail}
        className={busy ? "[&>svg]:animate-spin" : ""}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(await adminApi.mailTest());
          } catch (e) {
            setResult({ to: "", delivered: false, error: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        Envoyer un e-mail de test
      </Button>
    </div>
  );
}
