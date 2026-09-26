import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessagesSquare, MousePointerClick } from "lucide-react";
import { theme } from "@/theme";
import { ApiError } from "@/lib/api";
import { workspaceApi, type AccountError, type WsConversation } from "@/lib/workspace.api";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { AccountErrors, EmptyState, FilterChips, ListSkeleton, RefreshButton } from "./WorkspaceUi";
import { isDesktop, type ConversationFocus } from "./helpers";

interface Props {
  active: boolean;
  accountIds: string[]; // vide = tous les comptes
  toolbar: HTMLElement | null; // bandeau de filtres en haut de la page
  query: string;
  focus: ConversationFocus | null;
  onFocusDone: () => void;
  onDetailChange: (open: boolean) => void;
  onChanged: () => void; // compteurs « à traiter » modifiés
}

const FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "unread", label: "Non lues" },
  { id: "pending", label: "À traiter" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const keyOf = (c: Pick<WsConversation, "accountId" | "id">) => `${c.accountId}:${c.id}`;

export function ConversationsView({ active, accountIds, toolbar, query, focus, onFocusDone, onDetailChange, onChanged }: Props) {
  const [conversations, setConversations] = useState<WsConversation[] | null>(null);
  const [errors, setErrors] = useState<AccountError[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [extra, setExtra] = useState<WsConversation | null>(null); // ouverte depuis « À traiter », hors de la liste
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const request = useRef(0);

  const key = accountIds.join(",");

  const load = () => {
    const id = ++request.current;
    setLoading(true);
    workspaceApi
      .conversations(accountIds.length ? accountIds : undefined)
      .then((d) => {
        if (id !== request.current) return; // réponse d'une ancienne sélection de comptes
        setConversations(d.conversations);
        setErrors(d.errors);
        if (isDesktop()) {
          setSelected((cur) => (cur && d.conversations.some((c) => keyOf(c) === cur) ? cur : d.conversations[0] ? keyOf(d.conversations[0]) : null));
        }
      })
      .catch(() => {
        if (id !== request.current) return;
        setConversations((c) => c ?? []);
        setErrors([{ accountId: "", accountName: "ReplyKA", message: "Chargement impossible, réessayez." }]);
      })
      .finally(() => {
        if (id !== request.current) return;
        setLoadedKey(key);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (active && loadedKey !== key) load();
  }, [active, key]);

  // Ouverture demandée depuis « À traiter » : conversation de la personne, dans la liste ou retrouvée à part
  useEffect(() => {
    if (!focus || !active || loading || loadedKey !== key) return;
    onFocusDone();
    setNotice(null);
    const found = conversations?.find((c) => c.accountId === focus.accountId && c.participant.id === focus.personId);
    if (found) {
      setSelected(keyOf(found));
      return;
    }
    workspaceApi
      .conversationWith(focus.accountId, focus.personId)
      .then((c) => {
        setExtra(c);
        setSelected(keyOf(c));
      })
      .catch((e) => setNotice(e instanceof ApiError ? e.message : "Conversation introuvable."));
  }, [focus, active, loading, loadedKey, key]);

  const current = conversations?.find((c) => keyOf(c) === selected) ?? (extra && keyOf(extra) === selected ? extra : null);

  useEffect(() => {
    if (active) onDetailChange(Boolean(current));
  }, [active, Boolean(current)]);

  const onSent = (conv: WsConversation, text: string) => {
    const sent = (c: WsConversation) =>
      keyOf(c) === keyOf(conv) ? { ...c, snippet: text, lastFromPage: true, unread: 0, pending: 0, updatedAt: new Date().toISOString() } : c;
    setConversations((list) => list?.map(sent) ?? null);
    setExtra((c) => (c ? sent(c) : c));
    if (conv.pending > 0) onChanged();
  };

  const q = query.trim().toLowerCase();
  const visible = (conversations ?? []).filter(
    (c) =>
      (filter === "all" || (filter === "unread" ? c.unread > 0 : c.pending > 0)) &&
      (!q || c.participant.name.toLowerCase().includes(q) || c.snippet.toLowerCase().includes(q) || c.accountName.toLowerCase().includes(q))
  );
  const counts: Partial<Record<Filter, number>> = {
    unread: (conversations ?? []).filter((c) => c.unread > 0).length,
    pending: (conversations ?? []).filter((c) => c.pending > 0).length,
  };
  const filtered = Boolean(q) || filter !== "all";

  return (
    <div className={active ? "flex flex-col gap-4" : "hidden"}>
      {active &&
        toolbar &&
        createPortal(
          <>
            <div className="min-w-0 flex-1">
              <FilterChips items={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} />
            </div>
            <RefreshButton loading={loading} onClick={load} />
          </>,
          toolbar
        )}
      <AccountErrors errors={errors} className={current ? "hidden lg:flex" : ""} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <section className={`${current ? "hidden lg:flex" : "flex"} min-w-0 flex-col gap-3`}>
          {notice && (
            <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "#FDECEC", color: theme.red }}>{notice}</p>
          )}

          {conversations === null ? (
            <ListSkeleton height={72} />
          ) : visible.length === 0 ? (
            <EmptyState icon={MessagesSquare} title={filtered ? "Aucun résultat pour ces filtres" : "Aucune conversation"}>
              {filtered ? "Modifiez la recherche ou les filtres." : "Aucun message privé récent sur les comptes sélectionnés."}
            </EmptyState>
          ) : (
            <ConversationList conversations={visible} selectedId={current?.id ?? null} onSelect={(c) => setSelected(keyOf(c))} />
          )}
        </section>

        <section className={`${current ? "" : "hidden lg:block"} min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto`}>
          {current ? (
            <ConversationView
              key={keyOf(current)}
              conversation={current}
              onBack={() => setSelected(null)}
              onSent={(text) => onSent(current, text)}
            />
          ) : (
            <EmptyState icon={MousePointerClick} title="Sélectionnez une conversation" dashed>
              Le fil de discussion s'affiche ici, avec une réponse proposée par l'IA si vous le souhaitez.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
