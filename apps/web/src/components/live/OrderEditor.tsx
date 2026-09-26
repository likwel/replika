import { useState } from "react";
import { AlertTriangle, Loader2, MessageSquareText, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { liveApi, type LiveOrder, type LiveProduct, type OrderInput, type OrderStatus } from "@/lib/live.api";
import { ORDER_STATUS, ORDER_STATUSES } from "./live";

interface Props {
  order?: LiveOrder | null; // absent : nouvelle commande manuelle
  sessionId: string;
  products?: LiveProduct[];
  onClose: () => void;
  onSaved: (o: LiveOrder) => void; // enregistrement : la fenêtre se ferme
  onMessageSent?: (o: LiveOrder) => void; // message : la fenêtre reste ouverte
  onRemoved?: (id: string) => void;
}

const input = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };
const toInt = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\s/g, "")))));

export function OrderEditor({ order, sessionId, products = [], onClose, onSaved, onMessageSent, onRemoved }: Props) {
  const [form, setForm] = useState({
    customerName: order?.customerName ?? "",
    fullName: order?.fullName ?? "",
    phone: order?.phone ?? "",
    address: order?.address ?? "",
    code: order?.code ?? "",
    productName: order?.productName ?? "",
    quantity: String(order?.quantity ?? 1),
    unitPrice: order?.unitPrice === null || order?.unitPrice === undefined ? "" : String(order.unitPrice),
    note: order?.note ?? "",
    status: (order?.status ?? "NEW") as OrderStatus,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | "send" | "relaunch" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Code du catalogue : article et prix remplis automatiquement
  const pickCode = (code: string) => {
    const p = products.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
    setForm((f) => ({ ...f, code, ...(p ? { productName: p.name, unitPrice: p.price === null ? f.unitPrice : String(p.price) } : {}) }));
  };

  const run = async (action: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    setOk(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      if (!form.customerName.trim()) throw new ApiError("Nom du client requis", 422);
      const body: OrderInput & { customerName: string } = {
        customerName: form.customerName.trim(),
        fullName: form.fullName.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        code: form.code.trim() || null,
        productName: form.productName.trim() || null,
        quantity: Math.max(1, toInt(form.quantity) ?? 1),
        unitPrice: toInt(form.unitPrice),
        note: form.note.trim() || null,
      };
      const saved = order ? await liveApi.updateOrder(order.id, { ...body, status: form.status }) : await liveApi.createOrder(sessionId, body);
      onSaved(saved);
    });

  const remove = () => {
    if (!order || !window.confirm("Supprimer cette commande ?")) return;
    void run("delete", async () => {
      await liveApi.removeOrder(order.id);
      onRemoved?.(order.id);
    });
  };

  const send = (text?: string) =>
    run(text ? "send" : "relaunch", async () => {
      const updated = await liveApi.message(order!.id, text);
      if (updated.error) throw new ApiError(updated.error, 502);
      setOk(text ? "Message envoyé." : "Relance envoyée.");
      setMessage("");
      onMessageSent?.(updated);
    });

  const field = (label: string, key: keyof typeof form, props: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: theme.textMuted }}>{label}</span>
      <input value={form[key]} onChange={set(key)} className={input} style={inputStyle} {...props} />
    </label>
  );

  return (
    <Modal
      title={order ? "Commande JP" : "Nouvelle Commande"}
      subtitle={order ? `${order.customerName} · ${formatDateTime(order.createdAt)}` : "Commande prise par téléphone ou en boutique."}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto flex items-center gap-1 text-xs" style={{ color: theme.red }}><AlertTriangle size={12} /> {error}</p>}
          {ok && !error && <p className="mr-auto text-xs" style={{ color: "#15803d" }}>{ok}</p>}
          {order && (
            <Button variant="ghost" size="sm" icon={Trash2} onClick={remove} disabled={busy !== null}>Supprimer</Button>
          )}
          <Button size="sm" onClick={save} disabled={busy !== null}>
            {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {order && (
          <div className="rounded-xl p-3 text-sm" style={{ background: theme.bg }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Commentaire</p>
            <p className="mt-0.5" style={{ color: theme.text }}>« {order.comment} »</p>
            {order.replies && (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Réponses du client</p>
                <p className="mt-0.5 whitespace-pre-line text-sm" style={{ color: theme.text }}>{order.replies}</p>
              </>
            )}
            {order.error && <p className="mt-2 flex items-start gap-1 text-xs" style={{ color: theme.red }}><AlertTriangle size={12} className="mt-0.5" /> {order.error}</p>}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {field("Client (nom Facebook)", "customerName", { disabled: Boolean(order?.commentId) })}
          {field("Nom complet", "fullName")}
          {field("Téléphone", "phone", { inputMode: "tel" })}
          {field("Adresse de livraison", "address")}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: theme.textMuted }}>Code</span>
            <input value={form.code} onChange={(e) => pickCode(e.target.value)} list="live-product-codes" className={input} style={inputStyle} />
            <datalist id="live-product-codes">
              {products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </datalist>
          </label>
          <div className="col-span-2 sm:col-span-1">{field("Article", "productName")}</div>
          {field("Quantité", "quantity", { inputMode: "numeric" })}
          {field("Prix unitaire (Ar)", "unitPrice", { inputMode: "numeric" })}
        </div>

        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          {order && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: theme.textMuted }}>Statut</span>
              <select value={form.status} onChange={set("status")} className={input} style={inputStyle}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
              </select>
            </label>
          )}
          {field("Note interne", "note", { placeholder: "Payé, taille, créneau de livraison…" })}
        </div>

        {order && (
          <div className="rounded-xl p-3" style={{ border: `1px solid ${theme.border}` }}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>
              <MessageSquareText size={13} /> Message au client
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Votre colis part demain matin…"
              className={input}
              style={inputStyle}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="soft" icon={Send} onClick={() => send(message.trim())} disabled={busy !== null || !message.trim()}>
                {busy === "send" ? "Envoi…" : "Envoyer"}
              </Button>
              {["NEW", "MESSAGED", "PARTIAL", "WAITLIST"].includes(order.status) && (
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => send()} disabled={busy !== null}>
                  {busy === "relaunch" ? "Relance…" : "Relancer automatiquement"}
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: theme.textMuted }}>
              {order.recipientId
                ? "Envoyé dans la conversation du client. Au-delà de 24 h sans message de sa part, Messenger l'envoie comme suivi de commande."
                : "Le client n'a pas encore de conversation : le message part en réponse privée à son commentaire (une seule fois)."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
