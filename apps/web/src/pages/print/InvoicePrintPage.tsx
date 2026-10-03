import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { formatDateTime } from "@/lib/format";
import { articleLabel, orderTotal } from "@/components/live/live";
import { formatAriary, liveApi, type LiveInvoiceDetail } from "@/lib/live.api";

type Format = "ticket" | "a5";

const PAGE_SIZE: Record<Format, string> = {
  ticket: "80mm auto",
  a5: "A5 portrait",
};

// Applique la taille de page d'impression choisie juste avant d'ouvrir la boîte de dialogue d'impression
function printAs(format: Format) {
  let style = document.getElementById("print-page-size") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "print-page-size";
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${PAGE_SIZE[format]}; margin: ${format === "ticket" ? "2mm" : "12mm"}; }`;
  window.print();
}

export function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<LiveInvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("a5");

  useEffect(() => {
    if (!id) return;
    liveApi.invoice(id).then(setInvoice).catch(() => setError("Facture introuvable."));
  }, [id]);

  if (error) return <p className="p-8 text-center text-sm" style={{ color: theme.red }}>{error}</p>;
  if (!invoice) return <div className="p-8 text-center text-sm" style={{ color: theme.textMuted }}>Chargement…</div>;

  return (
    <div style={{ background: format === "ticket" ? theme.bg : "#d8d3c8", minHeight: "100vh" }}>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}` }}>
        <Segmented
          options={[
            { value: "ticket" as const, label: "Ticket 80mm" },
            { value: "a5" as const, label: "A5" },
          ]}
          value={format}
          onChange={setFormat}
        />
        <Button size="sm" icon={Printer} onClick={() => printAs(format)}>Imprimer</Button>
      </div>

      <div
        id="invoice-sheet"
        className="mx-auto bg-white text-black"
        style={
          format === "ticket"
            ? { width: "80mm", padding: "3mm", fontFamily: "'Courier New', monospace", fontSize: "11px", lineHeight: 1.4 }
            : { width: "148mm", minHeight: "210mm", padding: "12mm", margin: "16px auto", fontSize: "13px", lineHeight: 1.5, boxShadow: "0 2px 12px rgba(0,0,0,0.15)", borderTop: `5px solid ${theme.gold}` }
        }
      >
        <div className="text-center" style={{ marginBottom: format === "ticket" ? "8px" : "20px" }}>
          <p style={{ fontWeight: 800, fontSize: format === "ticket" ? "14px" : "20px" }}>{invoice.seller.pageName}</p>
          {invoice.seller.companyName && (
            <p style={{ color: "#555", fontSize: format === "ticket" ? "10px" : "12px" }}>{invoice.seller.companyName}</p>
          )}
          {(invoice.seller.phone || invoice.seller.email || invoice.seller.address) && (
            <p style={{ color: "#666", fontSize: format === "ticket" ? "9px" : "11px" }}>
              {[invoice.seller.phone, invoice.seller.email, invoice.seller.address].filter(Boolean).join(" · ")}
            </p>
          )}
          <p style={{ color: "#555", marginTop: "4px", fontWeight: 600 }}>
            {format === "ticket" ? "Reçu" : "Facture"} n° {invoice.invoiceNumber}
          </p>
          <p style={{ color: "#777", fontSize: format === "ticket" ? "10px" : "11px" }}>{formatDateTime(invoice.createdAt)}</p>
        </div>

        <div style={{ borderTop: "1px dashed #999", borderBottom: "1px dashed #999", padding: format === "ticket" ? "6px 0" : "10px 0", marginBottom: "10px" }}>
          <p style={{ color: "#888", fontSize: format === "ticket" ? "9px" : "10px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>Facturé à</p>
          <p style={{ fontWeight: 700 }}>{invoice.customerName}</p>
          {invoice.phone && <p>{invoice.phone}</p>}
          {invoice.address && <p>{invoice.address}</p>}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          {format === "a5" && (
            <thead>
              <tr style={{ color: "#888", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ textAlign: "left", fontWeight: 600, paddingBottom: "4px", borderBottom: "1px solid #ccc" }}>Article</th>
                <th style={{ textAlign: "right", fontWeight: 600, paddingBottom: "4px", borderBottom: "1px solid #ccc" }}>Montant</th>
              </tr>
            </thead>
          )}
          <tbody>
            {invoice.orders.map((o) => (
              <tr key={o.id}>
                <td style={{ padding: "3px 0", verticalAlign: "top" }}>
                  {o.code && <strong>{o.code} · </strong>}
                  {articleLabel(o)}
                  {o.quantity > 1 && o.unitPrice !== null && (
                    <div style={{ color: "#777", fontSize: format === "ticket" ? "9px" : "11px" }}>
                      {o.quantity} x {formatAriary(o.unitPrice)}
                    </div>
                  )}
                </td>
                <td style={{ padding: "3px 0", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  {o.unitPrice === null ? "—" : formatAriary(orderTotal(o))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px dashed #999", marginTop: "8px", paddingTop: "8px" }}>
          <div className="flex justify-between"><span>Sous-total</span><span>{formatAriary(invoice.itemsTotal)}</span></div>
          <div className="flex justify-between"><span>Livraison</span><span>{formatAriary(invoice.deliveryFee)}</span></div>
          <div className="flex justify-between" style={{ fontWeight: 800, fontSize: format === "ticket" ? "13px" : "16px", marginTop: "4px", paddingTop: "4px", borderTop: format === "a5" ? "2px solid #222" : undefined }}>
            <span>Total</span><span>{formatAriary(invoice.total)}</span>
          </div>
        </div>

        <p className="text-center" style={{ marginTop: format === "ticket" ? "14px" : "28px", color: "#777", fontSize: format === "ticket" ? "10px" : "11px" }}>
          Merci pour votre confiance !
        </p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #invoice-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
