import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Phone, Printer, Receipt, RefreshCw, Send } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { EmptyState } from "@/components/workspace/WorkspaceUi";
import { formatAriary, liveApi, type LiveInvoice } from "@/lib/live.api";

const PAGE_SIZE = 15;

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

function useResend(invoice: LiveInvoice, onSaved: (inv: LiveInvoice) => void) {
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try {
      onSaved(await liveApi.resendInvoice(invoice.id));
    } finally {
      setSending(false);
    }
  };
  return { sending, resend };
}

function SendState({ invoice }: { invoice: LiveInvoice }) {
  if (invoice.sentAt) {
    return <span className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.green }}><CheckCircle2 size={12} /> Envoyé</span>;
  }
  if (invoice.sendError) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.red }} title={invoice.sendError}>
        <AlertTriangle size={12} /> Échec d'envoi
      </span>
    );
  }
  return <span className="text-xs" style={{ color: theme.textMuted }}>En attente</span>;
}

function InvoiceActions({ invoice, onSaved }: { invoice: LiveInvoice; onSaved: (inv: LiveInvoice) => void }) {
  const { sending, resend } = useResend(invoice, onSaved);
  return (
    <div className="flex justify-end gap-2">
      <a href={`/print/invoice/${invoice.id}`} target="_blank" rel="noreferrer">
        <Button size="sm" variant="ghost" icon={Printer}>Imprimer</Button>
      </a>
      <Button size="sm" variant="soft" icon={sending ? Loader2 : Send} onClick={resend} disabled={sending} className={sending ? "[&>svg]:animate-spin" : ""}>
        {invoice.sentAt ? "Renvoyer" : "Envoyer"}
      </Button>
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

  const list = invoices ?? [];
  const { pageItems, page, pageCount, setPage, total } = usePagination(list, PAGE_SIZE);
  const grandTotal = list.reduce((n, i) => n + i.total, 0);
  const th = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide";

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
      ) : list.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucun récapitulatif pour l'instant">
          Un client doit avoir au moins un JP confirmé pour recevoir un récapitulatif.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Grand écran : tableau */}
          <div className="hidden overflow-x-auto rounded-xl md:block" style={{ border: `1px solid ${theme.border}` }}>
            <table className="w-full min-w-[760px] text-sm">
              <thead style={{ background: theme.bg, color: theme.textMuted }}>
                <tr>
                  <th className={`${th} text-left`}>N° / Client</th>
                  <th className={`${th} text-left`}>Téléphone</th>
                  <th className={`${th} text-right`}>Articles</th>
                  <th className={`${th} text-right`}>Livraison</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-left`}>Envoi</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td className="max-w-[240px] px-3 py-2.5">
                      <p className="truncate font-medium" style={{ color: theme.text }}>{inv.customerName}</p>
                      <p className="truncate text-xs" style={{ color: theme.textMuted }}>{inv.invoiceNumber}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs" style={{ color: inv.phone ? theme.text : theme.textMuted }}>
                      {inv.phone ? <span className="flex items-center gap-1"><Phone size={11} /> {inv.phone}</span> : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ color: theme.text }}>{inv.orderIds.length}</td>
                    <td className="px-3 py-2.5 text-right"><DeliveryFeeInput invoice={inv} onSaved={update} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold" style={{ color: theme.text }}>{formatAriary(inv.total)}</td>
                    <td className="px-3 py-2.5"><SendState invoice={inv} /></td>
                    <td className="px-3 py-2.5"><InvoiceActions invoice={inv} onSaved={update} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : cartes */}
          <ul className="flex flex-col gap-2 md:hidden">
            {pageItems.map((inv) => (
              <li key={inv.id} className="rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
                <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>
                  {inv.customerName} <span className="font-normal" style={{ color: theme.textMuted }}>· {inv.invoiceNumber}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs" style={{ color: theme.textMuted }}>
                  {inv.phone ? <span className="flex items-center gap-1"><Phone size={11} /> {inv.phone}</span> : <span>Téléphone —</span>}
                  <span>· {inv.orderIds.length} article{inv.orderIds.length > 1 ? "s" : ""}</span>
                  <SendState invoice={inv} />
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="flex flex-col text-xs" style={{ color: theme.textMuted }}>
                    Livraison
                    <DeliveryFeeInput invoice={inv} onSaved={update} />
                  </span>
                  <span className="flex flex-col items-end text-xs" style={{ color: theme.textMuted }}>
                    Total
                    <strong className="text-base" style={{ color: theme.text }}>{formatAriary(inv.total)}</strong>
                  </span>
                </div>
                <div className="mt-2"><InvoiceActions invoice={inv} onSaved={update} /></div>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={PAGE_SIZE} />
          <p className="text-xs" style={{ color: theme.textMuted }}>
            {list.length} récapitulatif{list.length > 1 ? "s" : ""} · total facturé :{" "}
            <strong style={{ color: theme.text }}>{formatAriary(grandTotal)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
