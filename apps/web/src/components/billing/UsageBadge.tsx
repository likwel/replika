import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Coins, Plug, Radio, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { usePlan, fmtNum } from "@/hooks/usePlan";
import { billingApi, fmtHours, type BillingOverview } from "@/lib/billing.api";
import { liveHours } from "@/lib/liveHours";
import { replyCredits } from "@/lib/replyCredits";
import { BILLING_UPDATED } from "@/lib/payment";

interface Row {
  icon: LucideIcon;
  label: string;
  used: number;
  limit: number | null;
  format: (n: number) => string;
  consumable: boolean; // compte dans le pourcentage restant (les Pages ne se consomment pas)
  credit?: number; // acheté à l'unité, dans la même unité : prolonge le volume restant
}

const hours = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;

// Badge d'en-tête : part restante de la formule (la plus entamée des deux quotas mensuels, crédits achetés
// compris : 0 % veut dire que plus rien ne peut partir), détail au clic
export function UsageBadge() {
  const { subscription: sub } = usePlan();
  const nav = useNavigate();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => billingApi.overview().then(setData).catch(() => {}), []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    window.addEventListener(BILLING_UPDATED, load); // paiement confirmé : pourcentage à jour tout de suite
    return () => {
      clearInterval(t);
      window.removeEventListener(BILLING_UPDATED, load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  if (!sub || !data) return null;
  const u = data.usage;
  const rows: Row[] = [
    { icon: Plug, label: "Pages actives", used: u.pages, limit: sub.limits.pages, format: fmtNum, consumable: false },
    { icon: Sparkles, label: "Réponses IA ce mois-ci", used: u.aiReplies, limit: sub.limits.aiReplies, format: fmtNum, consumable: true, credit: sub.replyCredits ?? 0 },
    { icon: Radio, label: "Heures de live ce mois-ci", used: u.liveSeconds / 3600, limit: sub.limits.liveHours, format: hours, consumable: true, credit: (sub.liveCreditSeconds ?? 0) / 3600 },
  ];
  const left = rows
    .filter((r) => r.consumable && r.limit)
    .map((r) => Math.min(1, Math.max(0, r.limit! - r.used + (r.credit ?? 0)) / r.limit!));
  const unlimited = left.length === 0;
  const pct = unlimited ? 100 : Math.round(Math.min(...left) * 100);
  const expired = sub.status === "EXPIRED";
  const tone = expired || pct === 0 ? theme.red : pct <= 20 ? theme.amber : theme.green;
  const bg = expired || pct === 0 ? theme.dangerBg : pct <= 20 ? theme.amberSoft : theme.greenSoft;

  return (
    <div ref={ref} className="relative mr-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold transition-[filter] hover:brightness-95"
        style={{ background: bg, color: tone }}
        aria-expanded={open}
        aria-label="Usage de la formule"
        title="Usage de votre formule"
      >
        <span>{expired ? "Expirée" : unlimited ? "∞" : `${pct}%`}</span>
        <span className="hidden sm:inline" style={{ opacity: 0.75 }}>· {sub.planName}</span>
        <ChevronDown size={13} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div
          className="animate-panel-in absolute right-0 top-10 z-[60] w-[320px] max-w-[calc(100vw-24px)] rounded-xl p-4 shadow-xl"
          style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: theme.text }}>Formule {sub.planName}</p>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: tone }}>
              {expired ? "Expirée" : sub.status === "TRIAL" ? "Essai" : "Active"}
              {sub.daysLeft !== null && !expired ? ` · ${sub.daysLeft} j` : ""}
            </span>
          </div>

          <ul className="mt-3 flex flex-col gap-3">
            {rows.map((r) => {
              const used = r.limit ? Math.min(100, (r.used / r.limit) * 100) : 0;
              const color = r.limit === null ? theme.green : used >= 100 ? theme.red : used >= 80 ? theme.amber : theme.gold;
              return (
                <li key={r.label}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-1.5" style={{ color: theme.textMuted }}>
                      <r.icon size={13} /> {r.label}
                    </span>
                    <span style={{ color: theme.text }}>
                      <strong>{r.format(r.used)}</strong>
                      <span style={{ color: theme.textMuted }}> / {r.limit === null ? "illimité" : r.format(r.limit)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: theme.border }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: r.limit === null ? "100%" : `${Math.max(used, r.used > 0 ? 3 : 0)}%`, background: color, opacity: r.limit === null ? 0.35 : 1 }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5" style={{ background: theme.bg }}>
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: theme.textMuted }}>
                <Coins size={13} /> Crédits de réponses
              </span>
              <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: theme.text }}>{fmtNum(sub.replyCredits ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: theme.textMuted }}>
                <Clock size={13} /> Heures de live achetées
              </span>
              <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: theme.text }}>{fmtHours(sub.liveCreditSeconds ?? 0)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11.5px]" style={{ color: theme.textMuted }}>
            Les volumes repartent à zéro le 1er du mois. Les crédits achetés n'expirent pas.
          </p>

          <Button
            className="mt-3 w-full justify-center"
            icon={Zap}
            variant={pct <= 20 || expired ? "primary" : "soft"}
            onClick={() => {
              setOpen(false);
              nav("/app/facturation");
            }}
          >
            {expired ? "Renouveler" : "Recharger ou changer de formule"}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              className="w-full justify-center"
              icon={Coins}
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                replyCredits.open();
              }}
            >
              Réponses
            </Button>
            <Button
              className="w-full justify-center"
              icon={Radio}
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                liveHours.open();
              }}
            >
              Heures de live
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
