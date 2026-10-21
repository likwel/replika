import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Search, Facebook, Plug } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateCard } from "@/components/ui/StateCard";
import { AccountBar } from "@/components/workspace/AccountBar";
import { PostsView } from "@/components/workspace/PostsView";
import { ConversationsView } from "@/components/workspace/ConversationsView";
import { InboxView } from "@/components/workspace/InboxView";
import { readStored, saveStored, type Focus } from "@/components/workspace/helpers";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";
import { useAccess } from "@/hooks/useAccess";

interface Ctx { sub: number; setSub: (i: number) => void }

// Onglets = sous-menus de « Gestion » (même ordre)
type Tab = "posts" | "messages" | "inbox";
const TABS: Array<{ id: Tab; search: string }> = [
  { id: "posts", search: "Rechercher une publication…" },
  { id: "messages", search: "Rechercher une personne…" },
  { id: "inbox", search: "Rechercher un auteur, un message…" },
];

const SELECTION_KEY = "replyka.workspace.accounts";
const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function WorkspacePage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  const nav = useNavigate();
  const { can, current } = useAccess();
  const tab = TABS[sub]?.id ?? "posts";

  const [accounts, setAccounts] = useState<WsAccount[] | null>(null);
  const [selected, setSelected] = useState<string[]>(() => readStored(SELECTION_KEY, [], isIdList));
  const [search, setSearch] = useState<Record<Tab, string>>({ posts: "", messages: "", inbox: "" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
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

  // Depuis « À traiter » : ouvre la publication ou la conversation d'origine dans son onglet
  const open = (f: Focus) => {
    setFocus(f);
    setSub(f.kind === "post" ? 0 : 1);
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
        title="Aucun Compte Connecté"
        className="mx-auto max-w-lg"
        action={canConnect && <Button icon={Facebook} onClick={() => nav("/app/connexions")}>Connecter un compte</Button>}
      >
        {canConnect
          ? "Connectez vos Pages Facebook et comptes Instagram pour gérer ici leurs publications, commentaires et messages."
          : `Aucune Page active dans l'espace ${current?.space ?? ""} : demandez à son propriétaire d'en connecter une.`}
      </StateCard>
    );
  }

  // Sur mobile, un détail ouvert occupe tout l'écran
  const shared = { accountIds, toolbar, onDetailChange: setDetailOpen, onChanged: loadAccounts };

  return (
    <div className="flex flex-col gap-4">
      <div className={detailOpen ? "hidden lg:block" : undefined}>
        <PageHeader
          className="mb-1"
          description="Publications, commentaires et messages de toutes vos Pages et comptes, au même endroit."
          badges={{ 2: pending }}
        />
      </div>

      {/* Filtres en haut : recherche, filtres de l'onglet (insérés par l'onglet actif) et Pages */}
      <div
        className={`${detailOpen ? "hidden lg:flex" : "flex"} flex-col gap-2.5 rounded-2xl p-3`}
        style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-shrink-0 lg:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
            <input
              value={search[tab]}
              onChange={(e) => setSearch((s) => ({ ...s, [tab]: e.target.value }))}
              placeholder={TABS.find((t) => t.id === tab)!.search}
              className="w-full rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
            />
          </div>
          <div ref={setToolbar} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" />
        </div>
        {accounts && <AccountBar accounts={accounts} selected={accountIds} onChange={changeSelection} />}
      </div>

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
      <InboxView {...shared} active={tab === "inbox"} accounts={accounts ?? []} query={search.inbox} onOpen={open} />
    </div>
  );
}
