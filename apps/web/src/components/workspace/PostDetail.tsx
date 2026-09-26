import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Heart, MessageCircle, Share2, Play, RefreshCw, MessageSquarePlus } from "lucide-react";
import { theme } from "@/theme";
import { ApiError } from "@/lib/api";
import { formatDateTime, plural } from "@/lib/format";
import { workspaceApi, type WsComment, type WsPost } from "@/lib/workspace.api";
import { AccountAvatar } from "./AccountAvatar";
import { CommentItem } from "./CommentItem";
import { Composer } from "./Composer";
import { KIND_LABEL } from "./labels";
import { scrollIntoContainer } from "./helpers";

interface Props {
  post: WsPost;
  highlightId?: string; // commentaire ouvert depuis « À traiter »
  onBack: () => void; // mobile : retour à la liste
  onChange: (patch: Partial<WsPost>) => void; // compteurs de la liste
}

// Applique une modification à un commentaire, où qu'il soit dans le fil
const mapTree = (list: WsComment[], id: string, fn: (c: WsComment) => WsComment | null): WsComment[] =>
  list.flatMap((c) => {
    if (c.id === id) {
      const next = fn(c);
      return next ? [next] : [];
    }
    return [{ ...c, replies: mapTree(c.replies, id, fn) }];
  });

const isOpen = (c: WsComment) => Boolean(c.inbox && ["PENDING", "ESCALATED"].includes(c.inbox.status));

export function PostDetail({ post, highlightId, onBack, onChange }: Props) {
  const [comments, setComments] = useState<WsComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const network = post.platform === "INSTAGRAM" ? "Instagram" : "Facebook";

  const load = () => {
    setLoading(true);
    setError(null);
    workspaceApi
      .comments(post.accountId, post.id)
      .then(setComments)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Commentaires indisponibles."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [post.accountId, post.id]);

  // Amène le commentaire ciblé à l'écran une fois le fil chargé
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightId && comments && highlightRef.current) scrollIntoContainer(highlightRef.current);
  }, [highlightId, comments === null]);

  // Met à jour le fil et, par variation, les compteurs de la liste (le fil chargé peut être partiel)
  const update = (next: WsComment[], delta: { comments?: number; pending?: number } = {}) => {
    setComments(next);
    onChange({
      comments: Math.max(0, post.comments + (delta.comments ?? 0)),
      pending: Math.max(0, post.pending + (delta.pending ?? 0)),
    });
  };

  const ownComment = (text: string, id: string | null): WsComment => ({
    id: id ?? `local_${Date.now()}`,
    author: post.accountName,
    authorId: null,
    text,
    time: new Date().toISOString(),
    likes: 0,
    hidden: false,
    isOwn: true,
    canHide: false,
    canDelete: Boolean(id),
    inbox: null,
    replies: [],
  });

  const reply = async (parent: WsComment, text: string) => {
    const res = await workspaceApi.replyToComment(post.accountId, parent.id, text);
    update(
      mapTree(comments ?? [], parent.id, (c) => ({
        ...c,
        inbox: c.inbox ? { ...c.inbox, status: "REPLIED", suggestion: null } : null,
        replies: [...c.replies, ownComment(text, res.id)],
      })),
      { comments: 1, pending: isOpen(parent) ? -1 : 0 }
    );
    setReplyingTo(null);
  };

  const commentOnPost = async (text: string) => {
    const res = await workspaceApi.commentOnPost(post.accountId, post.id, text);
    update([ownComment(text, res.id), ...(comments ?? [])], { comments: 1 });
  };

  const hide = async (c: WsComment, hidden: boolean) => {
    await workspaceApi.setHidden(post.accountId, c.id, hidden);
    update(mapTree(comments ?? [], c.id, (x) => ({ ...x, hidden })));
  };

  const remove = async (c: WsComment) => {
    await workspaceApi.deleteComment(post.accountId, c.id);
    update(mapTree(comments ?? [], c.id, () => null), {
      comments: -(1 + c.replies.length),
      pending: -[c, ...c.replies].filter(isOpen).length,
    });
  };

  const suggest = (c: WsComment) =>
    workspaceApi.suggestComment(post.accountId, { text: c.text, authorName: c.author, postId: post.id });

  const renderComment = (c: WsComment, parent?: WsComment) => (
    <CommentItem
      key={c.id}
      comment={c}
      accountName={post.accountName}
      isReply={Boolean(parent)}
      highlighted={c.id === highlightId}
      highlightRef={c.id === highlightId ? highlightRef : undefined}
      replying={replyingTo === c.id}
      onStartReply={() => setReplyingTo(c.id)}
      onCancelReply={() => setReplyingTo(null)}
      // Une réponse à une réponse rejoint le fil du commentaire principal
      onReply={(text) => reply(parent ?? c, text)}
      onSuggest={() => suggest(c)}
      onHide={(hidden) => hide(c, hidden)}
      onDelete={() => remove(c)}
    >
      {!parent && c.replies.map((r) => renderComment(r, c))}
    </CommentItem>
  );

  const longText = post.text.length > 280;

  return (
    <article className="rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      {/* En-tête */}
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: theme.border }}>
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-black/5 lg:hidden" aria-label="Retour à la liste">
          <ArrowLeft size={18} style={{ color: theme.text }} />
        </button>
        <AccountAvatar name={post.accountName} src={post.accountAvatar} platform={post.platform} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{post.accountName}</p>
          <p className="text-[11px]" style={{ color: theme.textMuted }}>
            {KIND_LABEL[post.kind] ?? "Publication"} · {network} · {formatDateTime(post.time)}
          </p>
        </div>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-black/5"
            style={{ color: theme.goldDark }}
          >
            <ExternalLink size={13} /> <span className="hidden sm:inline">Voir sur {network}</span>
          </a>
        )}
      </header>

      {/* Contenu */}
      <div className="px-4 pt-3">
        {post.text && (
          <p className="whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: theme.text }}>
            {longText && !expanded ? `${post.text.slice(0, 280)}…` : post.text}
            {longText && (
              <button onClick={() => setExpanded(!expanded)} className="ml-1 text-xs font-semibold" style={{ color: theme.goldDark }}>
                {expanded ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </p>
        )}
        {post.image && (
          <div className="relative mt-3 overflow-hidden rounded-xl" style={{ background: "#0d0b09" }}>
            <img src={post.image} alt="" className="mx-auto max-h-80 w-full object-contain" />
            {post.isVideo && (
              <a
                href={post.permalink ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.2)" }}
                aria-label={`Lire sur ${network}`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.92)" }}>
                  <Play size={22} fill={theme.text} color={theme.text} className="ml-1" />
                </span>
              </a>
            )}
          </div>
        )}
        <div className="flex items-center gap-4 py-3 text-xs" style={{ color: theme.textMuted }}>
          <span className="flex items-center gap-1"><Heart size={13} /> {plural(post.reactions, "réaction")}</span>
          <span className="flex items-center gap-1"><MessageCircle size={13} /> {plural(post.comments, "commentaire")}</span>
          {post.shares !== null && <span className="flex items-center gap-1"><Share2 size={13} /> {plural(post.shares, "partage")}</span>}
        </div>
      </div>

      {/* Commentaires */}
      <section className="border-t px-4 py-4" style={{ borderColor: theme.border }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: theme.text }}>Commentaires</h3>
          <button onClick={load} className="rounded-lg p-1.5 hover:bg-black/5" title="Recharger les commentaires">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: theme.textMuted }} />
          </button>
        </div>

        <div className="mb-4">
          <Composer
            placeholder={`Commenter en tant que ${post.accountName}…`}
            hint={<span className="flex items-center gap-1" style={{ color: theme.textMuted }}><MessageSquarePlus size={11} /> Nouveau commentaire sous la publication</span>}
            maxLength={8000}
            submitLabel="Publier"
            onSend={commentOnPost}
          />
        </div>

        {error ? (
          <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>
        ) : comments === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl" style={{ background: theme.bg }} />)}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: theme.textMuted }}>Aucun commentaire pour l'instant.</p>
        ) : (
          <div className="flex flex-col gap-4">{comments.map((c) => renderComment(c))}</div>
        )}
      </section>
    </article>
  );
}
