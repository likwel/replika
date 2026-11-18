import { accountsLabel } from "@/components/automation/rules";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { MessageCircle, Mail, Users, Bot, Zap, UserCheck, Clock, BarChart3, Megaphone, ShoppingBag, Wallet, Receipt, Download, Sparkles } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { PageCard } from "@/components/ui/PageCard";
import { Hero, Panel, ProgressRow, SectionTitle, SkeletonCards, CountUp } from "@/components/ui/Dash";
import { Segmented } from "@/components/ui/Segmented";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { EmptyState } from "@/components/workspace/WorkspaceUi";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { plural, timeAgo } from "@/lib/format";
import { formatAriaryMk } from "@/lib/marketplace.api";
import { exportReportCsv } from "./stats";
import { UpgradeCard } from "@/components/billing/UpgradeCard";
import { usePlan } from "@/hooks/usePlan";
import {
  statsApi,
  DAY_RANGES,
  type AccountStats,
  type DayRange,
  type EngagementDay,
  type RevenueStats,
  type RuleStats,
  type StatsOverview,
} from "@/lib/stats.api";

interface Ctx { sub: number }

// Dégradés des plateformes (comme les pastilles de plateforme de pr.social)
const FB_BAR = "linear-gradient(180deg, #5aa2ff 0%, #1877f2 100%)";
const IG_BAR = "linear-gradient(180deg, #fa7e1e 0%, #d62976 52%, #962fbf 100%)";

const CHANNEL_LABEL: Record<RuleStats["channel"], string> = { ALL: "Commentaires + messages", COMMENT: "Commentaires", DIRECT: "Messages privés" };

// Formate une variation en %, ou « Nouveau » quand il n'y a rien à comparer sur la période précédente
function formatTrend(value: number | null, current: number): string | undefined {
  if (current === 0 && (value === null || value === 0)) return undefined;
  if (value === null) return "Nouveau";
  return `${value > 0 ? "+" : ""}${value}%`;
}

const DESCRIPTIONS = [
  "Activité de vos comptes et ventes sur la période choisie, comparée à la période précédente.",
  "Volume quotidien de commentaires et de messages reçus, par plateforme.",
  "Performance de chaque compte et règles de réponse les plus utilisées.",
];

export function StatsPage() {
  const { sub } = useOutletContext<Ctx>();
  const { can } = usePlan();
  // Vue globale : toutes les formules ; engagement et rapports : formule Pro et plus
  const locked = sub > 0 && !can("advancedStats");
  return (
    <PageCard header={<PageHeader bare className="" description={DESCRIPTIONS[sub] ?? DESCRIPTIONS[0]} />}>
      {locked ? (
        <UpgradeCard icon={BarChart3} title="Statistiques avancées">
          Engagement jour par jour, performance de chaque compte et de chaque règle, chiffre d'affaires des ventes et export des rapports. Disponible avec la formule Pro.
        </UpgradeCard>
      ) : sub === 1 ? (
        <EngagementView />
      ) : sub === 2 ? (
        <ReportsView />
      ) : (
        <OverviewView withRevenue={can("advancedStats")} />
      )}
    </PageCard>
  );
}

// ============================================================
// Vue globale
// ============================================================

function OverviewView({ withRevenue }: { withRevenue: boolean }) {
  const [days, setDays] = useState<DayRange>(7);
  const [data, setData] = useState<StatsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);

  useEffect(() => {
    setData(null);
    statsApi.overview(days).then(setData).catch(() => setData(null));
  }, [days]);

  useEffect(() => {
    if (withRevenue) statsApi.revenue().then(setRevenue).catch(() => setRevenue(null));
  }, [withRevenue]);

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="seg h-[38px] w-full sm:w-56 sk" />
        <SkeletonCards count={4} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
      </div>
    );
  }

  const { totals, trends, responseRate } = data;
  const share = (v: number) => (responseRate.total ? Math.round((v / responseRate.total) * 100) : 0);
  const rates = [
    { l: "Réponses automatiques", v: responseRate.auto, c: "#22c55e", icon: Zap },
    { l: "Réponses manuelles", v: responseRate.manual, c: "#818cf8", icon: UserCheck },
    { l: "En attente", v: responseRate.pending, c: "#fbbf24", icon: Clock },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="w-full sm:w-56">
          <Segmented options={DAY_RANGES.map((d) => ({ value: String(d), label: `${d} j` }))} value={String(days)} onChange={(v) => setDays(Number(v) as DayRange)} />
        </div>
        <p className="min-w-0 flex-1 basis-56 text-xs" style={{ color: theme.textMuted }}>Sur les {data.windowDays} derniers jours, comparé aux {data.windowDays} jours précédents.</p>
      </div>

      {/* Héros : taux de traitement automatique, avec la répartition des réponses ; les 4 chiffres clés à côté */}
      <div className="stagger grid gap-3 lg:grid-cols-12 lg:gap-5">
        <Hero
          className="lg:col-span-5"
          icon={Sparkles}
          label={`Traitement automatique · ${data.windowDays} j`}
          value={responseRate.total ? <>{share(responseRate.auto)}<span className="ml-1 text-[0.55em] font-bold opacity-70">%</span></> : "—"}
          caption={
            responseRate.total
              ? <>{plural(responseRate.total, "commentaire ou message reçu", "commentaires et messages reçus")} sur la période, dont <b className="font-bold text-white">{responseRate.auto}</b> traités sans vous.</>
              : "Aucun commentaire ni message reçu sur la période."
          }
        >
          {responseRate.total > 0 && (
            <div className="flex flex-col gap-3.5">
              {rates.map((r) => (
                <ProgressRow key={r.l} dark label={r.l} icon={r.icon} color={r.c} pct={share(r.v)} value={`${share(r.v)} %`} detail={`(${r.v})`} />
              ))}
            </div>
          )}
        </Hero>

        <div className="stagger grid grid-cols-2 gap-3 lg:col-span-7 lg:gap-5">
          <StatCard icon={MessageCircle} label="Commentaires" value={String(totals.comments)} trend={formatTrend(trends.comments, totals.comments)} color="#3B82F6" />
          <StatCard icon={Mail} label="Messages" value={String(totals.messages)} trend={formatTrend(trends.messages, totals.messages)} color="#8B5CF6" />
          <StatCard icon={Users} label="Leads détectés" value={String(totals.leads)} trend={formatTrend(trends.leads, totals.leads)} color="#F59E0B" />
          <StatCard icon={Bot} label="Réponses IA" value={String(totals.aiReplies)} trend={formatTrend(trends.aiReplies, totals.aiReplies)} color="#f05a1a" />
        </div>
      </div>

      {revenue && (
        <>
          <SectionTitle title="Ventes" subtitle={`Gescom et Lives · commandes confirmées ou livrées, ${revenue.windowDays} derniers jours`} icon={ShoppingBag} tint="#10B981" />
          <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-5">
            <StatCard icon={ShoppingBag} label="Commandes vendues" value={String(revenue.orders)} color="#10B981" />
            <StatCard icon={Wallet} label="Chiffre d'affaires" value={formatAriaryMk(revenue.revenue)} color="#f05a1a" />
            <StatCard icon={Receipt} label="Panier moyen" value={formatAriaryMk(revenue.averageOrderValue)} color="#06B6D4" />
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// Engagement
// ============================================================

function EngagementView() {
  const [days, setDays] = useState<DayRange>(7);
  const [data, setData] = useState<EngagementDay[] | null>(null);

  useEffect(() => {
    setData(null);
    statsApi.engagement(days).then(setData).catch(() => setData([]));
  }, [days]);

  const max = Math.max(1, ...(data ?? []).flatMap((d) => [d.FACEBOOK, d.INSTAGRAM]));
  const total = (data ?? []).reduce((n, d) => n + d.FACEBOOK + d.INSTAGRAM, 0);
  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return days <= 7 ? d.toLocaleDateString("fr-FR", { weekday: "short" }) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <Panel
      className="bare [&>div]:!px-0"
      title="Engagement"
      subtitle={`Commentaires et messages reçus, jour par jour · ${days} derniers jours`}
      icon={BarChart3}
      tint="#0EA5E9"
      action={
        <div className="w-full sm:w-56">
          <Segmented options={DAY_RANGES.map((d) => ({ value: String(d), label: `${d} j` }))} value={String(days)} onChange={(v) => setDays(Number(v) as DayRange)} />
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="chip off"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: FB_BAR }} />Facebook</span>
        <span className="chip off"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: IG_BAR }} />Instagram</span>
        {data && total > 0 && <span className="chip brand ml-auto"><CountUp value={String(total)} /> au total</span>}
      </div>

      {data === null ? (
        <div className="sk h-48 !rounded-[14px]" />
      ) : total === 0 ? (
        <EmptyState icon={BarChart3} title="Aucune activité sur cette période">
          Les commentaires et messages reçus sur vos comptes Facebook et Instagram apparaîtront ici, jour par jour.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          {/* Quatre filets de grille derrière les colonnes ; les colonnes poussent depuis la base */}
          <div
            className="flex h-52 items-end justify-between gap-1.5 sm:gap-2"
            style={{
              minWidth: days > 14 ? `${days * 28}px` : undefined,
              backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px)",
              backgroundSize: "100% 25%",
              backgroundPosition: "0 0",
              paddingBottom: 22,
              boxSizing: "border-box",
            }}
          >
            {data.map((d, i) => (
              <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div className="grow-h w-1/2 max-w-[18px] rounded-t-[7px]" style={{ height: `${Math.round((d.FACEBOOK / max) * 100)}%`, minHeight: d.FACEBOOK ? 3 : 0, background: FB_BAR, animationDelay: `${i * 18}ms`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)" }} />
                  <div className="grow-h w-1/2 max-w-[18px] rounded-t-[7px]" style={{ height: `${Math.round((d.INSTAGRAM / max) * 100)}%`, minHeight: d.INSTAGRAM ? 3 : 0, background: IG_BAR, animationDelay: `${i * 18 + 30}ms`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }} />
                </div>
                <span className="absolute -bottom-[22px] whitespace-nowrap text-[10px] font-medium sm:text-[11px]" style={{ color: theme.textMuted }}>{dayLabel(d.date)}</span>
                {/* Infobulle sombre au survol de la journée */}
                <div className="tip pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 text-[11.5px] font-semibold group-hover:block">
                  <p className="text-[10.5px] font-medium opacity-60">{dayLabel(d.date)}</p>
                  <p><span style={{ color: "#7db4ff" }}>●</span> Facebook {d.FACEBOOK} · <span style={{ color: "#f472b6" }}>●</span> Instagram {d.INSTAGRAM}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ============================================================
// Rapports
// ============================================================

function ReportsView() {
  const [accounts, setAccounts] = useState<AccountStats[] | null>(null);
  const [rules, setRules] = useState<RuleStats[] | null>(null);

  useEffect(() => {
    statsApi.accounts().then(setAccounts).catch(() => setAccounts([]));
    statsApi.rules().then(setRules).catch(() => setRules([]));
  }, []);

  const sortedAccounts = accounts ? [...accounts].sort((a, b) => b.comments + b.messages - (a.comments + a.messages)) : null;
  const accountsPage = usePagination(sortedAccounts ?? [], 10);
  const rulesPage = usePagination(rules ?? [], 10);

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="sm"
        variant="ghost"
        icon={Download}
        className="self-end"
        disabled={!accounts || !rules}
        onClick={() => exportReportCsv(accounts ?? [], rules ?? [])}
      >
        Exporter
      </Button>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
        <Panel title="Performance par compte" subtitle="7 derniers jours" icon={Users} tint="#3B82F6">
          {sortedAccounts === null ? (
            <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="sk h-14 !rounded-[14px]" />)}</div>
          ) : sortedAccounts.length === 0 ? (
            <EmptyState icon={Users} title="Aucun compte connecté" dashed>Connectez une Page depuis Connexions.</EmptyState>
          ) : (
            <>
              <ul className="stagger flex flex-col gap-2">
                {accountsPage.pageItems.map((a) => (
                  <li key={a.id} className="row-s">
                    <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={36} />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: theme.text }}>{a.name}</p>
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs font-semibold" style={{ color: theme.textMuted }}>
                      <span className="tabular flex items-center gap-1" title="Commentaires"><MessageCircle size={13} style={{ color: "#3B82F6" }} />{a.comments}</span>
                      <span className="tabular flex items-center gap-1" title="Messages"><Mail size={13} style={{ color: "#8B5CF6" }} />{a.messages}</span>
                      {a.leads > 0 && <span className="chip brand !text-[11px]">{a.leads} lead{a.leads > 1 ? "s" : ""}</span>}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={accountsPage.page} pageCount={accountsPage.pageCount} onChange={accountsPage.setPage} total={accountsPage.total} pageSize={10} />
            </>
          )}
        </Panel>

        <Panel title="Règles les plus actives" subtitle="Total depuis la création" icon={Megaphone} tint="#f05a1a">
          {rules === null ? (
            <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="sk h-14 !rounded-[14px]" />)}</div>
          ) : rules.length === 0 ? (
            <EmptyState icon={Megaphone} title="Aucune règle déclenchée" dashed>Vos règles de réponse automatique apparaîtront ici une fois utilisées.</EmptyState>
          ) : (
            <>
              <ul className="stagger flex flex-col gap-2">
                {rulesPage.pageItems.map((r, i) => (
                  <li key={r.id} className="row-s">
                    <span className={`medal-rank ${rulesPage.page * 10 - 10 + i < 3 ? `r${rulesPage.page * 10 - 10 + i + 1}` : ""}`}>{rulesPage.page * 10 - 10 + i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{r.name}</p>
                      <p className="mt-0.5 truncate text-[11.5px]" style={{ color: theme.textMuted }}>
                        {CHANNEL_LABEL[r.channel]}{r.accounts.length ? ` · ${accountsLabel(r.accounts)}` : ""}{r.lastTriggeredAt ? ` · ${timeAgo(r.lastTriggeredAt)}` : ""}
                      </p>
                    </div>
                    <span className="chip brand flex-shrink-0">{r.hitCount}×</span>
                  </li>
                ))}
              </ul>
              <Pagination page={rulesPage.page} pageCount={rulesPage.pageCount} onChange={rulesPage.setPage} total={rulesPage.total} pageSize={10} />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
