import { useMemo, useState } from "react";
import { CheckCircle2, CloudOff, Download, Link2, Loader2, Package, Pencil, Plus, Search, ShoppingBag, Trash2, Upload } from "lucide-react";
import { theme } from "@/theme";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { EmptyState, FilterChips, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { exportListingsCsv } from "./marketplace";
import { LISTING_STATUS, type ListingStatus, type MarketplaceListing } from "@/lib/marketplace.api";

const FILTERS: Array<{ id: "all" | ListingStatus; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "ACTIVE", label: "En ligne" },
  { id: "SOLD_OUT", label: "Épuisées" },
  { id: "ARCHIVED", label: "Archivées" },
];

const SORTS = [
  { id: "recent", label: "Plus récentes" },
  { id: "price-desc", label: "Prix décroissant" },
  { id: "price-asc", label: "Prix croissant" },
  { id: "stock-asc", label: "Stock croissant" },
] as const;
type Sort = (typeof SORTS)[number]["id"];

// Seuil fixe (pas de réglage utilisateur en v1)
const LOW_STOCK = 3;

interface Props {
  listings: MarketplaceListing[] | null;
  filter: "all" | ListingStatus;
  onFilterChange: (f: "all" | ListingStatus) => void;
  search: string;
  onSearchChange: (q: string) => void;
  onAdd: () => void;
  onEdit: (l: MarketplaceListing) => void;
  onDelete: (l: MarketplaceListing) => void;
  onPush: (l: MarketplaceListing) => void;
  onBulkStatus: (ids: string[], status: ListingStatus) => Promise<void>;
  pushing: string | null; // id de l'annonce en cours de publication
}

const fmt = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("fr-FR")} Ar`);

export function ListingsGrid({ listings, filter, onFilterChange, search, onSearchChange, onAdd, onEdit, onDelete, onPush, onBulkStatus, pushing }: Props) {
  const [sort, setSort] = useState<Sort>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const all = listings ?? [];
  const q = search.trim().toLowerCase();
  const filtered = all.filter(
    (l) => (filter === "all" || l.status === filter) && (!q || l.title.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q))
  );
  const visible = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "price-desc": return list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      case "price-asc": return list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      case "stock-asc": return list.sort((a, b) => (a.stock ?? Infinity) - (b.stock ?? Infinity));
      default: return list;
    }
  }, [filtered, sort]);
  const { pageItems, page, pageCount, setPage, total } = usePagination(visible, 12);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === "all" ? all.length : all.filter((l) => l.status === f.id).length]));

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const runBulk = async (status: ListingStatus) => {
    setBulkBusy(true);
    try {
      await onBulkStatus(Array.from(selected), status);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Titre, catégorie…"
            className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <FilterChips items={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={onFilterChange} />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-xl px-2.5 py-2 text-sm outline-none"
          style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
          aria-label="Trier"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <Button size="sm" variant="ghost" icon={Download} onClick={() => exportListingsCsv(visible)} disabled={visible.length === 0}>
          Exporter CSV
        </Button>
        <Button size="sm" icon={Plus} onClick={onAdd} className="lg:ml-auto">Nouvelle annonce</Button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: theme.goldSoft, color: theme.goldDark }}>
          <span className="font-semibold">{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => runBulk("ACTIVE")}>En ligne</Button>
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => runBulk("SOLD_OUT")}>Épuisé</Button>
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => runBulk("ARCHIVED")}>Archiver</Button>
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>Désélectionner</Button>
          </div>
        </div>
      )}

      {listings === null ? (
        <ListSkeleton height={220} count={3} />
      ) : visible.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={all.length ? "Aucune annonce pour ces filtres" : "Aucune annonce pour l'instant"}>
          {all.length ? "Modifiez la recherche ou les filtres." : "Créez votre catalogue : il vous sert de référence pour publier et suivre vos ventes Marketplace."}
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((l) => {
              const status = LISTING_STATUS[l.status];
              const lowStock = l.stock !== null && l.stock > 0 && l.stock <= LOW_STOCK;
              const isSelected = selected.has(l.id);
              return (
                <div key={l.id} className="flex flex-col overflow-hidden rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${isSelected ? theme.gold : theme.border}` }}>
                  <div className="relative aspect-square" style={{ background: theme.bg }}>
                    {l.images[0] ? (
                      <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Package size={28} style={{ color: theme.textMuted }} /></div>
                    )}
                    <button
                      onClick={() => toggleSelect(l.id)}
                      aria-pressed={isSelected}
                      aria-label={isSelected ? "Désélectionner" : "Sélectionner"}
                      className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: isSelected ? theme.gold : "rgba(255,255,255,0.85)", border: `1px solid ${isSelected ? theme.gold : theme.border}` }}
                    >
                      {isSelected && <CheckCircle2 size={13} color="#fff" />}
                    </button>
                    <span className="absolute left-9 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                    {l.source === "CATALOG" && (
                      <span
                        className="absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: theme.goldSoft, color: theme.goldDark }}
                        title="Importé du Catalogue Facebook"
                      >
                        <Link2 size={10} /> Catalogue
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="line-clamp-2 text-sm font-semibold" style={{ color: theme.text }}>{l.title}</p>
                    <p className="text-sm font-bold" style={{ color: theme.goldDark }}>{fmt(l.price)}</p>
                    <p className="flex items-center gap-1 text-[11px]" style={{ color: lowStock ? theme.amber : theme.textMuted }}>
                      {l.stock === null ? "Stock illimité" : `${l.stock} en stock`} · {l._count.orders} commande{l._count.orders > 1 ? "s" : ""}
                      {lowStock && (
                        <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: theme.amberSoft, color: theme.amber }}>
                          Stock faible
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-1 text-[11px]" style={{ color: theme.textMuted }}>
                      <AccountAvatar name={l.account.name} src={l.account.avatarUrl} platform={l.account.platform} size={14} />
                      <span className="truncate">{l.account.name}</span>
                    </p>
                    {/* État de publication : sans cette ligne, rien ne distingue une annonce locale d'une annonce en ligne */}
                    <p className="flex items-center gap-1 text-[11px] font-medium" style={{ color: l.pushedAt ? theme.green : theme.textMuted }}>
                      {l.pushedAt ? <CheckCircle2 size={12} /> : <CloudOff size={12} />}
                      {l.pushedAt ? `Sur Facebook · ${timeAgo(l.pushedAt)}` : "Pas encore sur Facebook"}
                    </p>
                    <div className="mt-auto flex gap-1.5 pt-2">
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(l)} className="flex-1 justify-center">Modifier</Button>
                      <button
                        onClick={() => onPush(l)}
                        disabled={pushing === l.id}
                        className="rounded-lg p-2 hover:bg-black/5 disabled:opacity-50"
                        title="Publier cette annonce dans le Catalogue Facebook"
                        aria-label="Publier sur Facebook"
                      >
                        {pushing === l.id ? <Loader2 size={15} className="animate-spin" style={{ color: theme.goldDark }} /> : <Upload size={15} style={{ color: theme.goldDark }} />}
                      </button>
                      <button onClick={() => onDelete(l)} className="rounded-lg p-2 hover:bg-black/5" aria-label="Supprimer">
                        <Trash2 size={15} style={{ color: theme.red }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={12} />
        </>
      )}
    </div>
  );
}
