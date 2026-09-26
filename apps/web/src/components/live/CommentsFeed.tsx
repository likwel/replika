import { useEffect, useRef, useState } from "react";
import { Hand, Loader2, MessageCircle, ShoppingBag } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
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
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#dc2626" }} /> En direct
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
        <ul className="flex flex-col gap-1.5">
          {list.map((c) => {
            const status = c.order ? ORDER_STATUS[c.order.status] : null;
            return (
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
                      <span style={{ color: theme.textMuted }}>{new Date(c.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
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
                      {status && (
                        <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                      )}
                    </p>
                    <p className="break-words text-sm" style={{ color: theme.text }}>{c.text}</p>
                    {marking === c.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (facultatif)" className="w-32 rounded-lg px-2 py-1 text-xs outline-none" style={{ background: theme.bg, border: `1px solid ${theme.border}` }} />
                        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="w-14 rounded-lg px-2 py-1 text-xs outline-none" style={{ background: theme.bg, border: `1px solid ${theme.border}` }} aria-label="Quantité" />
                        <button onClick={() => mark(c)} disabled={busy} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: theme.gold, color: "#1A1410" }}>
                          {busy && <Loader2 size={11} className="animate-spin" />} Créer la commande
                        </button>
                        <button onClick={() => setMarking(null)} className="text-xs" style={{ color: theme.textMuted }}>Annuler</button>
                        {error && <span className="text-xs" style={{ color: theme.red }}>{error}</span>}
                      </div>
                    )}
                  </div>
                  {!c.isJp && !c.own && marking !== c.id && (
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
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
