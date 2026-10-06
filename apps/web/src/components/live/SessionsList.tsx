import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown, LayoutGrid, MessageCircle, Radio, Rows3, Search, ShoppingBag, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { StatusDot } from "@/components/ui/StatusDot";
import { Segmented } from "@/components/ui/Segmented";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { EmptyState, FilterChips } from "@/components/workspace/WorkspaceUi";
import { timeAgo } from "@/lib/format";
import { formatAriary, type LiveSession, type SessionStatus } from "@/lib/live.api";
import { SESSION_STATUS } from "./live";

const PAGE_SIZE = 15;

const FILTERS: Array<{ id: "all" | SessionStatus; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "ACTIVE", label: "Capture active" },
  { id: "PAUSED", label: "En pause" },
  { id: "ENDED", label: "Terminées" },
];

type SortKey = "title" | "status" | "comments" | "orders" | "customers" | "todo" | "revenue" | "createdAt";

const todoOf = (s: LiveSession) => (s.stats.byStatus.NEW ?? 0) + (s.stats.byStatus.MESSAGED ?? 0) + (s.stats.byStatus.PARTIAL ?? 0);
const STATUS_RANK: Record<SessionStatus, number> = { ACTIVE: 0, PAUSED: 1, ENDED: 2 };

const VALUE: Record<SortKey, (s: LiveSession) => string | number> = {
  title: (s) => s.title.toLowerCase(),
  status: (s) => STATUS_RANK[s.status],
  comments: (s) => s._count.comments,
  orders: (s) => s.stats.orders,
  customers: (s) => s.stats.customers,
  todo: todoOf,
  revenue: (s) => s.stats.revenue,
  createdAt: (s) => new Date(s.createdAt).getTime(),
};

// Le tri d'une colonne de texte part de A→Z, celui d'un nombre ou d'une date du plus grand
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  title: "asc", status: "asc", comments: "desc", orders: "desc", customers: "desc", todo: "desc", revenue: "desc", createdAt: "desc",
};

type View = "table" | "card";

interface Props {
  sessions: LiveSession[];
  onOpen: (id: string) => void;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const meta = SESSION_STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
      {status === "ACTIVE" && <StatusDot color={theme.green} size={6} pulse />}
      {meta.label}
    </span>
  );
}

function Thumb({ s, size }: { s: LiveSession; size: number }) {
  return (
    <span className="relative flex-shrink-0 overflow-hidden rounded-lg" style={{ width: size, height: size, background: theme.bg }}>
      {s.thumbnail ? (
        <img src={s.thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center"><Radio size={size * 0.45} style={{ color: theme.textMuted }} /></span>
      )}
      {s.liveStatus === "LIVE" && s.status !== "ENDED" && (
        <span className="absolute bottom-0.5 left-0.5 rounded px-1 text-[7px] font-bold text-white" style={{ background: "#dc2626" }}>LIVE</span>
      )}
    </span>
  );
}

// Vue « cartes » : une tuile par session, avec ses quatre compteurs
function SessionCard({ s, onOpen }: { s: LiveSession; onOpen: () => void }) {
  const todo = todoOf(s);
  const counters: Array<{ icon: LucideIcon; n: number; label: string; warn?: boolean }> = [
    { icon: MessageCircle, n: s._count.comments, label: "comment." },
    { icon: ShoppingBag, n: s.stats.orders, label: "JP" },
    { icon: Users, n: s.stats.customers, label: "clients" },
    { icon: AlertTriangle, n: todo, label: "à compléter", warn: todo > 0 },
  ];
  // min-w-0 : sans lui, un titre long élargit la colonne de la grille et déborde sur mobile
  return (
    <button
      onClick={onOpen}
      className="flex w-full min-w-0 flex-col gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-md"
      style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-start gap-3">
        <Thumb s={s} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" style={{ color: theme.text }}>{s.title}</p>
          <p className="flex items-center gap-1.5 truncate text-xs" style={{ color: theme.textMuted }}>
            <AccountAvatar name={s.account.name} src={s.account.avatarUrl} platform={s.account.platform} size={16} />
            {s.account.name} · {timeAgo(s.createdAt)}
          </p>
          <div className="mt-1"><StatusBadge status={s.status} /></div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {counters.map((c) => (
          <div key={c.label} className="rounded-lg py-1.5" style={{ background: theme.bg }}>
            <p className="flex items-center justify-center gap-1 text-sm font-bold" style={{ color: c.warn ? theme.amber : theme.text }}>
              <c.icon size={12} style={{ color: theme.textMuted }} /> {c.n}
            </p>
            <p className="text-[10px]" style={{ color: theme.textMuted }}>{c.label}</p>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
        <Wallet size={12} /> Confirmé : <strong style={{ color: s.stats.revenue ? theme.green : theme.text }}>{formatAriary(s.stats.revenue)}</strong>
        {s.syncError && s.status !== "ENDED" && (
          <span className="ml-auto flex items-center gap-1" style={{ color: theme.red }}><AlertTriangle size={11} /> Lecture en échec</span>
        )}
      </p>
    </button>
  );
}

export function SessionsList({ sessions, onOpen }: Props) {
  const [filter, setFilter] = useState<"all" | SessionStatus>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("table");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const filtered = sessions.filter(
      (s) => (filter === "all" || s.status === filter) && (!q || s.title.toLowerCase().includes(q) || s.account.name.toLowerCase().includes(q))
    );
    const read = VALUE[sort.key];
    return filtered.sort((a, b) => {
      const va = read(a);
      const vb = read(b);
      const r = typeof va === "string" ? va.localeCompare(String(vb), "fr") : Number(va) - Number(vb);
      return sort.dir === "asc" ? r : -r;
    });
  }, [sessions, filter, q, sort]);

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, f.id === "all" ? sessions.length : sessions.filter((s) => s.status === f.id).length])
  );
  const revenue = visible.reduce((n, s) => n + s.stats.revenue, 0);
  const { pageItems, page, pageCount, setPage, total } = usePagination(visible, PAGE_SIZE);

  const toggle = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }));

  const th = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide";
  // Fabrique d'élément (et non composant) : l'en-tête n'est pas remonté à chaque rendu, le focus clavier tient
  const sortTh = (k: SortKey, label: string, right?: boolean) => {
    const active = sort.key === k;
    const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <th className={`${th} ${right ? "text-right" : "text-left"}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          onClick={() => toggle(k)}
          className={`inline-flex items-center gap-1 uppercase hover:opacity-80 ${right ? "flex-row-reverse" : ""}`}
          style={{ color: active ? theme.text : "inherit" }}
          title={`Trier par ${label.toLowerCase()}`}
        >
          {label}
          <Icon size={12} style={{ opacity: active ? 1 : 0.35 }} />
        </button>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titre de session, Page…"
            className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
            aria-label="Rechercher une session"
          />
        </div>
        <div className="min-w-0 flex-1">
          <FilterChips items={FILTERS.map((f) => ({ id: f.id, label: f.label, count: f.id === "all" ? undefined : counts[f.id] }))} value={filter} onChange={setFilter} />
        </div>
        <div className="w-44 flex-shrink-0">
          <Segmented
            options={[
              { value: "table" as const, label: "Tableau", icon: Rows3 },
              { value: "card" as const, label: "Cartes", icon: LayoutGrid },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune session pour ces filtres">Modifiez la recherche ou les filtres.</EmptyState>
      ) : (
        <>
          {/* Vue cartes : même grille à toutes les largeurs */}
          {view === "card" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((s) => <SessionCard key={s.id} s={s} onOpen={() => onOpen(s.id)} />)}
            </div>
          )}

          {/* Vue tableau, grand écran : colonnes triables */}
          <div className={`${view === "table" ? "hidden md:block" : "hidden"} overflow-x-auto rounded-2xl`} style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <table className="w-full min-w-[840px] text-sm">
              <thead style={{ background: theme.bg, color: theme.textMuted }}>
                <tr>
                  {sortTh("title", "Session")}
                  {sortTh("status", "Statut")}
                  {sortTh("comments", "Comment.", true)}
                  {sortTh("orders", "JP", true)}
                  {sortTh("customers", "Clients", true)}
                  {sortTh("todo", "À compléter", true)}
                  {sortTh("revenue", "Confirmé", true)}
                  {sortTh("createdAt", "Date", true)}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((s) => {
                  const todo = todoOf(s);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onOpen(s.id)}
                      className="cursor-pointer hover:bg-black/[0.02]"
                      style={{ borderTop: `1px solid ${theme.border}` }}
                    >
                      <td className="max-w-[320px] px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Thumb s={s} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-medium" style={{ color: theme.text }} title={s.title}>{s.title}</p>
                            <p className="flex items-center gap-1.5 truncate text-xs" style={{ color: theme.textMuted }}>
                              <AccountAvatar name={s.account.name} src={s.account.avatarUrl} platform={s.account.platform} size={14} />
                              <span className="truncate">{s.account.name}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={s.status} />
                        {s.syncError && s.status !== "ENDED" && (
                          <p className="mt-1 text-[10px]" style={{ color: theme.red }} title={s.syncError}>Lecture en échec</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ color: theme.textMuted }}>{s._count.comments}</td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: theme.text }}>{s.stats.orders}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: theme.text }}>{s.stats.customers}</td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: todo ? theme.amber : theme.textMuted }}>{todo}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold" style={{ color: s.stats.revenue ? theme.green : theme.textMuted }}>
                        {s.stats.revenue ? formatAriary(s.stats.revenue) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs" style={{ color: theme.textMuted }} title={new Date(s.createdAt).toLocaleString("fr-FR")}>
                        {timeAgo(s.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vue tableau, mobile : lignes condensées (8 colonnes seraient illisibles) */}
          <ul className={view === "table" ? "flex flex-col gap-2 md:hidden" : "hidden"}>
            {pageItems.map((s) => {
              const todo = todoOf(s);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => onOpen(s.id)}
                    className="w-full min-w-0 rounded-2xl p-3 text-left"
                    style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
                  >
                    <div className="flex items-start gap-2.5">
                      <Thumb s={s} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{s.title}</p>
                        <p className="flex items-center gap-1.5 truncate text-[11px]" style={{ color: theme.textMuted }}>
                          <AccountAvatar name={s.account.name} src={s.account.avatarUrl} platform={s.account.platform} size={13} />
                          <span className="truncate">{s.account.name}</span> · {timeAgo(s.createdAt)}
                        </p>
                        <div className="mt-1"><StatusBadge status={s.status} /></div>
                      </div>
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" style={{ color: theme.textMuted }}>
                      <span>{s._count.comments} comment.</span>
                      <span><strong style={{ color: theme.text }}>{s.stats.orders}</strong> JP</span>
                      <span>{s.stats.customers} client{s.stats.customers > 1 ? "s" : ""}</span>
                      {todo > 0 && <span style={{ color: theme.amber }}>{todo} à compléter</span>}
                      <span className="ml-auto font-semibold" style={{ color: s.stats.revenue ? theme.green : theme.textMuted }}>
                        {s.stats.revenue ? formatAriary(s.stats.revenue) : "—"}
                      </span>
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={PAGE_SIZE} />
          <p className="text-xs" style={{ color: theme.textMuted }}>
            {visible.length} session{visible.length > 1 ? "s" : ""} · confirmé ou livré :{" "}
            <strong style={{ color: theme.text }}>{formatAriary(revenue)}</strong>
          </p>
        </>
      )}
    </div>
  );
}
