import { useState } from "react";
import { Phone, MapPin, Plus, Search, ShoppingBag } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { EmptyState, FilterChips, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { marketplaceApi, MARKETPLACE_ORDER_STATUS, formatAriaryMk, type MarketplaceOrder, type MarketplaceOrderStatus } from "@/lib/marketplace.api";

const STATUSES = Object.keys(MARKETPLACE_ORDER_STATUS) as MarketplaceOrderStatus[];
const FILTERS: Array<{ id: "all" | MarketplaceOrderStatus; label: string }> = [
  { id: "all", label: "Toutes" },
  ...STATUSES.map((s) => ({ id: s, label: MARKETPLACE_ORDER_STATUS[s].label })),
];

function StatusSelect({ order, onChanged }: { order: MarketplaceOrder; onChanged: (o: MarketplaceOrder) => void }) {
  const [busy, setBusy] = useState(false);
  const meta = MARKETPLACE_ORDER_STATUS[order.status];
  return (
    <select
      value={order.status}
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        setBusy(true);
        try {
          onChanged(await marketplaceApi.updateOrder(order.id, { status: e.target.value as MarketplaceOrderStatus }));
        } finally {
          setBusy(false);
        }
      }}
      className="cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold outline-none"
      style={{ background: meta.bg, color: meta.color }}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{MARKETPLACE_ORDER_STATUS[s].label}</option>)}
    </select>
  );
}

interface Props {
  orders: MarketplaceOrder[] | null;
  onOpen: (o: MarketplaceOrder) => void;
  onChanged: (o: MarketplaceOrder) => void;
  onAdd: () => void;
}

export function MarketplaceOrdersTable({ orders, onOpen, onChanged, onAdd }: Props) {
  const [filter, setFilter] = useState<"all" | MarketplaceOrderStatus>("all");
  const [search, setSearch] = useState("");

  const all = orders ?? [];
  const q = search.trim().toLowerCase();
  const visible = all.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (!q || [o.customerName, o.fullName, o.phone, o.address, o.listing?.title].some((v) => v?.toLowerCase().includes(q)))
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === "all" ? all.length : all.filter((o) => o.status === f.id).length]));
  const { pageItems, page, pageCount, setPage, total } = usePagination(visible, 20);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, téléphone, annonce…"
            className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <FilterChips items={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} />
        </div>
        <Button size="sm" icon={Plus} onClick={onAdd} className="lg:ml-auto">Nouvelle commande</Button>
      </div>

      {orders === null ? (
        <ListSkeleton height={64} />
      ) : visible.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={all.length ? "Aucune commande pour ces filtres" : "Aucune commande pour l'instant"}>
          {all.length ? "Modifiez la recherche ou les filtres." : "Ajoutez une commande dès qu'un acheteur vous contacte depuis Marketplace."}
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl md:block" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <table className="w-full text-sm">
              <thead style={{ background: theme.bg, color: theme.textMuted }}>
                <tr>
                  {["Client", "Annonce", "Qté", "Total", "Coordonnées", "Statut"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((o) => (
                  <tr key={o.id} onClick={() => onOpen(o)} className="cursor-pointer align-top hover:bg-black/[0.02]" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td className="max-w-[180px] px-3 py-2.5">
                      <p className="truncate font-medium" style={{ color: theme.text }}>{o.fullName ?? o.customerName}</p>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 truncate" style={{ color: theme.text }}>{o.listing?.title ?? "—"}</td>
                    <td className="px-3 py-2.5" style={{ color: theme.text }}>{o.quantity}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium" style={{ color: theme.text }}>
                      {o.unitPrice === null ? "—" : formatAriaryMk(o.unitPrice * o.quantity)}
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 text-xs" style={{ color: theme.textMuted }}>
                      {o.phone ? <p className="flex items-center gap-1" style={{ color: theme.text }}><Phone size={11} /> {o.phone}</p> : <p>Téléphone —</p>}
                      {o.address ? <p className="flex items-start gap-1 truncate"><MapPin size={11} className="mt-0.5 flex-shrink-0" /> <span className="truncate">{o.address}</span></p> : <p>Adresse —</p>}
                    </td>
                    <td className="px-3 py-2.5"><StatusSelect order={o} onChanged={onChanged} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {pageItems.map((o) => (
              <li key={o.id}>
                <button onClick={() => onOpen(o)} className="w-full rounded-2xl p-3 text-left" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{o.fullName ?? o.customerName}</p>
                      <p className="truncate text-xs" style={{ color: theme.textMuted }}>
                        {o.listing?.title ?? "—"} x{o.quantity} · {o.unitPrice === null ? "prix —" : formatAriaryMk(o.unitPrice * o.quantity)}
                      </p>
                    </div>
                    <StatusSelect order={o} onChanged={onChanged} />
                  </div>
                  <p className="mt-1.5 truncate text-xs" style={{ color: theme.textMuted }}>{o.phone ?? "Téléphone —"} · {o.address ?? "Adresse —"}</p>
                </button>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={20} />
        </>
      )}
    </div>
  );
}
