import type { ReactNode } from "react";
import { Check, Plug, Radio, Sparkles } from "lucide-react";
import { theme } from "@/theme";
import { Segmented } from "@/components/ui/Segmented";
import { annualMonthly, ANNUAL_DISCOUNT, type PlanDef } from "@/data/plans";

// Carte de formule commune à la page d'accueil et à Paramètres › Facturation : même contenu (data/plans.ts),
// même présentation. Seuls les prix (lus de l'API dans l'application) et le bouton d'action changent.

export type Period = "MONTHLY" | "ANNUAL";

const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ | /g, " ");

// Mensuel / Annuel : même sélecteur partout
export function PeriodSwitch({ value, onChange, className = "" }: { value: Period; onChange: (p: Period) => void; className?: string }) {
  return (
    <div className={`w-full max-w-[280px] ${className}`}>
      <Segmented<Period>
        options={[
          { value: "MONTHLY", label: "Mensuel" },
          { value: "ANNUAL", label: `Annuel · -${Math.round(ANNUAL_DISCOUNT * 100)} %` },
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export interface TilePrice {
  monthly: number | null; // prix mensuel (formule mensuelle) ; null = sur devis
  list?: number | null; // prix public habituel : affiché barré à côté du prix promotionnel
  listPerMonth?: number | null; // le même en formule annuelle
  perMonth?: number | null; // prix par mois en formule annuelle
  yearly?: number | null; // total payé pour un an
}

// Prix d'une formule du catalogue du site (sans appel à l'API)
export const catalogPrice = (def: PlanDef): TilePrice =>
  def.base
    ? { monthly: def.base, perMonth: annualMonthly(def.base), yearly: annualMonthly(def.base) * 12, list: def.list, listPerMonth: def.list ? annualMonthly(def.list) : null }
    : { monthly: null };

interface Props {
  def: PlanDef;
  price: TilePrice;
  period: Period;
  badge?: string; // « Votre formule », « Votre essai »… ; remplace « Populaire »
  current?: boolean;
  action: ReactNode;
}

export function PlanTile({ def, price, period, badge, current, action }: Props) {
  const hl = def.hl;
  const annual = period === "ANNUAL" && price.monthly !== null;
  const shown = annual ? (price.perMonth ?? price.monthly) : price.monthly;
  const saving = annual && price.monthly !== null && price.yearly ? price.monthly * 12 - price.yearly : 0;
  const muted = hl ? "#ffffff99" : theme.textMuted;
  // Prix promotionnel : le prix public habituel reste visible, barré, avec le pourcentage d'économie
  const list = annual ? (price.listPerMonth ?? null) : (price.list ?? null);
  const promo = list && shown !== null && list > shown ? { list, off: Math.round(((list - shown) / list) * 100) } : null;
  const label = badge ?? (hl ? "Populaire" : null);

  return (
    <div
      className="relative flex h-full flex-col rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
      style={{
        background: hl ? theme.bgDark : theme.bgCard,
        border: `1px solid ${current ? theme.gold : hl ? `${theme.gold}80` : theme.border}`,
        boxShadow: current ? `0 0 0 1px ${theme.gold}` : hl ? "0 12px 30px rgba(28,24,19,0.18)" : "none",
      }}
    >
      {label && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide"
          style={current || hl ? { background: theme.gold, color: theme.onAccent } : { background: theme.bgDark, color: "#fff" }}
        >
          {label}
        </span>
      )}
      <h3 className="text-[15px] font-bold" style={{ color: hl ? "#fff" : theme.text }}>{def.name}</h3>
      <p className="mt-0.5 text-[11.5px]" style={{ color: muted }}>{def.tagline}</p>

      <div className="mb-4 mt-3 min-h-[104px]">
        {shown !== null ? (
          <>
            {promo && (
              <p className="mb-1 flex items-center gap-2">
                <span className="text-[13px] font-semibold line-through decoration-2" style={{ color: muted }}>{fmt(promo.list)} Ar</span>
                <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: "#22C55E", color: "#fff" }}>Promo −{promo.off} %</span>
              </p>
            )}
            <p className="flex flex-wrap items-baseline gap-x-1">
              <span className="text-[1.75rem] font-extrabold leading-none" style={{ color: hl ? theme.goldLight : theme.text }}>{fmt(shown)}</span>
              <span className="text-[13px]" style={{ color: muted }}>Ar/mois</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11.5px]" style={{ color: muted }}>
              {annual && price.yearly ? (
                <>
                  <span>Facturé {fmt(price.yearly)} Ar par an</span>
                  {saving > 0 && (
                    <span className="rounded-full px-1.5 font-semibold" style={hl ? { background: "rgba(34,197,94,0.2)", color: theme.greenLight } : { background: theme.greenSoft, color: theme.green }}>-{fmt(saving)} Ar</span>
                  )}
                </>
              ) : (
                "Sans engagement"
              )}
            </p>
          </>
        ) : (
          <span className="text-[1.75rem] font-extrabold" style={{ color: hl ? theme.goldLight : theme.text }}>Sur devis</span>
        )}
      </div>

      {/* Volumes inclus : ce qui augmente d'une formule à l'autre, comparable d'un coup d'œil */}
      <ul
        className="mb-4 flex flex-col gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold"
        style={{ background: hl ? "rgba(255,255,255,0.08)" : theme.goldSoft, color: hl ? theme.goldLight : theme.goldDark }}
      >
        {([
          [Plug, def.limits.pages],
          [Sparkles, def.limits.ai],
          [Radio, def.limits.live],
        ] as const).map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-1.5">
            <Icon size={14} className="mt-px flex-shrink-0" /> {text}
          </li>
        ))}
      </ul>

      <ul className="mb-5 flex flex-col gap-2">
        {def.feats.map((ft) =>
          ft.endsWith(":") ? (
            <li key={ft} className="mt-1 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: hl ? "#ffffff80" : theme.textMuted }}>
              {ft.slice(0, -1).trim()}
            </li>
          ) : (
            <li key={ft} className="flex items-start gap-2 text-[13px]" style={{ color: hl ? "#ffffffcc" : theme.text }}>
              <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: hl ? theme.greenLight : theme.green }} /> {ft}
            </li>
          ),
        )}
      </ul>

      <div className="mt-auto">{action}</div>
    </div>
  );
}
