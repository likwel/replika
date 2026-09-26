import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, MessageCircle, Plus, Radio, ShoppingBag, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { NewSessionWizard } from "@/components/live/NewSessionWizard";
import { SessionView } from "@/components/live/SessionView";
import { OrdersTable } from "@/components/live/OrdersTable";
import { OrderEditor } from "@/components/live/OrderEditor";
import { timeAgo } from "@/lib/format";
import { formatAriary, liveApi, type LiveOrder, type LiveSession } from "@/lib/live.api";

interface Ctx { sub: number; setSub: (i: number) => void }

const STATUS = {
  ACTIVE: { label: "Capture active", color: "#15803d", bg: "#E7F6EC" },
  PAUSED: { label: "En pause", color: "#b45309", bg: "#FEF3C7" },
  ENDED: { label: "Terminée", color: theme.textMuted, bg: theme.bg },
} as const;

function SessionCard({ s, onOpen }: { s: LiveSession; onOpen: () => void }) {
  const todo = (s.stats.byStatus.NEW ?? 0) + (s.stats.byStatus.MESSAGED ?? 0) + (s.stats.byStatus.PARTIAL ?? 0);
  const status = STATUS[s.status];
  const counters: Array<{ icon: LucideIcon; n: number; label: string; warn?: boolean }> = [
    { icon: MessageCircle, n: s._count.comments, label: "comment." },
    { icon: ShoppingBag, n: s.stats.orders, label: "JP" },
    { icon: Users, n: s.stats.customers, label: "clients" },
    { icon: AlertTriangle, n: todo, label: "à compléter", warn: todo > 0 },
  ];
  return (
    <button onClick={onOpen} className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-md" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="flex items-start gap-3">
        <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl" style={{ background: theme.bg }}>
          {s.thumbnail ? <img src={s.thumbnail} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center"><Radio size={20} style={{ color: theme.textMuted }} /></span>}
          {s.liveStatus === "LIVE" && s.status !== "ENDED" && (
            <span className="absolute bottom-1 left-1 rounded px-1 text-[8px] font-bold text-white" style={{ background: "#dc2626" }}>LIVE</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" style={{ color: theme.text }}>{s.title}</p>
          <p className="flex items-center gap-1.5 truncate text-xs" style={{ color: theme.textMuted }}>
            <AccountAvatar name={s.account.name} src={s.account.avatarUrl} platform={s.account.platform} size={16} />
            {s.account.name} · {timeAgo(s.createdAt)}
          </p>
          <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {counters.map((c) => (
          <div key={c.label} className="rounded-lg py-1.5" style={{ background: theme.bg }}>
            <p className="flex items-center justify-center gap-1 text-sm font-bold" style={{ color: c.warn ? "#b45309" : theme.text }}>
              <c.icon size={12} style={{ color: theme.textMuted }} /> {c.n}
            </p>
            <p className="text-[10px]" style={{ color: theme.textMuted }}>{c.label}</p>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
        <Wallet size={12} /> Confirmé : <strong style={{ color: theme.text }}>{formatAriary(s.stats.revenue)}</strong>
        {s.syncError && s.status === "ACTIVE" && <span className="ml-auto flex items-center gap-1" style={{ color: theme.red }}><AlertTriangle size={11} /> Lecture en échec</span>}
      </p>
    </button>
  );
}

export function LivePage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [editing, setEditing] = useState<LiveOrder | null>(null);

  const loadSessions = () => liveApi.sessions().then(setSessions).catch(() => setSessions([]));
  const loadOrders = () => liveApi.orders(sessionFilter ? { sessionId: sessionFilter } : {}).then(setOrders).catch(() => setOrders([]));

  useEffect(() => {
    loadSessions();
  }, [openId]);
  useEffect(() => {
    if (sub === 1) loadOrders();
  }, [sub, sessionFilter]);

  // Liste des sessions : compteurs rafraîchis tant qu'une capture est active
  useEffect(() => {
    if (sub !== 0 || openId || !sessions?.some((s) => s.status === "ACTIVE")) return;
    const timer = setInterval(loadSessions, 10000);
    return () => clearInterval(timer);
  }, [sub, openId, sessions]);

  if (sub === 0 && openId) {
    return <SessionView sessionId={openId} onBack={() => setOpenId(null)} onDeleted={() => setOpenId(null)} />;
  }

  const header = (title: string, text: string) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <Title className="text-lg">{title}</Title>
        <p className="text-xs" style={{ color: theme.textMuted }}>{text}</p>
      </div>
      <Button icon={Plus} onClick={() => setWizard(true)}>Nouvelle session</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {sub === 0 ? (
        <>
          {header("Sessions de Vente Live", "Les « jp » de vos lives sont capturés, le client reçoit un message privé et ses coordonnées sont rangées dans un tableau.")}
          {sessions === null ? (
            <ListSkeleton height={170} count={2} />
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl p-6" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <EmptyState icon={Radio} title="Aucune session pour l'instant">
                Démarrez une session pendant (ou juste avant) votre live Facebook.
              </EmptyState>
              <ol className="mx-auto mt-4 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
                {[
                  ["1. Capture", "Chaque commentaire « jp A3 » devient une commande, avec l'article et la quantité."],
                  ["2. Message privé", "Le client reçoit automatiquement un message qui demande son nom, son téléphone et son adresse."],
                  ["3. Tableau des JP", "Sa réponse est lue et rangée dans le tableau : confirmez, livrez, exportez vers Excel."],
                ].map(([t, d]) => (
                  <li key={t} className="rounded-xl p-3" style={{ background: theme.bg }}>
                    <p className="font-semibold" style={{ color: theme.text }}>{t}</p>
                    <p className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>{d}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex justify-center">
                <Button icon={Plus} onClick={() => setWizard(true)}>Démarrer une session</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sessions.map((s) => <SessionCard key={s.id} s={s} onOpen={() => setOpenId(s.id)} />)}
            </div>
          )}
        </>
      ) : (
        <>
          {header("Commandes JP", "Toutes les commandes capturées pendant vos lives, par session.")}
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none sm:w-80"
            style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
            aria-label="Session"
          >
            <option value="">Toutes les sessions</option>
            {(sessions ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <OrdersTable
            orders={orders}
            showSession
            exportName={sessionFilter ? `JP - ${sessions?.find((s) => s.id === sessionFilter)?.title ?? "session"}` : "JP - toutes les sessions"}
            onOpen={setEditing}
            onChanged={(o) => setOrders((list) => list?.map((x) => (x.id === o.id ? { ...x, ...o } : x)) ?? null)}
          />
        </>
      )}

      {wizard && (
        <NewSessionWizard
          onClose={() => setWizard(false)}
          onCreated={(s) => {
            setWizard(false);
            setSub(0);
            setOpenId(s.id);
          }}
        />
      )}
      {editing && (
        <OrderEditor
          order={editing}
          sessionId={editing.sessionId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadOrders();
          }}
          onMessageSent={(o) => setOrders((list) => list?.map((x) => (x.id === o.id ? { ...x, ...o } : x)) ?? null)}
          onRemoved={() => {
            setEditing(null);
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
