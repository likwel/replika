import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { marketplaceApi, MARKETPLACE_ORDER_STATUS, type MarketplaceListing, type MarketplaceOrder, type MarketplaceOrderStatus } from "@/lib/marketplace.api";

interface Props {
  order?: MarketplaceOrder | null; // absent : nouvelle commande
  listings: MarketplaceListing[];
  defaultListingId?: string;
  onClose: () => void;
  onSaved: (o: MarketplaceOrder) => void;
  onRemoved?: (id: string) => void;
}

const input = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };
const STATUSES = Object.keys(MARKETPLACE_ORDER_STATUS) as MarketplaceOrderStatus[];
const toInt = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\s/g, "")))));

export function MarketplaceOrderEditor({ order, listings, defaultListingId, onClose, onSaved, onRemoved }: Props) {
  const [listingId, setListingId] = useState(order?.listingId ?? defaultListingId ?? listings[0]?.id ?? "");
  const [form, setForm] = useState({
    customerName: order?.customerName ?? "",
    fullName: order?.fullName ?? "",
    phone: order?.phone ?? "",
    address: order?.address ?? "",
    quantity: String(order?.quantity ?? 1),
    unitPrice: order?.unitPrice === null || order?.unitPrice === undefined ? "" : String(order.unitPrice),
    note: order?.note ?? "",
    status: (order?.status ?? "NEW") as MarketplaceOrderStatus,
  });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setError(null);
    if (!form.customerName.trim()) return setError("Nom du client requis.");
    if (!order && !listingId) return setError("Choisissez une annonce.");
    setBusy("save");
    try {
      const body = {
        customerName: form.customerName.trim(),
        fullName: form.fullName.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        quantity: toInt(form.quantity) || 1,
        unitPrice: toInt(form.unitPrice),
        note: form.note.trim() || null,
        status: form.status,
      };
      const saved = order ? await marketplaceApi.updateOrder(order.id, body) : await marketplaceApi.createOrder(listingId, body);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!order || !window.confirm("Supprimer cette commande ?")) return;
    setBusy("delete");
    try {
      await marketplaceApi.removeOrder(order.id);
      onRemoved?.(order.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Suppression impossible.");
      setBusy(null);
    }
  };

  return (
    <Modal
      title={order ? "Modifier la commande" : "Nouvelle commande"}
      onClose={onClose}
      footer={
        <>
          {order && (
            <Button variant="ghost" size="sm" icon={Trash2} onClick={remove} disabled={busy !== null} className="!text-red-700 mr-auto">
              Supprimer
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={busy !== null}>
            {busy === "save" && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!order && (
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Annonce</span>
            <select className={input} style={inputStyle} value={listingId} onChange={(e) => setListingId(e.target.value)}>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Client (nom Facebook/Instagram)</span>
          <input className={input} style={inputStyle} value={form.customerName} onChange={set("customerName")} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Nom complet</span>
            <input className={input} style={inputStyle} value={form.fullName} onChange={set("fullName")} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Téléphone</span>
            <input className={input} style={inputStyle} value={form.phone} onChange={set("phone")} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Adresse</span>
          <input className={input} style={inputStyle} value={form.address} onChange={set("address")} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Quantité</span>
            <input type="number" min={1} className={input} style={inputStyle} value={form.quantity} onChange={set("quantity")} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Prix unitaire</span>
            <input type="number" min={0} className={input} style={inputStyle} value={form.unitPrice} onChange={set("unitPrice")} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Statut</span>
            <select className={input} style={inputStyle} value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => <option key={s} value={s}>{MARKETPLACE_ORDER_STATUS[s].label}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Note</span>
          <textarea className={input} style={inputStyle} rows={2} value={form.note} onChange={set("note")} />
        </label>
        {error && <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>}
      </div>
    </Modal>
  );
}
