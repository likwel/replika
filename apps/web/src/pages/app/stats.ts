import type { AccountStats, RuleStats } from "@/lib/stats.api";

// Export tableur (séparateur « ; » et BOM pour Excel en français) — même pattern que leads.ts
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportReportCsv(accounts: AccountStats[], rules: RuleStats[]) {
  const accountsSection = [
    ["Performance par compte"],
    ["Compte", "Plateforme", "Commentaires", "Messages", "Leads"],
    ...accounts.map((a) => [a.name, a.platform, a.comments, a.messages, a.leads]),
  ];
  const rulesSection = [
    ["Règles les plus actives"],
    ["Règle", "Canal", "Compte", "Déclenchements", "Envoi auto", "Dernier déclenchement"],
    ...rules.map((r) => [
      r.name,
      r.channel,
      r.account?.name ?? "",
      r.hitCount,
      r.autoSend ? "Oui" : "Non",
      r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toLocaleString("fr-FR") : "",
    ]),
  ];

  const toCsvBlock = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const csv = "﻿" + [toCsvBlock(accountsSection), toCsvBlock(rulesSection)].join("\r\n\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rapport ${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
