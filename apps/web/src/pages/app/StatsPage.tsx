import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { MessageCircle, Mail, Users, Bot, Zap, UserCheck, Lock, BarChart3, Megaphone } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { StatCard } from "@/components/ui/StatCard";
import { Segmented } from "@/components/ui/Segmented";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { EmptyState } from "@/components/workspace/WorkspaceUi";
import { plural, timeAgo } from "@/lib/format";
import { statsApi, DAY_RANGES, type AccountStats, type DayRange, type EngagementDay, type RuleStats, type StatsOverview } from "@/lib/stats.api";

interface Ctx { sub: number }

const CHANNEL_LABEL: Record<RuleStats["channel"], string> = { ALL: "Commentaires + messages", COMMENT: "Commentaires", DIRECT: "Messages privés" };

// Formate une variation en %, ou « Nouveau » quand il n'y a rien à comparer sur la période précédente
function formatTrend(value: number | null, current: number): string | undefined {
  if (current === 0 && (value === null || value === 0)) return undefined;
  if (value === null) return "Nouveau";
  return `${value > 0 ? "+" : ""}${value}%`;
}

export function StatsPage() {
  const { sub } = useOutletContext<Ctx>();
  return (
    <div className="flex flex-col gap-4">
      <Title className="text-lg">{["Vue Globale", "Engagement Hebdomadaire", "Rapports"][sub] ?? "Statistiques"}</Title>
      {sub === 1 ? <EngagementView /> : sub === 2 ? <ReportsView /> : <OverviewView />}
    </div>
  );
}

// ============================================================
// Vue globale
// ============================================================

function OverviewView() {
  const [data, setData] = useState<StatsOverview | null>(null);
  useEffect(() => {
    statsApi.overview().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[118px] animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />)}
      </div>
    );
  }

  const { totals, trends, responseRate } = data;
  const rates = [
    { l: "Réponses automatiques", v: responseRate.auto, c: theme.gold, icon: Zap },
    { l: "Réponses manuelles", v: responseRate.manual, c: theme.red, icon: UserCheck },
    { l: "En attente", v: responseRate.pending, c: theme.textMuted, icon: Lock },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={MessageCircle} label="Commentaires" value={String(totals.comments)} trend={formatTrend(trends.comments, totals.comments)} color={theme.gold} />
        <StatCard icon={Mail} label="Messages" value={String(totals.messages)} trend={formatTrend(trends.messages, totals.messages)} color={theme.redLight} />
        <StatCard icon={Users} label="Leads détectés" value={String(totals.leads)} trend={formatTrend(trends.leads, totals.leads)} color={theme.gold} />
        <StatCard icon={Bot} label="Réponses IA" value={String(totals.aiReplies)} trend={formatTrend(trends.aiReplies, totals.aiReplies)} color={theme.redLight} />
      </div>
      <p className="text-xs" style={{ color: theme.textMuted }}>Sur les {data.windowDays} derniers jours, comparé aux {data.windowDays} jours précédents.</p>

      <div className="mx-auto w-full max-w-7xl rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <Title className="text-base mb-1">Taux de Réponse</Title>
        {responseRate.total === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: theme.textMuted }}>Aucun commentaire ni message reçu sur la période.</p>
        ) : (
          <>
            <p className="mb-4 text-xs" style={{ color: theme.textMuted }}>
              {plural(responseRate.total, "commentaire ou message reçu", "commentaires et messages reçus")} cette semaine.
            </p>
            {rates.map((r) => {
              const pct = Math.round((r.v / responseRate.total) * 100);
              return (
                <div key={r.l} className="mb-4 last:mb-0">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: theme.text }}><r.icon size={13} style={{ color: r.c }} /> {r.l}</span>
                    <span className="font-semibold" style={{ color: r.c }}>{pct}% <span className="font-normal" style={{ color: theme.textMuted }}>({r.v})</span></span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: theme.bg }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: r.c }} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
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
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-xs" style={{ color: theme.textMuted }}>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: theme.gold }} />Facebook</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: theme.red }} />Instagram</span>
        </div>
        <div className="w-full sm:w-56">
          <Segmented options={DAY_RANGES.map((d) => ({ value: String(d), label: `${d} j` }))} value={String(days)} onChange={(v) => setDays(Number(v) as DayRange)} />
        </div>
      </div>

      {data === null ? (
        <div className="h-48 animate-pulse rounded-xl" style={{ background: theme.bg }} />
      ) : total === 0 ? (
        <EmptyState icon={BarChart3} title="Aucune activité sur cette période">
          Les commentaires et messages reçus sur vos comptes Facebook et Instagram apparaîtront ici, jour par jour.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex h-48 items-end justify-between gap-1.5 sm:gap-2" style={{ minWidth: days > 14 ? `${days * 28}px` : undefined }}>
            {data.map((d) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div className="w-1/2 rounded-t-md transition-all" style={{ height: `${Math.round((d.FACEBOOK / max) * 100)}%`, minHeight: d.FACEBOOK ? 3 : 0, background: theme.gold }} title={`Facebook : ${d.FACEBOOK}`} />
                  <div className="w-1/2 rounded-t-md transition-all" style={{ height: `${Math.round((d.INSTAGRAM / max) * 100)}%`, minHeight: d.INSTAGRAM ? 3 : 0, background: theme.red }} title={`Instagram : ${d.INSTAGRAM}`} />
                </div>
                <span className="whitespace-nowrap text-[10px] sm:text-[11px]" style={{ color: theme.textMuted }}>{dayLabel(d.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
      <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <Title className="text-base mb-1">Performance par Compte</Title>
        <p className="mb-4 text-xs" style={{ color: theme.textMuted }}>7 derniers jours.</p>
        {sortedAccounts === null ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: theme.bg }} />)}</div>
        ) : sortedAccounts.length === 0 ? (
          <EmptyState icon={Users} title="Aucun compte connecté" dashed>Connectez une Page depuis Connexions.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedAccounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: theme.bg }}>
                <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={34} />
                <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: theme.text }}>{a.name}</p>
                <div className="flex flex-shrink-0 items-center gap-3 text-xs" style={{ color: theme.textMuted }}>
                  <span title="Commentaires">💬 {a.comments}</span>
                  <span title="Messages">✉️ {a.messages}</span>
                  {a.leads > 0 && <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{a.leads} lead{a.leads > 1 ? "s" : ""}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <Title className="text-base mb-1">Règles les Plus Actives</Title>
        <p className="mb-4 text-xs" style={{ color: theme.textMuted }}>Total depuis la création de chaque règle.</p>
        {rules === null ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: theme.bg }} />)}</div>
        ) : rules.length === 0 ? (
          <EmptyState icon={Megaphone} title="Aucune règle déclenchée" dashed>Vos règles de réponse automatique apparaîtront ici une fois utilisées.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((r) => (
              <li key={r.id} className="rounded-xl p-2.5" style={{ background: theme.bg }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium" style={{ color: theme.text }}>{r.name}</p>
                  <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{r.hitCount}×</span>
                </div>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: theme.textMuted }}>
                  {CHANNEL_LABEL[r.channel]}{r.account ? ` · ${r.account.name}` : ""}{r.lastTriggeredAt ? ` · ${timeAgo(r.lastTriggeredAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
