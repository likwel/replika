import { ChevronLeft, ChevronRight } from "lucide-react";
import { theme } from "@/theme";

interface Props {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total?: number;
  pageSize?: number;
}

// Numéros affichés autour de la page courante, avec « … » au-delà de 5-6 pages
function pageNumbers(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const nums = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...nums].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] as number) > 1) out.push("…");
    out.push(n);
  });
  return out;
}

const btn = "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({ page, pageCount, onChange, total, pageSize }: Props) {
  if (pageCount <= 1) return null;
  const from = total && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total && pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      {total !== undefined && from !== null && (
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {from}–{to} sur {total}
        </p>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button className={btn} style={{ color: theme.text }} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente">
          <ChevronLeft size={15} />
        </button>
        {pageNumbers(page, pageCount).map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-sm" style={{ color: theme.textMuted }}>…</span>
          ) : (
            <button
              key={n}
              className={btn}
              style={{ background: n === page ? theme.gold : "transparent", color: n === page ? "#1A1410" : theme.text }}
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          )
        )}
        <button className={btn} style={{ color: theme.text }} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Page suivante">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
