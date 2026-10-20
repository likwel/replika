import { theme } from "@/theme";
import type { Lead, LeadStatus, Temperature } from "@/lib/lead.api";

export const LEAD_STATUS: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: "À contacter", color: "#1D4ED8", bg: "#E8F0FE" },
  CONTACTED: { label: "Contacté", color: "#92400E", bg: "#FEF3C7" },
  QUALIFIED: { label: "Qualifié", color: "#6D28D9", bg: "#F1ECFE" },
  WON: { label: "Gagné", color: "#166534", bg: "#E7F6EC" },
  LOST: { label: "Perdu", color: theme.textMuted, bg: theme.bg },
};
export const LEAD_STATUSES = Object.keys(LEAD_STATUS) as LeadStatus[];

export const TEMPERATURE: Record<Temperature, { label: string; emoji: string; color: string; bg: string }> = {
  hot: { label: "Chaud", emoji: "🔥", color: "#B91C1C", bg: theme.dangerBg },
  warm: { label: "Tiède", emoji: "🌤️", color: "#92400E", bg: "#FEF3C7" },
  cold: { label: "Froid", emoji: "❄️", color: "#1D4ED8", bg: "#E8F0FE" },
};
export const temperatureOf = (score: number): Temperature => (score >= 70 ? "hot" : score >= 45 ? "warm" : "cold");

export const SOURCE_LABEL: Record<Lead["lastSource"], string> = { COMMENT: "Commentaire", DIRECT: "Message privé", LIVE: "JP en live" };

// Export tableur (séparateur « ; » et BOM pour Excel en français)
export function exportLeadsCsv(leads: Lead[]) {
  const header = ["Nom", "Compte", "Note", "Température", "Statut", "Téléphone", "E-mail", "Signaux", "Dernier message", "Source", "Montant (Ar)", "Note interne", "Vu le"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) => [
    l.name,
    l.account.name,
    l.score,
    TEMPERATURE[temperatureOf(l.score)].label,
    LEAD_STATUS[l.status].label,
    l.phone,
    l.email,
    l.signals.join(", "),
    l.lastMessage,
    SOURCE_LABEL[l.lastSource],
    l.value,
    l.note,
    new Date(l.lastSeenAt).toLocaleString("fr-FR"),
  ]);
  const csv = "\ufeff" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Leads ${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
