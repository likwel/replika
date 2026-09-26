import { theme } from "@/theme";
import type { ContactField, LiveOrder, LiveProduct, OrderStatus } from "@/lib/live.api";

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string; bg: string; hint: string }> = {
  NEW: { label: "Nouveau", color: theme.textMuted, bg: theme.bg, hint: "JP capturé, client pas encore contacté" },
  MESSAGED: { label: "Message envoyé", color: "#2563eb", bg: "#E8F0FE", hint: "En attente de la réponse du client" },
  PARTIAL: { label: "Infos incomplètes", color: "#b45309", bg: "#FEF3C7", hint: "Le client a répondu, il manque des informations" },
  CONFIRMED: { label: "Confirmé", color: "#15803d", bg: "#E7F6EC", hint: "Coordonnées complètes" },
  WAITLIST: { label: "Liste d'attente", color: "#7c3aed", bg: "#F1ECFE", hint: "Article épuisé" },
  DELIVERED: { label: "Livré", color: theme.goldDark, bg: theme.goldSoft, hint: "Commande livrée" },
  CANCELED: { label: "Annulé", color: theme.red, bg: "#FDECEC", hint: "Commande annulée" },
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];

export const FIELD_OPTIONS: Array<{ value: ContactField; label: string }> = [
  { value: "nom", label: "Nom complet" },
  { value: "telephone", label: "Téléphone" },
  { value: "adresse", label: "Adresse de livraison" },
];

export const VARIABLES: Array<[string, string]> = [
  ["{nom}", "prénom du client"],
  ["{produit}", "article commandé"],
  ["{code}", "code de l'article"],
  ["{prix}", "prix (quantité comprise)"],
  ["{quantite}", "quantité"],
  ["{articles}", "récapitulatif de ses articles"],
  ["{total}", "total de ses articles"],
  ["{manquant}", "informations encore manquantes"],
  ["{telephone}", "téléphone reçu"],
  ["{adresse}", "adresse reçue"],
  ["{page}", "nom de la Page"],
];

export const orderTotal = (o: Pick<LiveOrder, "unitPrice" | "quantity">) => (o.unitPrice ?? 0) * o.quantity;
export const articleLabel = (o: Pick<LiveOrder, "productName" | "code">) => o.productName ?? (o.code ? `Article ${o.code}` : "Article non précisé");
export const customerKey = (o: Pick<LiveOrder, "customerId" | "customerName">) => o.customerId ?? `nom:${o.customerName}`;

// Export tableur : séparateur « ; » et BOM pour une ouverture directe dans Excel (français)
export function exportCsv(orders: LiveOrder[], fileName: string) {
  const header = ["Session", "Date", "Client (Facebook)", "Nom complet", "Téléphone", "Adresse", "Code", "Article", "Quantité", "Prix unitaire", "Total", "Statut", "Commentaire", "Note"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = orders.map((o) => [
    o.session?.title ?? "",
    new Date(o.createdAt).toLocaleString("fr-FR"),
    o.customerName,
    o.fullName,
    o.phone,
    o.address,
    o.code,
    articleLabel(o),
    o.quantity,
    o.unitPrice,
    o.unitPrice === null ? "" : orderTotal(o),
    ORDER_STATUS[o.status].label,
    o.comment,
    o.note,
  ]);
  const csv = "\ufeff" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// Catalogue : lignes éditables (texte) ↔ articles
// ============================================================

export interface ProductRow {
  code: string;
  name: string;
  price: string;
  stock: string;
}

export const toRows = (products: LiveProduct[]): ProductRow[] =>
  products.map((p) => ({ code: p.code, name: p.name, price: p.price === null ? "" : String(p.price), stock: p.stock === null ? "" : String(p.stock) }));

const toInt = (v: string) => {
  const n = Number(v.replace(/[\s\u00a0\u202f]/g, "").replace(/ar$/i, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, Math.round(n));
};

// Lignes complètes seulement (code + nom) ; erreur si deux codes identiques
export function fromRows(rows: ProductRow[]): { products: LiveProduct[]; error: string | null } {
  const products = rows
    .filter((r) => r.code.trim() && r.name.trim())
    .map((r) => ({ code: r.code.trim(), name: r.name.trim(), price: toInt(r.price), stock: toInt(r.stock) }));
  const codes = products.map((p) => p.code.toLowerCase());
  const dup = codes.find((c, i) => codes.indexOf(c) !== i);
  return { products, error: dup ? `Le code « ${dup.toUpperCase()} » apparaît deux fois.` : null };
}
