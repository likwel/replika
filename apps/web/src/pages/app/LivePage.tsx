import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Radio } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { NewSessionWizard } from "@/components/live/NewSessionWizard";
import { SessionView } from "@/components/live/SessionView";
import { SessionsList } from "@/components/live/SessionsList";
import { OrdersTable } from "@/components/live/OrdersTable";
import { OrderEditor } from "@/components/live/OrderEditor";
import { liveApi, type LiveOrder, type LiveSession } from "@/lib/live.api";

interface Ctx { sub: number; setSub: (i: number) => void }

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
            <SessionsList sessions={sessions} onOpen={setOpenId} />
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
