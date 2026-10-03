import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Phone, Printer, Receipt, RefreshCw, Send } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/workspace/WorkspaceUi";
import { formatAriary, liveApi, type LiveInvoice } from "@/lib/live.api";

interface Props {
  sessionId: string;
  sessionEnded: boolean;
}

// Facture modifiable (frais de livraison) : enregistrée à la perte du focus
function DeliveryFeeInput({ invoice, onSaved }: { invoice: LiveInvoice; onSaved: (inv: LiveInvoice) => void }) {
  const [value, setValue] = useState(String(invoice.deliveryFee));
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(String(invoice.deliveryFee)), [invoice.deliveryFee]);

  const save = async () => {
    const deliveryFee = Math.max(0, Number(value) || 0);
    if (deliveryFee === invoice.deliveryFee) return;
    setSaving(true);
    try {
      onSaved(await liveApi.updateInvoice(invoice.id, { deliveryFee }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      disabled={saving}
      className="w-24 rounded-lg px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-gold/40"
      style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
      aria-label="Frais de livraison"
    />
  );
}

function InvoiceRow({ invoice, onSaved }: { invoice: LiveInvoice; onSaved: (inv: LiveInvoice) => void }) {
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      onSaved(await liveApi.resendInvoice(invoice.id));
    } finally {
      setSending(false);
    }
  };

  const items = invoice.orderIds.length;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl p-3.5 sm:flex-row sm:items-center" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>
          {invoice.customerName} <span className="font-normal" style={{ color: theme.textMuted }}>· {invoice.invoiceNumber}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs" style={{ color: theme.textMuted }}>
          {invoice.phone ? <span className="flex items-center gap-1"><Phone size={11} /> {invoice.phone}</span> : "Téléphone —"}
          <span>· {items} article{items > 1 ? "s" : ""}</span>
          {invoice.sentAt ? (
            <span className="flex items-center gap-1" style={{ color: "#15803d" }}><CheckCircle2 size={11} /> Envoyé</span>
          ) : invoice.sendError ? (
            <span className="flex items-center gap-1" style={{ color: theme.red }} title={invoice.sendError}><AlertTriangle size={11} /> Échec d'envoi</span>
          ) : (
            <span>· En attente d'envoi</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: theme.textMuted }}>
        <span className="flex flex-col items-end">
          <span>Livraison</span>
          <DeliveryFeeInput invoice={invoice} onSaved={onSaved} />
        </span>
        <span className="flex flex-col items-end">
          <span>Total</span>
          <span className="text-base font-bold" style={{ color: theme.text }}>{formatAriary(invoice.total)}</span>
        </span>
      </div>

      <div className="flex gap-2">
        <a href={`/print/invoice/${invoice.id}`} target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost" icon={Printer}>Imprimer</Button>
        </a>
        <Button size="sm" variant="soft" icon={sending ? Loader2 : Send} onClick={resend} disabled={sending} className={sending ? "[&>svg]:animate-spin" : ""}>
          {invoice.sentAt ? "Renvoyer" : "Envoyer"}
        </Button>
      </div>
    </div>
  );
}

export function InvoicesPanel({ sessionId, sessionEnded }: Props) {
  const [invoices, setInvoices] = useState<LiveInvoice[] | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => liveApi.invoices(sessionId).then(setInvoices);
  useEffect(() => { setInvoices(null); load(); }, [sessionId]);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      setInvoices(await liveApi.regenerateInvoices(sessionId));
    } finally {
      setRegenerating(false);
    }
  };

  const update = (inv: LiveInvoice) => setInvoices((list) => list?.map((x) => (x.id === inv.id ? inv : x)) ?? null);

  return (
    <div className="rounded-2xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: theme.text }}>Récapitulatifs par client</p>
          <p className="text-[11px]" style={{ color: theme.textMuted }}>
            {sessionEnded
              ? "Générés automatiquement à la fin du live pour chaque participant ayant au moins un JP confirmé."
              : "Seront générés et envoyés automatiquement à chaque participant quand vous terminerez le live. Vous pouvez les prévisualiser dès maintenant."}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={regenerating ? Loader2 : RefreshCw} onClick={regenerate} disabled={regenerating} className={regenerating ? "[&>svg]:animate-spin" : ""}>
          Actualiser les factures
        </Button>
      </div>

      {invoices === null ? (
        <div className="h-24 animate-pulse rounded-xl" style={{ background: theme.bg }} />
      ) : invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucun récapitulatif pour l'instant">
          Un client doit avoir au moins un JP confirmé pour recevoir un récapitulatif.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} onSaved={update} />
          ))}
        </div>
      )}
    </div>
  );
}
