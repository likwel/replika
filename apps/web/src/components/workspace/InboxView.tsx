import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Inbox, MessageCircle, MessagesSquare, Layers } from "lucide-react";
import { theme } from "@/theme";
import { Segmented } from "@/components/ui/Segmented";
import { MessageCard } from "@/components/messages/MessageCard";
import { automationApi } from "@/lib/automation.api";
import { plural } from "@/lib/format";
import { messageApi, type InboxMessage, type MessageKind, type MessageStatus } from "@/lib/message.api";
import type { WsAccount } from "@/lib/workspace.api";
import { AccountErrors, EmptyState, FilterChips, ListSkeleton, RefreshButton } from "./WorkspaceUi";
import type { Focus } from "./helpers";

interface Props {
  active: boolean;
  accounts: WsAccount[]; // comptes affichés
  accountIds: string[]; // vide = tous les comptes
  toolbar: HTMLElement | null; // bandeau de filtres en haut de la page
  query: string;
  onOpen: (focus: Focus) => void; // publication ou conversation d'origine
  onDetailChange: (open: boolean) => void;
  onChanged: () => void; // compteurs « à traiter » modifiés
}

// File d'attente de l'automatisation (ex-page Messages) : suggestions à valider, escalades, historique
const STATUS_FILTERS: Array<{ id: string; label: string; statuses?: MessageStatus[] }> = [
  { id: "open", label: "À traiter", statuses: ["PENDING", "ESCALATED"] },
  { id: "escalated", label: "Escaladés", statuses: ["ESCALATED"] },
  { id: "replied", label: "Répondus", statuses: ["REPLIED"] },
  { id: "ignored", label: "Ignorés", statuses: ["IGNORED"] },
  { id: "all", label: "Historique" },
];

const KINDS: Array<{ value: "" | MessageKind; label: string; icon: typeof Layers }> = [
  { value: "", label: "Tout", icon: Layers },
  { value: "COMMENT", label: "Commentaires", icon: MessageCircle },
  { value: "DIRECT", label: "Messages", icon: MessagesSquare },
];

export function InboxView({ active, accounts, accountIds, toolbar, query, onOpen, onDetailChange, onChanged }: Props) {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState<"" | MessageKind>("");
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const request = useRef(0);

  const key = `${accountIds.join(",")}|${status}|${kind}`;

  const load = () => {
    const id = ++request.current;
    setLoading(true);
    messageApi
      .list({
        accounts: accountIds,
        kind: kind || undefined,
        status: STATUS_FILTERS.find((f) => f.id === status)?.statuses,
      })
      .then((list) => id === request.current && setMessages(list))
      .catch(() => id === request.current && setMessages((m) => m ?? []))
      .finally(() => {
        if (id !== request.current) return;
        setLoadedKey(key);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (active && loadedKey !== key) load();
  }, [active, key]);

  useEffect(() => {
    if (active) onDetailChange(false);
  }, [active]);

  // Relève d'abord les nouveautés côté Meta, puis recharge la liste
  const refresh = async () => {
    setSyncing(true);
    try {
      await automationApi.sync();
    } catch {
      // la liste locale reste consultable même si Meta est injoignable
    } finally {
      setSyncing(false);
      load();
      onChanged();
    }
  };

  const update = (m: InboxMessage) => {
    const before = messages?.find((x) => x.id === m.id);
    setMessages((list) => list?.map((x) => (x.id === m.id ? m : x)) ?? null);
    if (before?.status !== m.status) onChanged();
  };

  const contextOf = (m: InboxMessage) => {
    if (m.kind === "DIRECT") {
      return m.authorId
        ? { label: "Ouvrir la conversation", onOpen: () => onOpen({ kind: "conversation", accountId: m.accountId, personId: m.authorId! }) }
        : undefined;
    }
    return m.postId
      ? {
          label: "Voir la publication et ses commentaires",
          onOpen: () => onOpen({ kind: "post", accountId: m.accountId, postId: m.postId!, commentId: m.externalId }),
        }
      : undefined;
  };

  const q = query.trim().toLowerCase();
  const visible = (messages ?? []).filter(
    (m) =>
      !q ||
      m.authorName.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.account.name.toLowerCase().includes(q)
  );

  // La relève automatique échoue pour certains comptes : rien n'arrive dans la file pour eux
  const syncErrors = accounts
    .filter((a) => a.syncError && (accountIds.length === 0 || accountIds.includes(a.id)))
    .map((a) => ({ accountId: a.id, accountName: a.accountName, message: a.syncError! }));

  return (
    <div className={active ? "mx-auto flex w-full max-w-3xl flex-col gap-4" : "hidden"}>
      {active &&
        toolbar &&
        createPortal(
          <>
            <div className="min-w-0 flex-1">
              <FilterChips items={STATUS_FILTERS} value={status} onChange={setStatus} />
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 sm:flex-none">
                <Segmented options={KINDS} value={kind} onChange={setKind} />
              </div>
              <RefreshButton loading={loading || syncing} onClick={refresh} title="Relever les nouveaux commentaires et messages" />
            </div>
          </>,
          toolbar
        )}
      <AccountErrors errors={syncErrors} />

      {messages !== null && (
        <p className="-mb-1 text-[11px]" style={{ color: theme.textMuted }}>
          {plural(visible.length, "élément")}
          {status === "open" && " en attente d'une réponse ou d'une validation"}
        </p>
      )}

      {messages === null ? (
        <ListSkeleton height={128} count={3} />
      ) : visible.length === 0 ? (
        status === "open" && !q ? (
          <EmptyState icon={CheckCircle2} title="Tout est traité">
            Aucun commentaire ni message en attente sur les comptes sélectionnés. Les nouveaux arrivent ici automatiquement.
          </EmptyState>
        ) : (
          <EmptyState icon={Inbox} title="Aucun élément">
            {q ? "Aucun résultat pour cette recherche." : "Rien dans cette catégorie pour les comptes sélectionnés."}
          </EmptyState>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((m) => (
            <MessageCard key={m.id} message={m} onChange={update} context={contextOf(m)} />
          ))}
        </div>
      )}
    </div>
  );
}
