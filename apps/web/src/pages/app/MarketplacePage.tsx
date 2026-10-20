import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Link2, Package, ShoppingBag, Store, Wallet } from "lucide-react";
import { theme } from "@/theme";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ApiError } from "@/lib/api";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import {
  marketplaceApi,
  formatAriaryMk,
  NO_CATALOG,
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

interface Ctx { sub: number; setSub: (i: number) => void }

const CATALOG_SUB = 2; // Gescom → Catalogue

// noCatalog : la Page n'a pas de catalogue Facebook — ce n'est pas une erreur, on propose d'en connecter un
type Notice = { ok?: string; error?: string; noCatalog?: string };

function StatsRow({ stats }: { stats: MarketplaceStats | null }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatCard icon={Store} label="Annonces en ligne" value={String(stats.activeListings)} color={theme.green} />
      <StatCard icon={Package} label="Annonces" value={String(stats.listings)} color="#3B82F6" />
      <StatCard icon={ShoppingBag} label="Commandes" value={String(stats.orders)} color={theme.amber} />
      <StatCard icon={Wallet} label="Chiffre d'affaires" value={formatAriaryMk(stats.revenue)} color={theme.goldDark} />
    </div>
  );
}

export function MarketplacePage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[] | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [filter, setFilter] = useState<"all" | ListingStatus>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MarketplaceListing | "new" | null>(null);
  const [editingOrder, setEditingOrder] = useState<MarketplaceOrder | "new" | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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
    if (!l.push) return;
    if (l.push.ok) setNotice({ ok: l.push.message });
    else if (l.push.code === NO_CATALOG) {
      setNotice({
        noCatalog: `« ${l.title} » est enregistrée dans Gescom, mais pas encore sur Facebook : la Page « ${l.account.name} » n'a pas de catalogue connecté.`,
      });
    } else setNotice({ error: l.push.message });
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
      if (e instanceof ApiError && e.code === NO_CATALOG) {
        setNotice({ noCatalog: `Pour publier « ${l.title} » sur Facebook, connectez d'abord un catalogue à la Page « ${l.account.name} ».` });
      } else {
        setNotice({ error: e instanceof ApiError ? e.message : "Publication impossible." });
      }
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

  const bulkStatus = async (ids: string[], status: ListingStatus) => {
    await marketplaceApi.bulkUpdateStatus(ids, status);
    loadListings();
    loadStats();
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-1"
        title="Gescom"
        description="Vos produits publiés sur Facebook Marketplace, importés depuis votre Catalogue Facebook, et le suivi des commandes des acheteurs qui vous contactent."
      />

      <StatsRow stats={stats} />

      {notice?.noCatalog ? (
        <Alert
          variant="info"
          icon={Link2}
          onClose={() => setNotice(null)}
          action={
            <Button
              size="sm"
              icon={Link2}
              onClick={() => {
                setNotice(null);
                setSub(CATALOG_SUB);
              }}
            >
              Connecter un catalogue
            </Button>
          }
        >
          {notice.noCatalog}
        </Alert>
      ) : (
        notice && (
          <Alert variant={notice.error ? "error" : "success"} onClose={() => setNotice(null)}>
            {notice.error ?? notice.ok}
          </Alert>
        )
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
          onBulkStatus={bulkStatus}
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
