import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Package, ShoppingBag, Store, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { ApiError } from "@/lib/api";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import {
  marketplaceApi,
  formatAriaryMk,
  type ListingStatus,
  type MarketplaceListing,
  type MarketplaceOrder,
  type MarketplaceStats,
} from "@/lib/marketplace.api";
import { ListingsGrid } from "@/components/marketplace/ListingsGrid";
import { ListingEditor } from "@/components/marketplace/ListingEditor";
import { MarketplaceOrdersTable } from "@/components/marketplace/MarketplaceOrdersTable";
import { MarketplaceOrderEditor } from "@/components/marketplace/MarketplaceOrderEditor";
import { CatalogPanel } from "@/components/marketplace/CatalogPanel";

interface Ctx { sub: number }

function StatsRow({ stats }: { stats: MarketplaceStats | null }) {
  const card = (label: string, value: string, Icon: LucideIcon, color: string) => (
    <div className="rounded-2xl p-3" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="flex items-center gap-2">
        <span className="rounded-lg p-1.5" style={{ background: `${color}1A`, border: `1px solid ${color}2E` }}>
          <Icon size={14} style={{ color }} />
        </span>
        <span className="truncate text-[11px]" style={{ color: theme.textMuted }}>{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-bold" style={{ color: theme.text }}>{value}</p>
    </div>
  );
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {card("Annonces en ligne", String(stats.activeListings), Store, theme.green)}
      {card("Annonces", String(stats.listings), Package, "#3B82F6")}
      {card("Commandes", String(stats.orders), ShoppingBag, theme.amber)}
      {card("Chiffre d'affaires", formatAriaryMk(stats.revenue), Wallet, theme.goldDark)}
    </div>
  );
}

export function MarketplacePage() {
  const { sub } = useOutletContext<Ctx>();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[] | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [filter, setFilter] = useState<"all" | ListingStatus>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MarketplaceListing | "new" | null>(null);
  const [editingOrder, setEditingOrder] = useState<MarketplaceOrder | "new" | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);

  const loadListings = () => marketplaceApi.listings().then(setListings).catch(() => setListings([]));
  const loadOrders = () => marketplaceApi.orders().then(setOrders).catch(() => setOrders([]));
  const loadStats = () => marketplaceApi.stats().then(setStats).catch(() => {});

  useEffect(() => {
    accountApi.list().then(setAccounts).catch(() => setAccounts([]));
    loadListings();
    loadOrders();
    loadStats();
  }, []);

  const upsertListing = (l: MarketplaceListing) => {
    setListings((list) => (list?.some((x) => x.id === l.id) ? list.map((x) => (x.id === l.id ? l : x)) : [l, ...(list ?? [])]));
    setEditing(null);
    loadStats();
    // L'API tente la publication vers Facebook à l'enregistrement : on dit toujours ce qu'il en est
    if (l.push) setNotice(l.push.ok ? { ok: l.push.message } : { error: l.push.message });
  };

  // Publication à la demande d'une annonce précise
  const pushListing = async (l: MarketplaceListing) => {
    setPushing(l.id);
    setNotice(null);
    try {
      await marketplaceApi.pushListing(l.id);
      setNotice({ ok: `« ${l.title} » publiée dans votre Catalogue Facebook.` });
      loadListings();
    } catch (e) {
      setNotice({ error: e instanceof ApiError ? e.message : "Publication impossible." });
    } finally {
      setPushing(null);
    }
  };
  const removeListing = async (l: MarketplaceListing) => {
    if (!window.confirm(`Supprimer l'annonce « ${l.title} » et ses commandes ?`)) return;
    await marketplaceApi.removeListing(l.id);
    setListings((list) => list?.filter((x) => x.id !== l.id) ?? null);
    loadStats();
  };
  const upsertOrder = (o: MarketplaceOrder) => {
    setOrders((list) => (list?.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? o : x)) : [o, ...(list ?? [])]));
    setEditingOrder(null);
    loadStats();
    loadListings(); // le compteur de commandes par annonce change
  };
  const removeOrder = (id: string) => {
    setOrders((list) => list?.filter((x) => x.id !== id) ?? null);
    setEditingOrder(null);
    loadStats();
    loadListings();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Title className="text-[17px]">Gescom · Gestion commerciale</Title>
        <p className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>
          Vos produits publiés sur Facebook Marketplace, importés depuis votre Catalogue Facebook, et le suivi des commandes
          des acheteurs qui vous contactent.
        </p>
      </div>

      <StatsRow stats={stats} />

      {notice && (
        <p
          className="flex items-start gap-2 rounded-xl px-4 py-2.5 text-xs"
          style={{ background: notice.error ? "#FDECEC" : theme.greenSoft, color: notice.error ? theme.red : theme.green }}
        >
          {notice.error ? <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />}
          <span className="min-w-0 flex-1">{notice.error ?? notice.ok}</span>
          <button onClick={() => setNotice(null)} aria-label="Fermer" className="flex-shrink-0 font-bold">×</button>
        </p>
      )}

      {sub === 2 ? (
        <CatalogPanel onSynced={() => { loadListings(); loadStats(); }} />
      ) : sub === 1 ? (
        <MarketplaceOrdersTable
          orders={orders}
          onOpen={setEditingOrder}
          onChanged={upsertOrder}
          onAdd={() => setEditingOrder("new")}
        />
      ) : (
        <ListingsGrid
          listings={listings}
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
          onAdd={() => setEditing("new")}
          onEdit={setEditing}
          onDelete={removeListing}
          onPush={pushListing}
          pushing={pushing}
        />
      )}

      {editing && (
        <ListingEditor
          listing={editing === "new" ? null : editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={upsertListing}
        />
      )}
      {editingOrder && (
        <MarketplaceOrderEditor
          order={editingOrder === "new" ? null : editingOrder}
          listings={listings ?? []}
          onClose={() => setEditingOrder(null)}
          onSaved={upsertOrder}
          onRemoved={removeOrder}
        />
      )}
    </div>
  );
}
