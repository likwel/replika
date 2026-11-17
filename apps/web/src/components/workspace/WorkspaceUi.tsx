import { useState, type ReactNode } from "react";
import { AlertTriangle, Facebook, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Dash";
import { facebookApi } from "@/lib/facebook.api";
import { isPermissionError } from "@/lib/meta";
import type { AccountError } from "@/lib/workspace.api";

// Petits éléments communs aux onglets de Gestion

export function FilterChips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: ReadonlyArray<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto">
      {items.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className="flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors"
            style={{
              background: active ? theme.goldSoft : "transparent",
              color: active ? theme.goldDark : theme.textMuted,
              border: `1px solid ${active ? theme.gold : theme.border}`,
            }}
            aria-pressed={active}
          >
            {f.label}
            {f.count ? (
              <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: theme.gold, color: theme.onAccent }}>
                {f.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function RefreshButton({ loading, onClick, title = "Actualiser" }: { loading: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      className="btn-soft flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
      title={title}
      aria-label={title}
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: theme.textMuted }} />
    </button>
  );
}

// Comptes illisibles : signalés au lieu d'une liste silencieusement incomplète
export function AccountErrors({ errors, className = "" }: { errors: AccountError[]; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (errors.length === 0) return null;
  // Les messages de Meta peuvent être longs : une ligne par compte, détail à la demande
  const long = errors.some((e) => e.message.length > 90);
  return (
    <div className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-xs ${className}`} style={{ background: "#FDECEC", color: theme.red }}>
      <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1 basis-56">
        <ul className="space-y-0.5">
          {errors.map((e) => (
            <li key={e.accountId || e.message} className={`break-words ${long && !expanded ? "line-clamp-2" : ""}`}>
              <strong>{e.accountName}</strong> — {e.message}
            </li>
          ))}
        </ul>
        {long && (
          <button onClick={() => setExpanded(!expanded)} className="mt-1 font-semibold underline">
            {expanded ? "Réduire" : "Voir le détail"}
          </button>
        )}
      </div>
      {errors.some((e) => isPermissionError(e.message)) && (
        <Button size="sm" variant="danger" icon={Facebook} onClick={() => facebookApi.connect()}>Reconnecter Facebook</Button>
      )}
    </div>
  );
}

export function ListSkeleton({ height = 88, count = 4 }: { height?: number; count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-2xl" style={{ height, background: theme.bg }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, dashed, bare }: { icon: LucideIcon; title: string; children?: ReactNode; dashed?: boolean; bare?: boolean }) {
  // Volet d'une carte : pas de carte dans la carte, le message est centré dans toute la hauteur du volet
  if (bare)
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
        <IconTile icon={Icon} size="lg" />
        <p className="mt-4 text-[15px] font-bold" style={{ color: theme.text }}>{title}</p>
        {children && <div className="mt-1 max-w-sm text-[13px] leading-snug" style={{ color: theme.textMuted }}>{children}</div>}
      </div>
    );
  return (
    <div
      className="flex flex-col items-center rounded-2xl px-6 py-10 text-center"
      style={{ background: theme.bgCard, border: `1px ${dashed ? "dashed" : "solid"} ${theme.border}` }}
    >
      <Icon size={26} style={{ color: theme.gold }} />
      <p className="mt-3 text-sm font-medium" style={{ color: theme.text }}>{title}</p>
      {children && <div className="mt-1 max-w-sm text-xs" style={{ color: theme.textMuted }}>{children}</div>}
    </div>
  );
}
