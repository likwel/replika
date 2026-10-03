import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, MessageCircle, Package, Pause, Play, Receipt, RefreshCw, Save, Settings2, ShoppingBag, Square, Trash2, Users, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { formatAriary, liveApi, type ContactField, type LiveOrder, type LiveSession, type LiveSettings } from "@/lib/live.api";
import { OrdersTable } from "./OrdersTable";
import { OrderEditor } from "./OrderEditor";
import { CommentsFeed } from "./CommentsFeed";
import { ProductsEditor } from "./ProductsEditor";
import { SessionSettingsForm } from "./SessionSettingsForm";
import { InvoicesPanel } from "./InvoicesPanel";
import { fromRows, toRows, type ProductRow } from "./live";

interface Props {
  sessionId: string;
  onBack: () => void;
  onDeleted: () => void;
}

type Tab = "orders" | "comments" | "products" | "invoices" | "settings";
const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "orders", label: "Commandes JP", icon: ShoppingBag },
  { id: "comments", label: "Commentaires", icon: MessageCircle },
  { id: "products", label: "Articles", icon: Package },
  { id: "invoices", label: "Factures", icon: Receipt },
  { id: "settings", label: "Réglages", icon: Settings2 },
];
const REFRESH_MS = 4000;

const settingsOf = (s: LiveSession): LiveSettings => ({
  title: s.title,
  keywords: s.keywords,
  requiredFields: s.requiredFields.split(",").filter(Boolean) as ContactField[],
  autoMessage: s.autoMessage,
  replyPublic: s.replyPublic,
  firstMessage: s.firstMessage,
  missingMessage: s.missingMessage,
  confirmMessage: s.confirmMessage,
  soldOutMessage: s.soldOutMessage,
  recapMessage: s.recapMessage,
  recapUpdateMessage: s.recapUpdateMessage,
  deliveryFee: s.deliveryFee,
});

export function SessionView({ sessionId, onBack, onDeleted }: Props) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
  const [editing, setEditing] = useState<LiveOrder | "new" | null>(null);
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const dirty = useRef(false);

  const load = () => {
    liveApi.session(sessionId).then((s) => {
      setSession(s);
      if (!dirty.current) {
        setRows(toRows(s.products ?? []));
        setSettings(settingsOf(s));
      }
    });
    liveApi.orders({ sessionId }).then(setOrders);
  };

  useEffect(load, [sessionId]);

  // Pendant la session : commandes et compteurs actualisés en continu
  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [session?.status, sessionId]);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ ok });
    } catch (e) {
      setMessage({ error: e instanceof ApiError ? e.message : "Action impossible." });
    } finally {
      setBusy(null);
    }
  };

  const setStatus = (status: LiveSession["status"]) => {
    if (status === "ENDED" && !window.confirm("Terminer la session ? Les commentaires ne seront plus capturés ; les réponses des clients restent collectées pendant 7 jours.")) return;
    void act(status, async () => setSession(await liveApi.updateSession(sessionId, { status })));
  };

  const saveSettings = () =>
    act(
      "settings",
      async () => {
        const updated = await liveApi.updateSession(sessionId, settings!);
        dirty.current = false;
        setSession(updated);
      },
      "Réglages enregistrés : ils s'appliquent aux prochains JP."
    );

  const { products, error: productError } = fromRows(rows ?? []);
  const saveProducts = () =>
    act(
      "products",
      async () => {
        if (productError) throw new ApiError(productError, 422);
        await liveApi.saveProducts(sessionId, products);
        dirty.current = false;
        load();
      },
      "Catalogue enregistré."
    );

  const upsertOrder = (o: LiveOrder) => {
    setOrders((list) => (list?.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? { ...x, ...o } : x)) : [...(list ?? []), o]));
    liveApi.session(sessionId).then(setSession);
  };

  if (!session) {
    return <div className="h-64 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />;
  }

  const stats = session.stats;
  const todo = (stats.byStatus.NEW ?? 0) + (stats.byStatus.MESSAGED ?? 0) + (stats.byStatus.PARTIAL ?? 0);
  const confirmed = (stats.byStatus.CONFIRMED ?? 0) + (stats.byStatus.DELIVERED ?? 0);
  const isLive = session.liveStatus === "LIVE";
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

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Retour aux sessions">
            <ArrowLeft size={18} style={{ color: theme.text }} />
          </button>
          <span className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl" style={{ background: theme.bg }}>
            {session.thumbnail ? <img src={session.thumbnail} alt="" className="h-full w-full object-cover" /> : <AccountAvatar name={session.account.name} src={session.account.avatarUrl} platform={session.account.platform} size={48} />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold" style={{ color: theme.text }}>{session.title}</span>
              {isLive && <span className="rounded px-1.5 text-[10px] font-bold text-white" style={{ background: "#dc2626" }}>EN DIRECT</span>}
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: session.status === "ACTIVE" ? "#E7F6EC" : session.status === "PAUSED" ? "#FEF3C7" : theme.bg,
                  color: session.status === "ACTIVE" ? "#15803d" : session.status === "PAUSED" ? "#b45309" : theme.textMuted,
                }}
              >
                {session.status === "ACTIVE" ? "Capture active" : session.status === "PAUSED" ? "En pause" : "Terminée"}
              </span>
            </p>
            <p className="truncate text-xs" style={{ color: theme.textMuted }}>
              {session.account.name} · {session.sourceType === "live" ? "vidéo en direct" : "publication"}
              {session.lastPolledAt && ` · lu ${timeAgo(session.lastPolledAt)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.permalink && (
            <a href={session.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium" style={{ border: `1px solid ${theme.border}`, color: theme.text }}>
              <ExternalLink size={14} /> Voir
            </a>
          )}
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => act("sync", async () => { const r = await liveApi.sync(sessionId); load(); return r; }, "Commentaires relus.")} disabled={busy !== null || session.status === "ENDED"}>
            Actualiser
          </Button>
          {session.status === "ACTIVE" && <Button size="sm" variant="soft" icon={Pause} onClick={() => setStatus("PAUSED")} disabled={busy !== null}>Pause</Button>}
          {session.status !== "ACTIVE" && <Button size="sm" icon={Play} onClick={() => setStatus("ACTIVE")} disabled={busy !== null}>{session.status === "ENDED" ? "Relancer" : "Reprendre"}</Button>}
          {session.status !== "ENDED" && <Button size="sm" variant="ghost" icon={Square} onClick={() => setStatus("ENDED")} disabled={busy !== null}>Terminer</Button>}
        </div>
      </div>

      {session.syncError && session.status !== "ENDED" && (
        <p className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ background: "#FDECEC", color: theme.red }}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> Lecture des commentaires impossible : {session.syncError}
        </p>
      )}
      {message && (
        <p className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs" style={{ background: message.error ? "#FDECEC" : theme.goldSoft, color: message.error ? theme.red : theme.goldDark }}>
          {message.error ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />} {message.error ?? message.ok}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {card("JP capturés", String(stats.jp ?? stats.orders), ShoppingBag, theme.goldDark, `${session._count.comments} commentaires`)}
        {card("Clients", String(stats.customers), Users, "#2563eb")}
        {card("À compléter", String(todo), AlertTriangle, todo ? "#b45309" : theme.textMuted, `${confirmed} confirmée${confirmed > 1 ? "s" : ""}`)}
        {card("Chiffre d'affaires", formatAriary(stats.revenue), Wallet, "#15803d", `${stats.items} article${stats.items > 1 ? "s confirmés" : " confirmé"}`)}
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl p-1" style={{ background: theme.bg, border: `1px solid ${theme.border}` }} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: tab === t.id ? theme.bgCard : "transparent", color: tab === t.id ? theme.text : theme.textMuted }}
            role="tab"
            aria-selected={tab === t.id}
          >
            <t.icon size={15} style={{ color: tab === t.id ? theme.gold : theme.textMuted }} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <OrdersTable
          orders={orders}
          products={session.products ?? []}
          exportName={`JP - ${session.title}`}
          onOpen={setEditing}
          onChanged={upsertOrder}
          onAdd={() => setEditing("new")}
        />
      )}
      {tab === "comments" && <CommentsFeed sessionId={sessionId} active={session.status === "ACTIVE"} onOrder={upsertOrder} />}
      {tab === "invoices" && <InvoicesPanel sessionId={sessionId} sessionEnded={session.status === "ENDED"} />}
      {tab === "products" && rows && (
        <div className="rounded-2xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <ProductsEditor
            rows={rows}
            onChange={(r) => {
              dirty.current = true;
              setRows(r);
            }}
          />
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" icon={Save} onClick={saveProducts} disabled={busy !== null}>Enregistrer le catalogue</Button>
            {productError && <span className="text-xs" style={{ color: theme.red }}>{productError}</span>}
          </div>
        </div>
      )}
      {tab === "settings" && settings && (
        <div className="rounded-2xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-semibold" style={{ color: theme.text }}>Nom de la session</span>
            <input
              value={settings.title}
              onChange={(e) => {
                dirty.current = true;
                setSettings({ ...settings, title: e.target.value });
              }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
            />
          </label>
          <SessionSettingsForm
            value={settings}
            onChange={(v) => {
              dirty.current = true;
              setSettings(v);
            }}
            products={session.products ?? []}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" icon={Save} onClick={saveSettings} disabled={busy !== null}>Enregistrer les réglages</Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={() => {
                if (!window.confirm("Supprimer la session, ses commentaires et toutes ses commandes ? Exportez-les d'abord si besoin.")) return;
                void act("delete", async () => {
                  await liveApi.removeSession(sessionId);
                  onDeleted();
                });
              }}
              disabled={busy !== null}
            >
              Supprimer la session
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <OrderEditor
          order={editing === "new" ? null : editing}
          sessionId={sessionId}
          products={session.products ?? []}
          onClose={() => setEditing(null)}
          onSaved={(o) => {
            upsertOrder(o);
            setEditing(null);
          }}
          onMessageSent={upsertOrder}
          onRemoved={(id) => {
            setOrders((list) => list?.filter((o) => o.id !== id) ?? null);
            setEditing(null);
            liveApi.session(sessionId).then(setSession);
          }}
        />
      )}
    </div>
  );
}
