import { Fragment, useEffect, useRef, useState } from "react";
import { Hand, Loader2, MessageCircle, ShoppingBag } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDot } from "@/components/ui/StatusDot";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { EmptyState, FilterChips } from "@/components/workspace/WorkspaceUi";
import { ApiError } from "@/lib/api";
import { liveApi, type LiveComment, type LiveOrder } from "@/lib/live.api";
import { ORDER_STATUS } from "./live";

interface Props {
  sessionId: string;
  active: boolean; // session en cours : actualisation automatique
  onOrder: (o: LiveOrder) => void; // commande créée à la main
}

const POLL_MS = 3000;
const PAGE_SIZE = 25;

const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function CommentsFeed({ sessionId, active, onOrder }: Props) {
  const [comments, setComments] = useState<LiveComment[] | null>(null);
  const [filter, setFilter] = useState<"all" | "jp" | "other">("all");
  const [marking, setMarking] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newest = useRef<string | undefined>(undefined);

  const merge = (fresh: LiveComment[]) => {
    if (!fresh.length) return;
    newest.current = fresh.reduce((m, c) => (c.createdAt > m ? c.createdAt : m), newest.current ?? fresh[0].createdAt);
    setComments((list) => {
      const byId = new Map((list ?? []).map((c) => [c.id, c]));
      for (const c of fresh) byId.set(c.id, c);
      return [...byId.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    });
  };

  useEffect(() => {
    newest.current = undefined;
    liveApi.comments(sessionId).then((list) => {
      setComments(list);
      merge(list);
    });
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      // Chevauchement : un JP déjà reçu peut avoir changé de statut (message envoyé, confirmé…)
      const since = newest.current ? new Date(new Date(newest.current).getTime() - 60000).toISOString() : undefined;
      liveApi.comments(sessionId, since).then(merge).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [sessionId, active]);

  const mark = async (c: LiveComment) => {
    setBusy(true);
    setError(null);
    try {
      const order = await liveApi.markJp(sessionId, c.externalId, { code: code.trim() || null, quantity: Math.max(1, Number(qty) || 1) });
      setComments((list) => list?.map((x) => (x.id === c.id ? { ...x, isJp: true, order: { id: order.id, status: order.status, code: order.code } } : x)) ?? null);
      setMarking(null);
      onOrder(order);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  const list = (comments ?? []).filter((c) => filter === "all" || (filter === "jp" ? c.isJp : !c.isJp));
  const jp = (comments ?? []).filter((c) => c.isJp).length;
  // La Page qui écrit « jp » (test) : expliqué, car ce n'est jamais une commande
  const ownJp = (comments ?? []).some((c) => c.own && /\bjp|prend/i.test(c.text));
  const { pageItems, page, pageCount, setPage, total } = usePagination(list, PAGE_SIZE);
  const th = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide";

  // Formulaire « marquer JP » : même contenu en ligne de tableau et en carte
  const markForm = (c: LiveComment) => (
    <div className="flex flex-wrap items-center gap-2">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (facultatif)" className="w-32 rounded-lg px-2 py-1 text-xs outline-none" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }} />
      <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="w-14 rounded-lg px-2 py-1 text-xs outline-none" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }} aria-label="Quantité" />
      <button onClick={() => mark(c)} disabled={busy} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: theme.gold, color: "#1A1410" }}>
        {busy && <Loader2 size={11} className="animate-spin" />} Créer la commande
      </button>
      <button onClick={() => setMarking(null)} className="text-xs" style={{ color: theme.textMuted }}>Annuler</button>
      {error && <span className="text-xs" style={{ color: theme.red }}>{error}</span>}
    </div>
  );

  const markButton = (c: LiveComment) =>
    !c.isJp && !c.own && marking !== c.id ? (
      <button
        onClick={() => {
          setMarking(c.id);
          setCode("");
          setQty("1");
          setError(null);
        }}
        className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium hover:bg-black/5"
        style={{ color: theme.goldDark }}
        title="Ce commentaire est une commande : créer le JP"
      >
        <Hand size={12} /> Marquer JP
      </button>
    ) : null;

  const badges = (c: LiveComment) => {
    const status = c.order ? ORDER_STATUS[c.order.status] : null;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {c.own && (
          <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: theme.border, color: theme.textMuted }} title="Publié en tant que Page : ignoré">
            Votre Page · ignoré
          </span>
        )}
        {c.isJp && (
          <span className="flex items-center gap-0.5 rounded px-1.5 text-[10px] font-bold" style={{ background: theme.gold, color: "#1A1410" }}>
            <ShoppingBag size={9} /> JP{c.order?.code ? ` ${c.order.code}` : ""}
          </span>
        )}
        {status && <span className="whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>{status.label}</span>}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FilterChips
          items={[
            { id: "all" as const, label: "Tous" },
            { id: "jp" as const, label: "JP", count: jp },
            { id: "other" as const, label: "Autres" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {active && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: theme.textMuted }}>
            <StatusDot color="#dc2626" size={7} pulse /> En direct
          </span>
        )}
      </div>

      {ownJp && (
        <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "#FEF3C7", color: "#92400e" }}>
          Les commentaires publiés <strong>en tant que Page</strong> ne sont jamais comptés comme JP (ce sont vos propres réponses).
          Pour tester, commentez « jp » depuis un <strong>profil personnel</strong>.
        </p>
      )}

      {comments === null ? (
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />
      ) : list.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Aucun commentaire">
          {active ? "Les commentaires du live s'afficheront ici en temps réel." : "Aucun commentaire capturé pour cette session."}
        </EmptyState>
      ) : (
        <>
          {/* Grand écran : tableau */}
          <div className="hidden overflow-x-auto rounded-2xl md:block" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <table className="w-full min-w-[720px] text-sm">
              <thead style={{ background: theme.bg, color: theme.textMuted }}>
                <tr>
                  <th className={`${th} text-left`}>Heure</th>
                  <th className={`${th} text-left`}>Auteur</th>
                  <th className={`${th} text-left`}>Commentaire</th>
                  <th className={`${th} text-left`}>JP / statut</th>
                  <th className={`${th} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <Fragment key={c.id}>
                    <tr style={{ borderTop: `1px solid ${theme.border}`, background: c.isJp ? theme.goldSoft : undefined }}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs" style={{ color: theme.textMuted }}>{hhmmss(c.createdAt)}</td>
                      <td className="max-w-[180px] px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar name={c.authorName.replace(/^@/, "")} size={22} />
                          <span className="truncate font-medium" style={{ color: theme.text }}>{c.authorName}</span>
                        </span>
                      </td>
                      <td className="max-w-[340px] px-3 py-2 break-words" style={{ color: theme.text }}>{c.text}</td>
                      <td className="px-3 py-2">{badges(c)}</td>
                      <td className="px-3 py-2">
                        <span className="flex justify-end">{markButton(c)}</span>
                      </td>
                    </tr>
                    {marking === c.id && (
                      <tr style={{ background: theme.bg }}>
                        <td colSpan={5} className="px-3 py-2">{markForm(c)}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : cartes */}
          <ul className="flex flex-col gap-1.5 md:hidden">
            {pageItems.map((c) => (
              <li
                key={c.id}
                className="rounded-xl px-3 py-2"
                style={{ background: c.isJp ? theme.goldSoft : theme.bgCard, border: `1px solid ${c.isJp ? `${theme.gold}80` : theme.border}` }}
              >
                <div className="flex items-start gap-2.5">
                  <Avatar name={c.authorName.replace(/^@/, "")} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <strong style={{ color: theme.text }}>{c.authorName}</strong>
                      <span style={{ color: theme.textMuted }}>{hhmmss(c.createdAt)}</span>
                      {badges(c)}
                    </p>
                    <p className="break-words text-sm" style={{ color: theme.text }}>{c.text}</p>
                    {marking === c.id && <div className="mt-2">{markForm(c)}</div>}
                  </div>
                  {markButton(c)}
                </div>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
