import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import { createPortal } from "react-dom";
import { LayoutGrid, List, MousePointerClick, Newspaper } from "lucide-react";
import { theme } from "@/theme";
import { plural } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { workspaceApi, type AccountError, type WsPost } from "@/lib/workspace.api";
import { PostList } from "./PostList";
import { PostGrid } from "./PostGrid";
import { PostDetail } from "./PostDetail";
import { AccountErrors, EmptyState, FilterChips, ListSkeleton, RefreshButton } from "./WorkspaceUi";
import { isDesktop, readStored, saveStored, type PostFocus } from "./helpers";

interface Props {
  active: boolean;
  accountIds: string[]; // vide = tous les comptes
  toolbar: HTMLElement | null; // bandeau de filtres en haut de la page
  query: string;
  focus: PostFocus | null;
  onFocusDone: () => void;
  onDetailChange: (open: boolean) => void;
  onChanged: () => void; // compteurs « à traiter » modifiés
}

const STATUS_FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "comments", label: "Avec commentaires" },
  { id: "pending", label: "À traiter" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

// Types de publication (anciens onglets d'Actualités) ; seuls ceux présents sont proposés
const TYPE_FILTERS: Array<{ id: string; label: string; kinds: string[] }> = [
  { id: "all", label: "Tous les types", kinds: [] },
  { id: "photo", label: "Photos", kinds: ["image", "carousel"] },
  { id: "video", label: "Vidéos", kinds: ["video"] },
  { id: "reel", label: "Reels", kinds: ["reel"] },
  { id: "event", label: "Événements", kinds: ["event"] },
  { id: "text", label: "Textes", kinds: ["text"] },
];

type ViewMode = "list" | "grid";
const VIEW_KEY = "replyka.workspace.postView";
const isViewMode = (v: unknown): v is ViewMode => v === "list" || v === "grid";

export function PostsView({ active, accountIds, toolbar, query, focus, onFocusDone, onDetailChange, onChanged }: Props) {
  const [posts, setPosts] = useState<WsPost[] | null>(null);
  const [errors, setErrors] = useState<AccountError[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extra, setExtra] = useState<WsPost | null>(null); // ouverte depuis « À traiter », hors de la liste
  const [notice, setNotice] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | undefined>();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState("all");
  const [view, setView] = useState<ViewMode>(() => readStored(VIEW_KEY, "list", isViewMode));
  const request = useRef(0);

  const key = accountIds.join(",");

  const load = () => {
    const id = ++request.current;
    setLoading(true);
    workspaceApi
      .posts(accountIds.length ? accountIds : undefined)
      .then((d) => {
        if (id !== request.current) return; // réponse d'une ancienne sélection de comptes
        setPosts(d.posts);
        setErrors(d.errors);
        if (isDesktop()) setSelectedId((cur) => (cur && d.posts.some((p) => p.id === cur) ? cur : d.posts[0]?.id ?? null));
      })
      .catch(() => {
        if (id !== request.current) return;
        setPosts((p) => p ?? []);
        setErrors([{ accountId: "", accountName: "SuiteFlow", message: "Chargement impossible, réessayez." }]);
      })
      .finally(() => {
        if (id !== request.current) return;
        setLoadedKey(key);
        setLoading(false);
      });
  };

  // Chargé à la première ouverture de l'onglet, puis à chaque changement de comptes
  useEffect(() => {
    if (active && loadedKey !== key) load();
  }, [active, key]);

  // Ouverture demandée depuis « À traiter » : dans la liste si possible, sinon chargée à part
  useEffect(() => {
    if (!focus || !active || loading || loadedKey !== key) return;
    onFocusDone();
    setNotice(null);
    setHighlight(focus.commentId);
    const found = posts?.find((p) => p.accountId === focus.accountId && p.id === focus.postId);
    if (found) {
      setSelectedId(found.id);
      return;
    }
    workspaceApi
      .post(focus.accountId, focus.postId)
      .then((p) => {
        setExtra(p);
        setSelectedId(p.id);
      })
      .catch((e) => setNotice(e instanceof ApiError ? e.message : "Publication introuvable."));
  }, [focus, active, loading, loadedKey, key]);

  const current = posts?.find((p) => p.id === selectedId) ?? (extra?.id === selectedId ? extra : null);

  useEffect(() => {
    if (active) onDetailChange(Boolean(current));
  }, [active, Boolean(current)]);

  const select = (p: WsPost) => {
    setHighlight(undefined);
    setSelectedId(p.id);
  };

  const patch = (post: WsPost, change: Partial<WsPost>) => {
    setPosts((list) => list?.map((p) => (p.id === post.id ? { ...p, ...change } : p)) ?? null);
    setExtra((p) => (p?.id === post.id ? { ...p, ...change } : p));
    if (change.pending !== undefined && change.pending !== post.pending) onChanged();
  };

  const changeView = (v: ViewMode) => {
    setView(v);
    saveStored(VIEW_KEY, v);
  };

  // Filtres en mémoire
  const q = query.trim().toLowerCase();
  const kinds = TYPE_FILTERS.find((t) => t.id === type)?.kinds ?? [];
  const visible = (posts ?? []).filter(
    (p) =>
      (status === "all" || (status === "comments" ? p.comments > 0 : p.pending > 0)) &&
      (kinds.length === 0 || kinds.includes(p.kind)) &&
      (!q || p.text.toLowerCase().includes(q) || p.accountName.toLowerCase().includes(q))
  );
  const types = TYPE_FILTERS.filter((t) => t.kinds.length === 0 || posts?.some((p) => t.kinds.includes(p.kind)));
  const pendingCount = (posts ?? []).filter((p) => p.pending > 0).length;
  const filtered = Boolean(q) || status !== "all" || type !== "all";

  const viewButton = (v: ViewMode, Icon: typeof List, label: string) => (
    <button
      onClick={() => changeView(v)}
      className={`seg-b !min-h-[30px] !w-[30px] !px-0 ${view === v ? "on" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={view === v}
    >
      <Icon size={15} style={{ color: view === v ? "var(--brand-ink)" : undefined }} />
    </button>
  );

  // Filtres de l'onglet, affichés dans le bandeau en haut de la page
  const filters = (
    <>
      <div className="min-w-0 flex-1">
        <FilterChips
          items={STATUS_FILTERS.map((f) => (f.id === "pending" ? { ...f, count: pendingCount } : f))}
          value={status}
          onChange={setStatus}
        />
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="field-in h-9 min-w-0 flex-1 rounded-xl px-3 text-[13px] font-medium outline-none sm:w-44 sm:flex-none"
          style={{ border: 0 }}
          aria-label="Type de publication"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </Select>
        <div className="seg !gap-0.5" role="group" aria-label="Affichage">
          {viewButton("list", List, "Vue liste")}
          {viewButton("grid", LayoutGrid, "Vue galerie")}
        </div>
        <RefreshButton loading={loading} onClick={load} />
      </div>
    </>
  );

  return (
    <div className={active ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
      {active && toolbar && createPortal(filters, toolbar)}
      <AccountErrors errors={errors} className={`mx-3 mt-3 sm:mx-5 ${current ? "hidden lg:flex" : ""}`} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,400px)_1fr]">
        {/* Liste */}
        <section className={`${current ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 max-h-[68dvh] flex-col gap-3 overflow-y-auto p-3 lg:max-h-none lg:[border-right:1px_solid_var(--line)]`}>
          {/* En-tête de liste collant : le total reste visible pendant le défilement */}
          {posts !== null && (
            <div className="sticky -top-3 z-10 -mx-3 -mt-3 flex items-center justify-between gap-2 px-4 py-2 text-[12px] font-semibold" style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", color: theme.textMuted }}>
              <span>{plural(visible.length, "publication")}{filtered ? " (filtré)" : ""}</span>
              {pendingCount > 0 && <span className="chip brand">{pendingCount} à traiter</span>}
            </div>
          )}
          {notice && (
            <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "#FDECEC", color: theme.red }}>{notice}</p>
          )}

          {posts === null ? (
            <ListSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState icon={Newspaper} title={filtered ? "Aucun résultat pour ces filtres" : "Aucune publication"}>
              {filtered ? "Modifiez la recherche ou les filtres." : "Aucune publication récente sur les comptes sélectionnés."}
            </EmptyState>
          ) : view === "grid" ? (
            <PostGrid posts={visible} selectedId={selectedId} onSelect={select} />
          ) : (
            <PostList posts={visible} selectedId={selectedId} onSelect={select} />
          )}
        </section>

        {/* Détail */}
        <section className={`${current ? "" : "hidden lg:block"} min-h-0 min-w-0 lg:overflow-y-auto`}>
          {current ? (
            <PostDetail
              key={`${current.accountId}:${current.id}`}
              post={current}
              highlightId={highlight}
              onBack={() => setSelectedId(null)}
              onChange={(change) => patch(current, change)}
            />
          ) : (
            <EmptyState icon={MousePointerClick} title="Sélectionnez une publication" bare>
              Ses commentaires s'affichent ici : répondez, masquez ou supprimez sans quitter SuiteFlow.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
