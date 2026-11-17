import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  AlertTriangle, BarChart3, Bell, Bot, Check, ChevronRight, History, Inbox, Info, KeyRound, Lock, Mail, MessageCircle, Plug, Plus, ShieldCheck, Sparkles, Star, Trophy, Users, Settings2, UserPlus, Power, Pencil, CreditCard, } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useAccess } from "@/hooks/useAccess";
import { usePlan, fmtDate, fmtNum } from "@/hooks/usePlan";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { CountUp, Hero, Panel, ProgressRow, SkeletonCards } from "@/components/ui/Dash";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { actionMeta, detailOf } from "@/components/history/history";
import { PlatIcon } from "@/components/ui/PlatIcon";
import { plural, timeAgo } from "@/lib/format";
import { openAssociate } from "@/lib/associate";
import { ManageAccountModal } from "@/components/connections/ManageAccountModal";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";
import { statsApi, type RuleStats, type StatsOverview } from "@/lib/stats.api";
import { automationApi, type AutomationSettings } from "@/lib/automation.api";
import { billingApi, repliesLeft, type BillingOverview } from "@/lib/billing.api";
import { teamApi, type TeamOverview } from "@/lib/team.api";
import { RULE_PRESETS } from "@/components/automation/rules";
import { Avatar } from "@/components/ui/Avatar";
import { historyApi, type HistoryEntry } from "@/lib/history.api";

interface Ctx { setSub: (i: number) => void }

const CHANNEL: Record<RuleStats["channel"], string> = { ALL: "Commentaires et messages", COMMENT: "Commentaires", DIRECT: "Messages privés" };
const maskEmail = (e: string) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2");
const grad = (a: string, b: string) => ({ "--a": a, "--b": b }) as CSSProperties;

// Tableau de bord : tout ce qui demande l'attention de l'utilisateur, en cartes (comptes, file à traiter,
// chiffres de la semaine, équipe, règles, sécurité, activité)
export function DashboardPage() {
  const nav = useNavigate();
  const { setSub } = useOutletContext<Ctx>();
  const { user } = useAuth();
  const { canMenu } = useAccess();
  const { planName, subscription, can: planCan, status } = usePlan();

  const [accounts, setAccounts] = useState<WsAccount[] | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [rules, setRules] = useState<RuleStats[] | null>(null);
  const [team, setTeam] = useState<TeamOverview | null | "na">(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [managed, setManaged] = useState<WsAccount | null>(null); // compte ouvert dans « Gérer »
  const [auto, setAuto] = useState<AutomationSettings | null>(null); // activité du jour des réponses automatiques
  const [billing, setBilling] = useState<BillingOverview | null>(null); // quota de réponses IA du mois

  const go = (path: string, sub = 0) => () => {
    nav(`/app/${path}`);
    setSub(sub);
  };

  useEffect(() => {
    workspaceApi.accounts().then(setAccounts).catch(() => setAccounts([]));
    if (canMenu("stat")) statsApi.overview(7).then(setStats).catch(() => setStats(null));
    if (canMenu("auto")) {
      statsApi.rules().then(setRules).catch(() => setRules([]));
      automationApi.settings().then(setAuto).catch(() => setAuto(null));
    } else setRules([]);
    if (canMenu("set", 4)) billingApi.overview().then(setBilling).catch(() => setBilling(null));
    teamApi.overview().then(setTeam).catch(() => setTeam("na"));
    if (canMenu("hist")) historyApi.list({ limit: 20 }).then((d) => setHistory(d.items)).catch(() => setHistory([]));
    else setHistory([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = (accounts ?? []).reduce((n, a) => n + a.pending, 0);
  const broken = (accounts ?? []).filter((a) => a.syncError);
  const firstName = (user?.name ?? "").split(/\s+/)[0];
  const hasIg = (accounts ?? []).some((a) => a.platform === "INSTAGRAM");
  const hasFb = (accounts ?? []).some((a) => a.platform === "FACEBOOK");

  // Protection du compte : deux réglages qui comptent vraiment
  const twoFa = Boolean(user?.twoFactorMethod);
  const notif = Boolean(user?.desktopNotifications);
  const protectedCount = (twoFa ? 1 : 0) + (notif ? 1 : 0);

  const lastAuto = (history ?? []).find((e) => e.action === "AUTO_REPLY_SENT" || e.action === "AI_REPLY_SENT");
  const sortedRules = [...(rules ?? [])].sort((a, b) => b.hitCount - a.hitCount);
  const topRules = sortedRules.slice(0, 5);
  const maxHits = Math.max(1, ...topRules.map((r) => r.hitCount));
  // Modèles proposés : ceux dont le nom n'existe pas déjà parmi vos règles
  const suggestions = RULE_PRESETS.filter((p) => ["price", "delivery", "hours"].includes(p.id) && !(rules ?? []).some((r) => r.name.toLowerCase() === p.label.toLowerCase())).slice(0, 3);

  const share = (v: number) => (stats?.responseRate.total ? Math.round((v / stats.responseRate.total) * 100) : 0);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Rangée 1 : les comptes (pastilles) et le chiffre qui compte, « à traiter » */}
      <div className="stagger grid gap-4 lg:grid-cols-12 lg:gap-5">
        <Panel
          className="lg:col-span-8"
          title="Vos comptes"
          subtitle={accounts ? (accounts.length ? `${plural(accounts.length, "compte associé", "comptes associés")} · ${pending} en attente` : "Aucun compte associé pour l'instant") : "Chargement…"}
          icon={Plug}
          tint="#3B82F6"
          footer={
            planCan("postAiRules") ? (
              <div className="strip">
                <Check />
                <span>
                  <b>Formule {planName}</b>
                  {subscription?.periodEnd ? <> · valable jusqu'au {fmtDate(subscription.periodEnd)}</> : <> · réponses IA et règles par publication incluses</>}
                </span>
                <button className="lnk" onClick={go("parametres", 4)}>Facturation</button>
              </div>
            ) : (
              <button className="prow w-full text-left" onClick={go("parametres", 4)}>
                <span className="ico-tile sm" style={{ ...grad("#a78bfa", "#6d28d9"), color: "#fff" }}><Star size={17} strokeWidth={2.1} /></span>
                <div>
                  <b>Règles par publication</b>
                  <small>Réponses IA ciblées : disponibles avec la formule Pro.</small>
                </div>
                <Lock size={16} style={{ color: "var(--vio-ink)" }} />
              </button>
            )
          }
        >
          {accounts === null ? (
            <div className="flex flex-wrap gap-2">{[0, 1, 2].map((i) => <span key={i} className="sk h-11 w-40 !rounded-full" />)}</div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 basis-60 text-[13.5px]" style={{ color: theme.textMuted }}>Associez une Page Facebook ou un compte Instagram : SuiteFlow lit leurs commentaires et messages pour y répondre à votre place.</p>
              <Button icon={Plus} onClick={openAssociate}>Associer un compte</Button>
            </div>
          ) : (
            <>
              {/* Un compte par ligne : état à gauche de « Gérer » (coche verte quand tout est à jour) */}
              <ul className="stagger flex flex-col gap-2">
                {accounts.map((a) => (
                  <li key={a.id} className="row-s">
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={go(a.pending ? "a-traiter" : "gestion")} title={a.syncError ?? undefined}>
                      <AccountAvatar name={a.accountName} src={a.accountAvatar} platform={a.platform} size={36} />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14px] font-semibold" style={{ color: theme.text }}>{a.accountName}</b>
                        <small className="block truncate text-[12px]" style={{ color: theme.textMuted }}>{a.platform === "INSTAGRAM" ? "Compte Instagram" : "Page Facebook"}</small>
                      </span>
                      {a.syncError ? (
                        <span className="tr-ico warn md" title="À reconnecter"><AlertTriangle /></span>
                      ) : a.pending ? (
                        <span className="chip brand flex-shrink-0">{a.pending} à traiter</span>
                      ) : (
                        <span className="tr-ico ok-solid" title="À jour"><Check strokeWidth={3} /></span>
                      )}
                    </button>
                    <button className="lnk" onClick={() => setManaged(a)} aria-label={`Gérer ${a.accountName}`}>Gérer<ChevronRight /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-3 text-[13px]" style={{ color: theme.textMuted }}>
                {broken.length > 0 ? <AlertTriangle size={15} style={{ color: theme.amber }} className="flex-shrink-0" /> : <Info size={15} className="flex-shrink-0" />}
                <span className="min-w-0 flex-1 basis-56">
                  {broken.length > 0
                    ? `${plural(broken.length, "compte ne se synchronise plus", "comptes ne se synchronisent plus")} : reconnectez-${broken.length > 1 ? "les" : "le"} pour recevoir leurs messages.`
                    : !hasIg || !hasFb
                      ? `Aucun compte ${hasIg ? "Facebook" : "Instagram"} associé : ajoutez-en un pour répondre aussi à ses commentaires et messages.`
                      : "Vos commentaires et messages arrivent automatiquement dans « À traiter »."}
                </span>
                {/* Toujours proposé quand au moins un compte est associé */}
                <div className="flex flex-wrap items-center gap-2">
                  {broken.length > 0 && <Button variant="soft" icon={Plug} onClick={openAssociate}>Reconnecter</Button>}
                  <Button variant="ghost" icon={Plus} onClick={openAssociate}>Associer un autre compte</Button>
                </div>
              </div>
            </>
          )}
        </Panel>

        <Hero
          className="order-first lg:order-none lg:col-span-4"
          icon={Inbox}
          label={firstName ? `Bonjour ${firstName}` : "À traiter"}
          value={accounts === null ? "—" : <CountUp value={String(pending)} />}
          caption={
            accounts === null
              ? "Chargement…"
              : pending > 0
                ? <>{plural(pending, "message ou commentaire attend", "messages et commentaires attendent")} <b className="font-bold text-white">votre réponse</b>.</>
                : "Tout est à jour. Les réponses automatiques s'occupent du reste."
          }
        >
          <div className="flex flex-col gap-4">
            {/* Activité du jour : toujours quelque chose à lire, même quand plus rien n'attend */}
            {(auto || billing || lastAuto) && (
              <div className="flex flex-col gap-3.5">
                {auto && (
                  <>
                    <p className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
                      <span className="h-2 w-2 rounded-full" style={{ background: auto.autoReplyEnabled ? "#4ade80" : "#fbbf24", boxShadow: auto.autoReplyEnabled ? "0 0 0 3px rgba(74,222,128,0.2)" : undefined }} />
                      {auto.autoReplyEnabled ? "Réponses automatiques en ligne 24 h/24" : "Réponses automatiques en pause"}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["Répondu auto", auto.stats.autoRepliedToday],
                        ["À valider", auto.stats.suggested],
                        ["Escaladés", auto.stats.escalated],
                      ].map(([label, n]) => (
                        <div key={label as string} className="rounded-[14px] px-3 py-2.5" style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                          <p className="tabular text-[20px] font-extrabold leading-none tracking-[-0.02em] text-white"><CountUp value={String(n)} /></p>
                          <p className="mt-1 text-[11px] font-medium text-white/60">{label}</p>
                        </div>
                      ))}
                    </div>
                    {auto.stats.failed > 0 && (
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#fda4af" }}>
                        <AlertTriangle size={13} />{plural(auto.stats.failed, "échec d'envoi", "échecs d'envoi")} aujourd'hui : à vérifier dans Gestion
                      </p>
                    )}
                  </>
                )}
                {billing && !billing.subscription.admin && billing.subscription.limits.aiReplies !== null && (
                  <ProgressRow
                    dark
                    label="Quota IA du mois"
                    icon={Sparkles}
                    color="#fb923c"
                    pct={(billing.usage.aiReplies / billing.subscription.limits.aiReplies) * 100}
                    value={`${fmtNum(repliesLeft(billing).quota ?? 0)} restantes`}
                    detail={`/ ${fmtNum(billing.subscription.limits.aiReplies)}`}
                  />
                )}
                {lastAuto && (
                  <p className="flex items-start gap-2 text-[12px] leading-snug text-white/70">
                    <Bot size={14} className="mt-0.5 flex-shrink-0" />
                    <span className="min-w-0">Dernière réponse automatique {timeAgo(lastAuto.createdAt)}{(detailOf(lastAuto) ?? lastAuto.context) ? <> · <span className="text-white/90">{detailOf(lastAuto) ?? lastAuto.context}</span></> : null}</span>
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn-w" onClick={go("a-traiter")}><Inbox />Ouvrir la file</button>
              <button className="btn-g" onClick={go("regles")}><Bot />Règles</button>
            </div>
          </div>
        </Hero>
      </div>

      {/* Rangée 2 : les chiffres de la semaine, dans une seule carte avec leur titre */}
      {canMenu("stat") && (
        <Panel
          title="Les 7 derniers jours"
          subtitle="Comparés aux 7 jours précédents"
          icon={BarChart3}
          tint="#0EA5E9"
          link={{ label: "Statistiques", onClick: go("statistiques") }}
        >
          {stats === null ? (
            <SkeletonCards count={4} height={104} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
          ) : (
            <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={MessageCircle} label="Commentaires" value={String(stats.totals.comments)} color="#3B82F6" trend={trend(stats.trends.comments, stats.totals.comments)} />
              <StatCard icon={Mail} label="Messages" value={String(stats.totals.messages)} color="#8B5CF6" trend={trend(stats.trends.messages, stats.totals.messages)} />
              <StatCard icon={Users} label="Leads détectés" value={String(stats.totals.leads)} color="#F59E0B" trend={trend(stats.trends.leads, stats.totals.leads)} />
              <StatCard icon={Bot} label="Réponses IA" value={String(stats.totals.aiReplies)} color="#f05a1a" detail={stats.responseRate.total ? `${share(stats.responseRate.auto)} % traités automatiquement` : undefined} trend={trend(stats.trends.aiReplies, stats.totals.aiReplies)} />
            </div>
          )}
        </Panel>
      )}

      {/* Rangée 3 : équipe, classement des règles, protection du compte */}
      <div className="stagger grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Panel
          title="Invitez votre équipe"
          subtitle="Partagez la gestion de vos Pages"
          icon={Users}
          tint="#a855f7"
          link={canMenu("set", 3) && team !== "na" ? { label: "Gérer", onClick: go("parametres", 3) } : undefined}
        >
          {team === null ? (
            <div className="flex flex-col gap-3"><span className="sk h-9 w-24" /><span className="sk h-3 w-3/4" /><span className="sk h-11 w-full" /></div>
          ) : team === "na" ? (
            <p className="text-[13.5px]" style={{ color: theme.textMuted }}>La gestion de l'équipe est réservée au propriétaire de cet espace.</p>
          ) : team.seats === 0 ? (
            // Formule sans équipe : ce que ça apporte, et comment l'obtenir
            <div className="flex flex-col gap-3">
              <p className="text-[13.5px] leading-snug" style={{ color: theme.text }}>
                Donnez à un collaborateur l'accès aux messages, aux lives ou aux statistiques <b>seulement</b>, sans partager votre mot de passe.
              </p>
              <ul className="flex flex-col gap-1.5 text-[13px]" style={{ color: theme.textMuted }}>
                {["Droits par module : lecture ou écriture", "Chaque action porte le nom de son auteur", "Vous retirez un accès à tout moment"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: theme.green }} />{t}</li>
                ))}
              </ul>
              <div className="strip !mx-0">
                <Lock />
                <span>L'équipe est incluse à partir de la formule <b>Business</b> (5 membres).</span>
              </div>
              <button className="btn-brand h-11 rounded-[14px] text-[13.5px] font-bold" onClick={go("parametres", 4)}><Sparkles size={15} className="mr-1.5 inline" />Voir les formules</button>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <p className="hero-fig-lite tabular text-[34px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: theme.text }}>
                  <CountUp value={String(team.used)} />
                  <span className="ml-1.5 text-[18px] font-bold" style={{ color: theme.textMuted }}>/ {team.seats === null ? "∞" : team.seats}</span>
                </p>
                {team.members.length > 0 && (
                  <span className="flex -space-x-2" aria-hidden>
                    {team.members.slice(0, 4).map((m) => (
                      <span key={m.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--surface)" }}><Avatar name={m.name ?? m.email} src={m.avatarUrl} size={30} /></span>
                    ))}
                    {team.members.length > 4 && <span className="grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] font-bold" style={{ background: "var(--surface-3)", color: theme.textMuted, boxShadow: "0 0 0 2px var(--surface)" }}>+{team.members.length - 4}</span>}
                  </span>
                )}
              </div>
              {team.seats !== null && (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="progressbar" aria-valuemin={0} aria-valuemax={team.seats} aria-valuenow={team.used} aria-label="Places utilisées">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (team.used / Math.max(1, team.seats)) * 100)}%`, background: team.used >= team.seats ? "linear-gradient(90deg,#f59e0b,#dc2626)" : "linear-gradient(90deg,#c084fc,#a855f7)" }} />
                </div>
              )}
              <p className="mb-3 mt-1.5 text-[13px]" style={{ color: theme.textMuted }}>
                {plural(team.used, "place utilisée", "places utilisées")} avec la formule {team.planName}
                {team.seats !== null && team.used < team.seats ? ` · ${plural(team.seats - team.used, "place libre", "places libres")}` : ""}.
              </p>

              {team.members.length === 0 ? (
                <p className="mb-3 rounded-xl px-3.5 py-3 text-[13px] leading-snug" style={{ background: "var(--surface-2)", color: theme.textMuted }}>
                  Personne d'autre n'a encore accès à votre espace. Invitez un collaborateur par e-mail et choisissez ce qu'il peut voir et faire.
                </p>
              ) : (
                <ul className="mb-3 flex flex-col gap-1">
                  {team.members.slice(0, 3).map((m) => (
                    <li key={m.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
                      <Avatar name={m.name ?? m.email} src={m.avatarUrl} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold" style={{ color: theme.text }}>{m.name ?? m.email}</span>
                        <span className="block truncate text-[11.5px]" style={{ color: theme.textMuted }}>{m.roleLabel}</span>
                      </span>
                      <span className={`chip ${m.status === "ACTIVE" ? "ok" : m.status === "INVITED" && !m.inviteExpired ? "warn" : "off"}`}>
                        {m.status === "ACTIVE" ? "Actif" : m.status === "DISABLED" ? "Suspendu" : m.inviteExpired ? "Expirée" : "Invité"}
                      </span>
                    </li>
                  ))}
                  {team.members.length > 3 && <li className="px-1 text-xs" style={{ color: theme.textMuted }}>+ {plural(team.members.length - 3, "autre membre", "autres membres")}</li>}
                </ul>
              )}

              {team.seats !== null && team.used >= team.seats ? (
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-soft h-11 rounded-[14px] text-[13.5px] font-semibold" onClick={go("parametres", 3)}><Settings2 size={15} className="mr-1.5 inline" />Gérer</button>
                  <button className="btn-brand h-11 rounded-[14px] text-[13.5px] font-bold" onClick={go("parametres", 4)}><Sparkles size={15} className="mr-1.5 inline" />Plus de places</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-soft h-11 rounded-[14px] text-[13.5px] font-semibold" onClick={go("parametres", 3)}><Settings2 size={15} className="mr-1.5 inline" />Gérer</button>
                  <button className="btn-brand h-11 rounded-[14px] text-[13.5px] font-bold" onClick={go("parametres", 3)}><UserPlus size={15} className="mr-1.5 inline" />Inviter</button>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Règles les plus actives"
          subtitle="Total depuis la création de chaque règle"
          icon={Trophy}
          tint="#f59e0b"
          flush
          link={canMenu("auto") ? { label: "Créer", onClick: go("regles?creer=1") } : undefined}
          footer={
            <div className="strip">
              <Bot />
              <span>{rules === null ? "Chargement…" : rules.length ? <><b>{rules.length}</b> {rules.length > 1 ? "règles ont déjà répondu" : "règle a déjà répondu"}</> : "Aucune règle n'a encore répondu."}</span>
              <button className="lnk" onClick={go("regles")}>Toutes<span aria-hidden> ›</span></button>
            </div>
          }
        >
          {rules === null ? (
            <div className="flex flex-col gap-3 px-5 pb-4">{[0, 1, 2].map((i) => <span key={i} className="sk h-10 w-full" />)}</div>
          ) : topRules.length === 0 ? (
            <div className="flex flex-col gap-3 px-5 pb-5">
              <p className="text-[13.5px] leading-snug" style={{ color: theme.textMuted }}>Aucune règle n'a encore répondu. Choisissez un modèle pour commencer.</p>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((p) => (
                  <button key={p.id} className="prow w-full text-left" onClick={go(`regles?creer=${p.id}`)}>
                    <span className="ico-tile sm" style={{ ...grad("#fcd34d", "#f59e0b"), color: "#fff" }}><p.icon size={17} strokeWidth={2.1} /></span>
                    <div><b>{p.label}</b><small>{p.desc}</small></div>
                    <ChevronRight className="ml-auto flex-shrink-0" size={16} />
                  </button>
                ))}
              </div>
              <button className="btn-brand h-11 rounded-[14px] text-[13.5px] font-bold" onClick={go("regles?creer=1")}><Plus size={15} className="mr-1.5 inline" />Créer une règle</button>
            </div>
          ) : (
            <>
              {topRules.map((r, i) => (
                <button key={r.id} className="trow w-full text-left" onClick={go("regles")} title="Ouvrir mes règles">
                  <span className={`medal-rank r${i + 1}`}>{i + 1}</span>
                  <span className="tr-m">
                    <b>{r.name}</b>
                    <small>{CHANNEL[r.channel]}{r.account ? ` · ${r.account.name}` : ""}{r.lastTriggeredAt ? ` · ${timeAgo(r.lastTriggeredAt)}` : ""}</small>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (r.hitCount / maxHits) * 100)}%`, background: "linear-gradient(90deg,#fcd34d,#f59e0b)" }} />
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="tr-r">{r.hitCount}×</span>
                    <span className={`chip ${r.autoSend ? "ok" : "warn"}`}>{r.autoSend ? "Auto" : "À valider"}</span>
                  </span>
                </button>
              ))}
              {suggestions.length > 0 && topRules.length < 4 && (
                <div className="flex flex-wrap items-center gap-1.5 px-5 pb-4 pt-1.5">
                  <span className="text-xs font-semibold" style={{ color: theme.textMuted }}>Ajouter :</span>
                  {suggestions.map((p) => (
                    <button key={p.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--surface-2)", color: theme.text, border: "1px solid var(--line)" }} onClick={go(`regles?creer=${p.id}`)}>
                      <Plus size={11} /> {p.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Protection du compte"
          subtitle={`Activées : ${protectedCount} sur 2`}
          icon={ShieldCheck}
          tint="#16a34a"
          flush
          link={canMenu("set") ? { label: "Ouvrir", onClick: go("parametres", 1) } : undefined}
        >
          <div className="trow">
            <span className={`tr-ico ${twoFa ? "ok" : ""}`}>{twoFa ? <Check /> : <KeyRound />}</span>
            <span className="tr-m">
              <b>Double validation</b>
              <small>{twoFa ? (user?.twoFactorMethod === "TOTP" ? "Application d'authentification" : `Code envoyé à ${maskEmail(user?.email ?? "")}`) : "Un code en plus du mot de passe"}</small>
            </span>
            {twoFa ? <span className="chip ok">Activée</span> : <button className="btn-soft h-9 rounded-[11px] px-3.5 text-[13px] font-semibold" onClick={go("parametres", 1)}><Power size={15} className="mr-1.5 inline" />Activer</button>}
          </div>
          <div className="trow">
            <span className={`tr-ico ${notif ? "ok" : ""}`}>{notif ? <Check /> : <Bell />}</span>
            <span className="tr-m">
              <b>Alertes du navigateur</b>
              <small>{notif ? "Vous êtes prévenu des nouveaux messages" : "Soyez prévenu des messages à traiter"}</small>
            </span>
            {notif ? <span className="chip ok">Activées</span> : <button className="btn-soft h-9 rounded-[11px] px-3.5 text-[13px] font-semibold" onClick={go("parametres", 2)}><Power size={15} className="mr-1.5 inline" />Activer</button>}
          </div>
          <div className="trow">
            <span className="tr-ico"><Lock /></span>
            <span className="tr-m">
              <b>Mot de passe</b>
              <small>À changer régulièrement</small>
            </span>
            <button className="btn-soft h-9 rounded-[11px] px-3.5 text-[13px] font-semibold" onClick={go("parametres", 1)}><Pencil size={15} className="mr-1.5 inline" />Modifier</button>
          </div>
          {status === "EXPIRED" && (
            <div className="trow">
              <span className="tr-ico warn"><AlertTriangle /></span>
              <span className="tr-m"><b>Abonnement expiré</b><small>Les réponses automatiques sont en pause</small></span>
              <button className="btn-soft h-9 rounded-[11px] px-3.5 text-[13px] font-semibold" onClick={go("parametres", 4)}><CreditCard size={15} className="mr-1.5 inline" />Renouveler</button>
            </div>
          )}
        </Panel>
      </div>

      {/* Rangée 4 : activité récente */}
      {canMenu("hist") && (
        <Panel
          title="Activité récente"
          subtitle="Les dernières actions sur votre compte"
          icon={History}
          tint="#f05a1a"
          flush
          link={{ label: "Tout voir", onClick: go("historique") }}
        >
          {history === null ? (
            <div className="flex flex-col gap-3 px-5 pb-5">{[0, 1, 2].map((i) => <span key={i} className="sk h-11 w-full" />)}</div>
          ) : history.length === 0 ? (
            <p className="px-5 pb-5 text-[13.5px]" style={{ color: theme.textMuted }}>Les actions effectuées sur votre compte (réponses, programmations, connexions…) apparaîtront ici.</p>
          ) : (
            history.slice(0, 5).map((e) => {
              const m = actionMeta(e.action);
              const detail = detailOf(e) ?? e.context ?? e.account?.name ?? null;
              return (
                <div key={e.id} className="trow">
                  <span className="ico-tile sm" style={{ ...grad(`color-mix(in srgb, ${m.color} 78%, #fff)`, m.color), color: "#fff" }}><m.icon size={17} strokeWidth={2.1} /></span>
                  <span className="tr-m">
                    <b>{m.label}</b>
                    {detail && <small>{detail}</small>}
                  </span>
                  {e.account && e.account.platform !== "TIKTOK" && <PlatIcon p={e.account.platform === "INSTAGRAM" ? "ig" : "fb"} size={14} />}
                  <span className="tr-r mut">{timeAgo(e.createdAt)}</span>
                </div>
              );
            })
          )}
        </Panel>
      )}

      {managed && (
        <ManageAccountModal
          account={managed}
          onClose={() => setManaged(null)}
          onChanged={() => workspaceApi.accounts().then(setAccounts).catch(() => undefined)}
          onOpenInbox={go(managed.pending ? "a-traiter" : "gestion")}
          onOpenAssistant={go("regles", 1)}
        />
      )}
    </div>
  );
}

// Variation en %, ou « Nouveau » quand la période précédente est vide
function trend(value: number | null, current: number): string | undefined {
  if (current === 0 && (value === null || value === 0)) return undefined;
  if (value === null) return "Nouveau";
  return `${value > 0 ? "+" : ""}${value}%`;
}
