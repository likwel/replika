import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Search, Newspaper, MessagesSquare, Inbox, Facebook, Plug } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { AccountBar } from "@/components/workspace/AccountBar";
import { PostsView } from "@/components/workspace/PostsView";
import { ConversationsView } from "@/components/workspace/ConversationsView";
import { InboxView } from "@/components/workspace/InboxView";
import { readStored, saveStored, type Focus } from "@/components/workspace/helpers";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";

interface Ctx { sub: number; setSub: (i: number) => void }

// Onglets = sous-menus de « Gestion » (même ordre)
type Tab = "posts" | "messages" | "inbox";
const TABS: Array<{ id: Tab; label: string; short: string; icon: LucideIcon; search: string }> = [
  { id: "posts", label: "Publications", short: "Publications", icon: Newspaper, search: "Rechercher une publication…" },
  { id: "messages", label: "Messages privés", short: "Messages", icon: MessagesSquare, search: "Rechercher une personne…" },
  { id: "inbox", label: "À traiter", short: "À traiter", icon: Inbox, search: "Rechercher un auteur, un message…" },
];

const SELECTION_KEY = "replyka.workspace.accounts";
const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function WorkspacePage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  const nav = useNavigate();
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
    return (
      <div className="mx-auto max-w-lg rounded-2xl p-10 text-center" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
          <Plug size={24} style={{ color: theme.gold }} />
        </div>
        <Title className="text-lg">Aucun Compte Connecté</Title>
        <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>
          Connectez vos Pages Facebook et comptes Instagram pour gérer ici leurs publications, commentaires et messages.
        </p>
        <Button className="mx-auto mt-5" icon={Facebook} onClick={() => nav("/app/connexions")}>Connecter un compte</Button>
      </div>
    );
  }

  // Sur mobile, un détail ouvert occupe tout l'écran
  const shared = { accountIds, toolbar, onDetailChange: setDetailOpen, onChanged: loadAccounts };

  return (
    <div className="flex flex-col gap-4">
      <div className={`${detailOpen ? "hidden lg:flex" : "flex"} flex-col gap-3 lg:flex-row lg:items-center`}>
        <div className="flex-1">
          <Title className="text-lg">Espace de Gestion</Title>
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Publications, commentaires et messages de toutes vos Pages et comptes, au même endroit.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl p-1" style={{ background: theme.bg, border: `1px solid ${theme.border}` }} role="tablist">
          {TABS.map((t, i) => {
            const active = tab === t.id;
            const badge = t.id === "inbox" ? pending : 0;
            return (
              <button
                key={t.id}
                onClick={() => setSub(i)}
                className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all sm:flex-none sm:px-3 sm:text-sm"
                style={{ background: active ? theme.bgCard : "transparent", color: active ? theme.text : theme.textMuted, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}
                role="tab"
                aria-selected={active}
              >
                <t.icon size={16} className="hidden flex-shrink-0 sm:block" style={{ color: active ? theme.gold : theme.textMuted }} />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {badge > 0 && (
                  <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: theme.gold, color: "#1A1410" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>
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
