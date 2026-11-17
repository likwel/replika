import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Plug, Plus } from "lucide-react";
import { openAssociate } from "@/lib/associate";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateCard } from "@/components/ui/StateCard";
import { AccountBar } from "@/components/workspace/AccountBar";
import { PostsView } from "@/components/workspace/PostsView";
import { ConversationsView } from "@/components/workspace/ConversationsView";
import { InboxView } from "@/components/workspace/InboxView";
import { readStored, saveStored, type Focus } from "@/components/workspace/helpers";
import { setPendingFocus, takePendingFocus } from "@/components/workspace/pendingFocus";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";
import { useAccess } from "@/hooks/useAccess";

interface Ctx { sub: number; setSub: (i: number) => void; goTo: (menuId: string, sub: number) => void }

// Deux pages indépendantes sur la même mise en page : « Publications et messages » (hub, deux onglets)
// et « À traiter » (queue, la file des réponses à valider).
export type WorkspaceMode = "hub" | "queue";

// Onglets du hub = sous-menus de « Publications et messages » (même ordre)
type Tab = "posts" | "messages" | "inbox";
const TABS: Array<{ id: Tab; search: string }> = [
  { id: "posts", search: "Rechercher une publication…" },
  { id: "messages", search: "Rechercher une personne…" },
  // Page « À traiter » : hors des onglets du hub, mais même barre de recherche
  { id: "inbox", search: "Rechercher un auteur, un message…" },
];

const SELECTION_KEY = "replyka.workspace.accounts";
const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function WorkspacePage({ mode = "hub" }: { mode?: WorkspaceMode }) {
  const { sub, goTo } = useOutletContext<Ctx>();
  const { can, current } = useAccess();
  const tab: Tab = mode === "queue" ? "inbox" : (sub === 1 ? "messages" : "posts");

  const [accounts, setAccounts] = useState<WsAccount[] | null>(null);
  const [selected, setSelected] = useState<string[]>(() => readStored(SELECTION_KEY, [], isIdList));
  const [search, setSearch] = useState<Record<Tab, string>>({ posts: "", messages: "", inbox: "" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(takePendingFocus);
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null); // emplacement des filtres de l'onglet actif

  // Ignore les comptes mémorisés qui n'existent plus ; même tableau tant que la sélection ne change pas
  const idsKey = (accounts ? selected.filter((id) => accounts.some((a) => a.id === id)) : selected).join(",");
  const accountIds = useMemo(() => (idsKey ? idsKey.split(",") : []), [idsKey]);

  const loadAccounts = () => workspaceApi.accounts().then(setAccounts).catch(() => setAccounts((a) => a ?? []));

  useEffect(() => {
    loadAccounts();
  }, []);

  const changeSelection = (ids: string[]) => {
    setSelected(ids);
    saveStored(SELECTION_KEY, ids);
  };

  // Depuis « À traiter » : ouvre la publication ou la conversation d'origine, dans la page Publications et messages
  const open = (f: Focus) => {
    setPendingFocus(f);
    goTo("hub", f.kind === "post" ? 0 : 1);
  };

  const pending = (accounts ?? [])
    .filter((a) => accountIds.length === 0 || accountIds.includes(a.id))
    .reduce((n, a) => n + a.pending, 0);

  if (accounts && accounts.length === 0) {
    // Membre d'équipe sans droit sur les connexions : c'est au propriétaire de connecter ses Pages
    const canConnect = can("connections", "write");
    return (
      <StateCard
        icon={Plug}
        title="Aucun Compte Associé"
        className="mx-auto max-w-lg"
        action={canConnect && <Button icon={Plus} onClick={openAssociate}>Associer un compte</Button>}
      >
        {canConnect
          ? "Associez vos Pages Facebook et comptes Instagram pour gérer ici leurs publications, commentaires et messages."
          : `Aucune Page active dans l'espace ${current?.space ?? ""} : demandez à son propriétaire d'en associer une.`}
      </StateCard>
    );
  }

  // Sur mobile, un détail ouvert occupe tout l'écran
  const shared = { accountIds, toolbar, onDetailChange: setDetailOpen, onChanged: loadAccounts };

  // Une seule carte : en-tête (titre, description, onglets), barre de filtres, puis liste + détail qui défilent chacun de leur côté
  return (
    <section className="card-x flex flex-col overflow-hidden rounded-2xl lg:h-[calc(100dvh-10rem)] lg:min-h-[560px]">
      <div className={detailOpen ? "hidden lg:block" : undefined}>
        <PageHeader
          bare
          className=""
          description={mode === "queue"
            ? `${pending ? `${pending} à traiter : ` : ""}suggestions à valider et messages escaladés de toutes vos Pages et comptes.`
            : "Publications, commentaires et messages de toutes vos Pages et comptes, au même endroit."}
        />
      </div>

      {/* Filtres : recherche, filtres de l'onglet (insérés par l'onglet actif) et Pages */}
      <div className={`${detailOpen ? "hidden lg:flex" : "flex"} flex-col gap-2.5 border-t px-3 py-3 sm:px-5`} style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-shrink-0 lg:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
            <input
              value={search[tab]}
              onChange={(e) => setSearch((s) => ({ ...s, [tab]: e.target.value }))}
              placeholder={TABS.find((t) => t.id === tab)!.search}
              className="field-in h-9 w-full rounded-xl pl-9 pr-3 text-[13px] font-medium outline-none"
              style={{ border: 0 }}
            />
          </div>
          <div ref={setToolbar} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" />
        </div>
        {accounts && <AccountBar accounts={accounts} selected={accountIds} onChange={changeSelection} />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t" style={{ borderColor: "var(--line)" }}>
        {mode === "hub" ? (
          <>
            <PostsView
              {...shared}
              active={tab === "posts"}
              query={search.posts}
              focus={focus?.kind === "post" ? focus : null}
              onFocusDone={() => setFocus(null)}
            />
            <ConversationsView
              {...shared}
              active={tab === "messages"}
              query={search.messages}
              focus={focus?.kind === "conversation" ? focus : null}
              onFocusDone={() => setFocus(null)}
            />
          </>
        ) : (
          <InboxView {...shared} active accounts={accounts ?? []} query={search.inbox} onOpen={open} />
        )}
      </div>
    </section>
  );
}
