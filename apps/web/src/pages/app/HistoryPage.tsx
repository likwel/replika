import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { timeAgo } from "@/lib/format";
import { historyApi, type HistoryCategory, type HistoryEntry } from "@/lib/history.api";
import { actionMeta, detailOf, groupByDay } from "@/components/history/history";

interface Ctx { sub: number }

// Sous-menus de « Historique » (même ordre que dans data/menus.ts)
const CATEGORY_OF_SUB: Array<HistoryCategory | undefined> = [undefined, "message", "connexion"];
const TITLE_OF_SUB = ["Toutes les Actions", "Historique des Messages", "Connexions et Sécurité"];
const EMPTY_OF_SUB = [
  "Les actions effectuées sur votre compte (réponses, programmations, connexions…) apparaîtront ici.",
  "Les réponses automatiques, commentaires et leads contactés apparaîtront ici.",
  "Les connexions, changements de mot de passe et connexions à Facebook apparaîtront ici.",
];
const PAGE_SIZE = 30;
const isMetaPlatform = (p: string): p is "FACEBOOK" | "INSTAGRAM" => p === "FACEBOOK" || p === "INSTAGRAM";

export function HistoryPage() {
  const { sub } = useOutletContext<Ctx>();
  const category = CATEGORY_OF_SUB[sub];

  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);

  const load = () => {
    const id = ++request.current;
    setItems(null);
    setCursor(null);
    historyApi
      .list({ category, limit: PAGE_SIZE })
      .then((d) => {
        if (id !== request.current) return;
        setItems(d.items);
        setCursor(d.nextCursor);
      })
      .catch(() => id === request.current && setItems([]));
  };

  useEffect(load, [category]);

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    historyApi
      .list({ category, before: cursor, limit: PAGE_SIZE })
      .then((d) => {
        setItems((list) => [...(list ?? []), ...d.items]);
        setCursor(d.nextCursor);
      })
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <Title className="text-lg">{TITLE_OF_SUB[sub] ?? TITLE_OF_SUB[0]}</Title>
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {sub === 0 ? "Tout ce qui s'est passé sur votre compte, le plus récent en premier." : "Filtré depuis l'historique complet de votre compte."}
        </p>
      </div>

      {items === null ? (
        <ListSkeleton height={64} count={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="Rien pour l'instant">{EMPTY_OF_SUB[sub] ?? EMPTY_OF_SUB[0]}</EmptyState>
      ) : (
        <>
          {groupByDay(items).map(([day, entries]) => (
            <div key={day}>
              <p className="mb-2 px-1 text-xs font-semibold capitalize" style={{ color: theme.textMuted }}>{day}</p>
              <ul className="flex flex-col gap-2">
                {entries.map((e) => {
                  const meta = actionMeta(e.action);
                  const Icon = meta.icon;
                  const detail = detailOf(e);
                  return (
                    <li key={e.id} className="flex items-start gap-3 rounded-2xl p-3" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${meta.color}1A` }}>
                        <Icon size={16} style={{ color: meta.color }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium" style={{ color: theme.text }}>
                          {meta.label}
                          <span className="font-normal" style={{ color: theme.textMuted }}>· {timeAgo(e.createdAt)}</span>
                        </p>
                        {detail && <p className="mt-0.5 truncate text-xs" style={{ color: theme.textMuted }}>{detail}</p>}
                      </div>
                      {e.account && (
                        <div className="flex flex-shrink-0 items-center gap-1.5" title={e.account.name}>
                          {isMetaPlatform(e.account.platform) ? (
                            <AccountAvatar name={e.account.name} src={e.account.avatarUrl} platform={e.account.platform} size={22} />
                          ) : (
                            <Avatar name={e.account.name} src={e.account.avatarUrl} size={22} />
                          )}
                          <span className="hidden max-w-[110px] truncate text-xs sm:inline" style={{ color: theme.textMuted }}>{e.account.name}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {cursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mx-auto flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              Charger plus
            </button>
          )}
        </>
      )}
    </div>
  );
}
