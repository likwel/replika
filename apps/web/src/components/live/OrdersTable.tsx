import { useMemo, useState } from "react";
import { AlertTriangle, Download, MessageSquare, Package, Phone, Plus, Search, ShoppingBag, Users, List, MapPin } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, FilterChips } from "@/components/workspace/WorkspaceUi";
import { formatAriary, liveApi, type LiveOrder, type LiveProduct, type OrderStatus } from "@/lib/live.api";
import { ORDER_STATUS, ORDER_STATUSES, articleLabel, customerKey, exportCsv, orderTotal } from "./live";

interface Props {
  orders: LiveOrder[] | null;
  products?: LiveProduct[];
  showSession?: boolean; // vue « toutes les sessions »
  exportName: string;
  onOpen: (o: LiveOrder) => void;
  onChanged: (o: LiveOrder) => void;
  onAdd?: () => void;
}

const FILTERS = [
  { id: "all", label: "Toutes", statuses: [] as OrderStatus[] },
  { id: "todo", label: "À compléter", statuses: ["NEW", "MESSAGED", "PARTIAL"] as OrderStatus[] },
  { id: "confirmed", label: "Confirmées", statuses: ["CONFIRMED"] as OrderStatus[] },
  { id: "waitlist", label: "Liste d'attente", statuses: ["WAITLIST"] as OrderStatus[] },
  { id: "delivered", label: "Livrées", statuses: ["DELIVERED"] as OrderStatus[] },
  { id: "canceled", label: "Annulées", statuses: ["CANCELED"] as OrderStatus[] },
];
type Group = "orders" | "customers" | "articles";
const SOLD: OrderStatus[] = ["CONFIRMED", "DELIVERED"];

function StatusSelect({ order, onChanged }: { order: LiveOrder; onChanged: (o: LiveOrder) => void }) {
  const [busy, setBusy] = useState(false);
  const meta = ORDER_STATUS[order.status];
  return (
    <select
      value={order.status}
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        setBusy(true);
        try {
          onChanged(await liveApi.updateOrder(order.id, { status: e.target.value as OrderStatus }));
        } finally {
          setBusy(false);
        }
      }}
      className="cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold outline-none"
      style={{ background: meta.bg, color: meta.color }}
      title={meta.hint}
      aria-label="Statut de la commande"
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>{ORDER_STATUS[s].label}</option>
      ))}
    </select>
  );
}

export function OrdersTable({ orders, products = [], showSession, exportName, onOpen, onChanged, onAdd }: Props) {
  const [filter, setFilter] = useState("all");
  const [group, setGroup] = useState<Group>("orders");
  const [search, setSearch] = useState("");

  const all = orders ?? [];
  const q = search.trim().toLowerCase();
  const statuses = FILTERS.find((f) => f.id === filter)!.statuses;
  const visible = all.filter(
    (o) =>
      (!statuses.length || statuses.includes(o.status)) &&
      (!q ||
        [o.customerName, o.fullName, o.phone, o.address, o.code, o.productName, o.comment, o.session?.title].some((v) => v?.toLowerCase().includes(q)))
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.statuses.length ? all.filter((o) => f.statuses.includes(o.status)).length : all.length]));

  const customers = useMemo(() => {
    const map = new Map<string, LiveOrder[]>();
    for (const o of visible) map.set(customerKey(o), [...(map.get(customerKey(o)) ?? []), o]);
    return [...map.values()].map((list) => ({
      key: customerKey(list[0]),
      name: list[0].customerName,
      fullName: list.find((o) => o.fullName)?.fullName ?? null,
      phone: list.find((o) => o.phone)?.phone ?? null,
      address: list.find((o) => o.address)?.address ?? null,
      orders: list,
      total: list.filter((o) => SOLD.includes(o.status)).reduce((n, o) => n + orderTotal(o), 0),
      todo: list.some((o) => ["NEW", "MESSAGED", "PARTIAL"].includes(o.status)),
    }));
  }, [visible]);

  const articles = useMemo(() => {
    const map = new Map<string, LiveOrder[]>();
    for (const o of visible) {
      const k = o.code ?? `libre:${o.productName ?? ""}`;
      map.set(k, [...(map.get(k) ?? []), o]);
    }
    return [...map.entries()]
      .map(([k, list]) => {
        const product = products.find((p) => p.code === list[0].code);
        const sold = list.filter((o) => SOLD.includes(o.status));
        // Les commandes confirmées/livrées sont déjà déduites de product.stock ; seules celles
        // encore en attente de confirmation sont une réservation "en plus" à afficher.
        const reserved = list.filter((o) => ["NEW", "MESSAGED", "PARTIAL"].includes(o.status)).reduce((n, o) => n + o.quantity, 0);
        return {
          key: k,
          code: list[0].code,
          name: product?.name ?? articleLabel(list[0]),
          jp: list.length,
          reserved,
          sold: sold.reduce((n, o) => n + o.quantity, 0),
          waitlist: list.filter((o) => o.status === "WAITLIST").length,
          revenue: sold.reduce((n, o) => n + orderTotal(o), 0),
          stock: product?.stock ?? null,
        };
      })
      .sort((a, b) => b.jp - a.jp);
  }, [visible, products]);

  const revenue = visible.filter((o) => SOLD.includes(o.status)).reduce((n, o) => n + orderTotal(o), 0);
  const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, téléphone, article…"
            className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
          />
        </div>
        <div className="flex-1 sm:max-w-sm">
          <Segmented
            options={[
              { value: "orders" as const, label: "Commandes", icon: List },
              { value: "customers" as const, label: "Clients", icon: Users },
              { value: "articles" as const, label: "Articles", icon: Package },
            ]}
            value={group}
            onChange={setGroup}
          />
        </div>
        <div className="flex gap-2 lg:ml-auto">
          {onAdd && <Button size="sm" variant="soft" icon={Plus} onClick={onAdd}>Ajouter</Button>}
          <Button size="sm" variant="ghost" icon={Download} onClick={() => exportCsv(visible, exportName)} disabled={!visible.length}>
            Exporter (Excel)
          </Button>
        </div>
      </div>

      <FilterChips items={FILTERS.map((f) => ({ id: f.id, label: f.label, count: f.id === "all" ? undefined : counts[f.id] }))} value={filter} onChange={setFilter} />

      {orders === null ? (
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />
      ) : visible.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={all.length ? "Aucune commande pour ces filtres" : "Aucun JP pour l'instant"}>
          {all.length ? "Modifiez la recherche ou les filtres." : "Les commentaires « jp » capturés pendant le live apparaîtront ici automatiquement."}
        </EmptyState>
      ) : group === "orders" ? (
        <>
          {/* Grand écran : tableau */}
          <div className="hidden overflow-x-auto rounded-2xl md:block" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <table className="w-full text-sm">
              <thead style={{ background: theme.bg, color: theme.textMuted }}>
                <tr>
                  <th className={th}>Heure</th>
                  <th className={th}>Client</th>
                  <th className={th}>Article</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={th}>Coordonnées</th>
                  <th className={th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} onClick={() => onOpen(o)} className="cursor-pointer align-top hover:bg-black/[0.02]" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs" style={{ color: theme.textMuted }}>
                      {new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {showSession && o.session && <span className="block max-w-[120px] truncate">{o.session.title}</span>}
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5">
                      <p className="truncate font-medium" style={{ color: theme.text }}>{o.fullName ?? o.customerName}</p>
                      <p className="truncate text-xs" style={{ color: theme.textMuted }} title={o.comment}>« {o.comment} »</p>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5">
                      <p className="truncate" style={{ color: theme.text }}>
                        {o.code && <span className="mr-1 rounded px-1 text-[11px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{o.code}</span>}
                        {articleLabel(o)}
                      </p>
                      {o.quantity > 1 && <p className="text-xs" style={{ color: theme.textMuted }}>Quantité : {o.quantity}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium" style={{ color: theme.text }}>
                      {o.unitPrice === null ? "—" : formatAriary(orderTotal(o))}
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 text-xs" style={{ color: theme.textMuted }}>
                      {o.phone ? <p className="flex items-center gap-1" style={{ color: theme.text }}><Phone size={11} /> {o.phone}</p> : <p>Téléphone —</p>}
                      {o.address ? <p className="flex items-start gap-1 truncate"><MapPin size={11} className="mt-0.5 flex-shrink-0" /> <span className="truncate">{o.address}</span></p> : <p>Adresse —</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusSelect order={o} onChanged={onChanged} />
                      {o.error && (
                        <p className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: theme.red }} title={o.error}>
                          <AlertTriangle size={10} /> Envoi en échec
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : cartes */}
          <ul className="flex flex-col gap-2 md:hidden">
            {visible.map((o) => (
              <li key={o.id}>
                <button onClick={() => onOpen(o)} className="w-full rounded-2xl p-3 text-left" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{o.fullName ?? o.customerName}</p>
                      <p className="truncate text-xs" style={{ color: theme.textMuted }}>
                        {o.code && <strong style={{ color: theme.goldDark }}>{o.code} </strong>}
                        {articleLabel(o)} {o.quantity > 1 && `x${o.quantity}`} · {o.unitPrice === null ? "prix —" : formatAriary(orderTotal(o))}
                      </p>
                    </div>
                    <StatusSelect order={o} onChanged={onChanged} />
                  </div>
                  <p className="mt-1.5 truncate text-xs" style={{ color: theme.textMuted }}>
                    {o.phone ?? "Téléphone —"} · {o.address ?? "Adresse —"}
                  </p>
                  {o.error && <p className="mt-1 text-[11px]" style={{ color: theme.red }}>{o.error}</p>}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : group === "customers" ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {customers.map((c) => (
            <li key={c.key} className="rounded-2xl p-3.5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{c.fullName ?? c.name}</p>
                  {c.fullName && c.fullName !== c.name && <p className="truncate text-[11px]" style={{ color: theme.textMuted }}>Facebook : {c.name}</p>}
                </div>
                <span className="text-sm font-semibold" style={{ color: theme.text }}>{c.total ? formatAriary(c.total) : ""}</span>
              </div>
              <p className="mt-1 text-xs" style={{ color: c.phone ? theme.text : theme.textMuted }}>
                {c.phone ?? "Téléphone —"} · {c.address ?? "Adresse —"}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => onOpen(o)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-black/[0.03]" style={{ background: theme.bg }}>
                      <span className="min-w-0 flex-1 truncate" style={{ color: theme.text }}>
                        {o.code && <strong>{o.code} · </strong>}
                        {articleLabel(o)} {o.quantity > 1 && `x${o.quantity}`}
                      </span>
                      <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: ORDER_STATUS[o.status].bg, color: ORDER_STATUS[o.status].color }}>
                        {ORDER_STATUS[o.status].label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {c.todo && (
                <button onClick={() => onOpen(c.orders.find((o) => ["NEW", "MESSAGED", "PARTIAL"].includes(o.status))!)} className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: theme.goldDark }}>
                  <MessageSquare size={12} /> Compléter / relancer
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <table className="w-full min-w-[560px] text-sm">
            <thead style={{ background: theme.bg, color: theme.textMuted }}>
              <tr>
                <th className={th}>Article</th>
                <th className={`${th} text-right`}>JP</th>
                <th className={`${th} text-right`}>Réservés</th>
                <th className={`${th} text-right`}>Stock</th>
                <th className={`${th} text-right`}>Attente</th>
                <th className={`${th} text-right`}>Vendu</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.key} className="cursor-pointer hover:bg-black/[0.02]" style={{ borderTop: `1px solid ${theme.border}` }} onClick={() => setSearch(a.code ?? a.name)}>
                  <td className="px-3 py-2.5">
                    {a.code && <span className="mr-1.5 rounded px-1 text-[11px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{a.code}</span>}
                    <span style={{ color: theme.text }}>{a.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ color: theme.text }}>{a.jp}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: theme.text }}>{a.reserved}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: a.stock !== null && a.reserved >= a.stock ? theme.red : theme.textMuted }}>
                    {a.stock === null ? "∞" : `${Math.max(0, a.stock - a.reserved)} / ${a.stock}`}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ color: a.waitlist ? "#7c3aed" : theme.textMuted }}>{a.waitlist}</td>
                  <td className="px-3 py-2.5 text-right font-medium" style={{ color: theme.text }}>{a.revenue ? formatAriary(a.revenue) : `${a.sold}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length > 0 && (
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {visible.length} commande{visible.length > 1 ? "s" : ""} · {customers.length} client{customers.length > 1 ? "s" : ""} · confirmé ou livré :{" "}
          <strong style={{ color: theme.text }}>{formatAriary(revenue)}</strong>
        </p>
      )}
    </div>
  );
}
