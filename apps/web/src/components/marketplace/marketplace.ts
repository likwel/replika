import { LISTING_STATUS, type MarketplaceListing } from "@/lib/marketplace.api";

// Export tableur (séparateur « ; » et BOM pour Excel en français) — même pattern que leads.ts
export function exportListingsCsv(listings: MarketplaceListing[]) {
  const header = ["Titre", "Catégorie", "Prix (Ar)", "Stock", "Statut", "Commandes", "Compte", "Publié Facebook", "Créé le"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = listings.map((l) => [
    l.title,
    l.category,
    l.price,
    l.stock,
    LISTING_STATUS[l.status].label,
    l._count.orders,
    l.account.name,
    l.pushedAt ? "Oui" : "Non",
    new Date(l.createdAt).toLocaleDateString("fr-FR"),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Catalogue ${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
