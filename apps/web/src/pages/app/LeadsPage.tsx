import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, Flame, History, Loader2, Phone, Search, Target, Trophy, UserPlus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { EmptyState, FilterChips, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { LeadDetail } from "@/components/leads/LeadDetail";
import { LEAD_STATUS, LEAD_STATUSES, SOURCE_LABEL, TEMPERATURE, exportLeadsCsv, temperatureOf } from "@/components/leads/leads";
import { timeAgo } from "@/lib/format";
import { leadApi, type Lead, type LeadStats, type LeadStatus, type Temperature } from "@/lib/lead.api";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";

interface Ctx { sub: number }

// Sous-menus : tous les leads, à contacter, pipeline
const VIEWS = ["all", "todo", "pipeline"] as const;
const TITLES = { all: "Leads Détectés", todo: "Leads à Contacter", pipeline: "Pipeline des Ventes" } as const;
const TEMPS: Array<{ id: "" | Temperature; label: string }> = [
  { id: "", label: "Toutes températures" },
  { id: "hot", label: "🔥 Chauds" },
  { id: "warm", label: "🌤️ Tièdes" },
  { id: "cold", label: "❄️ Froids" },
];

function ScoreBadge({ score }: { score: number }) {
  const t = TEMPERATURE[temperatureOf(score)];
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: t.bg, color: t.color }} title={`Lead ${t.label.toLowerCase()}`}>
      {t.emoji} {score}
    </span>
  );
}

function StatusSelect({ lead, onChange }: { lead: Lead; onChange: (l: Lead) => void }) {
  const meta = LEAD_STATUS[lead.status];
  return (
    <select
      value={lead.status}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => onChange(await leadApi.update(lead.id, { status: e.target.value as LeadStatus }))}
      className="cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold outline-none"
      style={{ background: meta.bg, color: meta.color }}
      aria-label="Statut du lead"
    >
      {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
    </select>
  );
}

export function LeadsPage() {
  const { sub } = useOutletContext<Ctx>();
  const view = VIEWS[sub] ?? "all";

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [accounts, setAccounts] = useState<WsAccount[]>([]);
  const [temp, setTemp] = useState<"" | Temperature>("");
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const request = useRef(0);

  const load = () => {
    const id = ++request.current;
    leadApi
      .list({ temperature: temp || undefined, accountId: accountId || undefined, q: search.trim() || undefined, status: view === "todo" ? ["NEW"] : undefined })
      .then((list) => id === request.current && setLeads(list))
      .catch(() => id === request.current && setLeads([]));
    leadApi.stats().then(setStats).catch(() => {});
  };

  useEffect(() => {
    workspaceApi.accounts().then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [view, temp, accountId, search]);
  // Nouveaux leads détectés en continu (commentaires, messages, lives)
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [view, temp, accountId, search]);

  const changed = (lead: Lead | null, id?: string) => {
    setLeads((list) => (lead ? list?.map((l) => (l.id === lead.id ? lead : l)) ?? null : list?.filter((l) => l.id !== id) ?? null));
    leadApi.stats().then(setStats).catch(() => {});
  };

  const rescan = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const r = await leadApi.rescan();
      setNotice(r.analyzed ? `${r.analyzed} message${r.analyzed > 1 ? "s" : ""} analysé${r.analyzed > 1 ? "s" : ""} · ${r.created} nouveau${r.created > 1 ? "x" : ""} lead${r.created > 1 ? "s" : ""}.` : "Historique déjà analysé : rien de nouveau.");
      load();
    } finally {
      setScanning(false);
    }
  };

  const moveTo = async (id: string, status: LeadStatus) => {
    const lead = leads?.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    setLeads((list) => list?.map((l) => (l.id === id ? { ...l, status } : l)) ?? null); // affichage immédiat
    changed(await leadApi.update(id, { status }));
  };

  const card = (label: string, value: string, Icon: LucideIcon, color: string, sub?: string) => (
    <div className="rounded-2xl p-3.5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="flex items-center gap-2">
        <span className="rounded-lg p-1.5" style={{ background: `${color}1A` }}><Icon size={15} style={{ color }} /></span>
        <span className="text-[11px]" style={{ color: theme.textMuted }}>{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold" style={{ color: theme.text }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: theme.textMuted }}>{sub}</p>}
    </div>
  );

  const byStatus = useMemo(() => Object.fromEntries(LEAD_STATUSES.map((s) => [s, (leads ?? []).filter((l) => l.status === s)])) as Record<LeadStatus, Lead[]>, [leads]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Title className="text-lg">{TITLES[view]}</Title>
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Clients potentiels repérés automatiquement : demande de prix, intention d'achat, téléphone partagé, JP en live…
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={scanning ? Loader2 : History} onClick={rescan} disabled={scanning} title="Analyser les 90 derniers jours de commentaires et de messages">
            {scanning ? "Analyse…" : "Analyser l'historique"}
          </Button>
          <Button size="sm" variant="ghost" icon={Download} onClick={() => leads && exportLeadsCsv(leads)} disabled={!leads?.length}>Exporter</Button>
        </div>
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: theme.goldSoft, color: theme.goldDark }}>
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Fermer"><X size={14} /></button>
        </p>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {card("Leads", String(stats.total), Target, theme.goldDark, `${stats.newThisWeek} cette semaine`)}
          {card("Chauds à traiter", String(stats.hot), Flame, "#dc2626")}
          {card("À contacter", String(stats.toContact), UserPlus, "#2563eb")}
          {card("Gagnés", String(stats.byStatus.WON), Trophy, "#15803d", `${stats.conversion === null ? "—" : `${stats.conversion} %`} de conversion · ${stats.wonValue.toLocaleString("fr-FR")} Ar`)}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col gap-2 rounded-2xl p-3 lg:flex-row lg:items-center" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="relative lg:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, téléphone, message…"
            className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <FilterChips items={TEMPS} value={temp} onChange={setTemp} />
        </div>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
          aria-label="Compte"
        >
          <option value="">Tous les comptes</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
        </select>
      </div>

      {leads === null ? (
        <ListSkeleton height={72} />
      ) : view === "pipeline" ? (
        <div className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="grid min-w-[900px] grid-cols-5 gap-3">
            {LEAD_STATUSES.map((s) => (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragging && moveTo(dragging, s)}
                className="flex min-h-[200px] flex-col gap-2 rounded-2xl p-2.5"
                style={{ background: dragging ? `${LEAD_STATUS[s].color}10` : theme.bg, border: `1px dashed ${dragging ? LEAD_STATUS[s].color : theme.border}` }}
              >
                <p className="flex items-center justify-between px-1 text-xs font-semibold" style={{ color: LEAD_STATUS[s].color }}>
                  {LEAD_STATUS[s].label}
                  <span className="rounded-full px-1.5 text-[10px]" style={{ background: LEAD_STATUS[s].bg }}>{byStatus[s].length}</span>
                </p>
                {byStatus[s].map((l) => (
                  <button
                    key={l.id}
                    draggable
                    onDragStart={() => setDragging(l.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setOpenId(l.id)}
                    className="cursor-grab rounded-xl p-2.5 text-left shadow-sm active:cursor-grabbing"
                    style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: theme.text }}>{l.name}</span>
                      <ScoreBadge score={l.score} />
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs" style={{ color: theme.textMuted }}>{l.lastMessage}</span>
                    <span className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: theme.textMuted }}>
                      <AccountAvatar name={l.account.name} src={l.account.avatarUrl} platform={l.account.platform} size={14} />
                      <span className="truncate">{l.account.name}</span>
                      {l.value ? <strong className="ml-auto" style={{ color: theme.text }}>{l.value.toLocaleString("fr-FR")} Ar</strong> : null}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: theme.textMuted }}>Glissez une carte d'une colonne à l'autre pour changer son statut.</p>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState icon={Target} title={search || temp || accountId ? "Aucun lead pour ces filtres" : "Aucun lead pour l'instant"}>
          {search || temp || accountId
            ? "Modifiez la recherche ou les filtres."
            : "Chaque commentaire ou message qui montre une intention d'achat apparaîtra ici. Cliquez sur « Analyser l'historique » pour examiner les messages déjà reçus."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setOpenId(l.id)}
                className="flex w-full flex-col gap-2 rounded-2xl p-3 text-left transition-all hover:shadow-sm md:flex-row md:items-center"
                style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
              >
                <span className="flex min-w-0 items-center gap-3 md:w-56">
                  <ScoreBadge score={l.score} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold" style={{ color: theme.text }}>{l.name}</span>
                    <span className="flex items-center gap-1 truncate text-[11px]" style={{ color: theme.textMuted }}>
                      <AccountAvatar name={l.account.name} src={l.account.avatarUrl} platform={l.account.platform} size={14} />
                      {SOURCE_LABEL[l.lastSource]} · {timeAgo(l.lastSeenAt)}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm" style={{ color: theme.text }}>« {l.lastMessage} »</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {l.signals.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: theme.bg, color: theme.textMuted }}>{s}</span>
                    ))}
                  </span>
                </span>
                <span className="flex items-center gap-3 md:w-64 md:justify-end">
                  {l.phone && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: theme.text }}><Phone size={11} /> {l.phone}</span>
                  )}
                  <StatusSelect lead={l} onChange={(x) => changed(x)} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <LeadDetail leadId={openId} onClose={() => setOpenId(null)} onChanged={(l) => changed(l, openId)} />}
    </div>
  );
}
