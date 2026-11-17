import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Select";
import { useOutletContext } from "react-router-dom";
import { Plus, Radio } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { NewSessionWizard } from "@/components/live/NewSessionWizard";
import { SessionView } from "@/components/live/SessionView";
import { SessionsList } from "@/components/live/SessionsList";
import { OrdersTable } from "@/components/live/OrdersTable";
import { ProductLists } from "@/components/live/ProductLists";
import { OrderEditor } from "@/components/live/OrderEditor";
import { liveApi, type LiveOrder, type LiveSession } from "@/lib/live.api";
import { billingApi, liveHoursLeft } from "@/lib/billing.api";
import { liveHours } from "@/lib/liveHours";

interface Ctx { sub: number; setSub: (i: number) => void }

export function LivePage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [editing, setEditing] = useState<LiveOrder | null>(null);
  // Plus d'heures de live (quota du mois épuisé ou abonnement terminé) : achat d'heures à l'unité
  const openWizard = async () => {
    const o = await billingApi.overview().catch(() => null);
    if (!o || liveHoursLeft(o).canRun) return setWizard(true);
    liveHours.open(
      o.subscription.active
        ? `Les ${o.subscription.limits.liveHours} h de live de votre formule sont utilisées ce mois-ci.`
        : "Votre abonnement est terminé : Live Manager fonctionne avec des heures achetées à l'unité.",
    );
  };

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

  const inSession = sub === 0 && Boolean(openId);

  const header = (text: string) => (
    <PageHeader bare className="" description={text} actions={<Button icon={Plus} onClick={() => void openWizard()}>Nouvelle session</Button>} />
  );
  const headerText = [
    "Les « jp » de vos lives sont capturés, le client reçoit un message privé et ses coordonnées sont rangées dans un tableau.",
    "Toutes les commandes capturées pendant vos lives, par session.",
    "Préparez vos articles avant le live (Google Sheets, Excel, CSV) : au démarrage d'une session, il suffit de joindre la liste.",
  ][sub] ?? "";

  // Une seule carte : en-tête et onglets (sauf dans une session, qui a son propre en-tête), puis le contenu qui défile
  return (
    <>
      <section className="card-x flex flex-col overflow-hidden rounded-2xl lg:h-[calc(100dvh-10rem)] lg:min-h-[560px]">
        {!inSession && header(headerText)}

        <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-5 ${inSession ? "" : "border-t"}`} style={inSession ? undefined : { borderColor: "var(--line)" }}>
          {inSession ? (
            <SessionView sessionId={openId!} onBack={() => setOpenId(null)} onDeleted={() => setOpenId(null)} />
          ) : sub === 0 ? (
            sessions === null ? (
              <ListSkeleton height={170} count={2} />
            ) : sessions.length === 0 ? (
              <div className="py-2">
                <EmptyState bare icon={Radio} title="Aucune session pour l'instant">
                  Démarrez une session pendant (ou juste avant) votre live Facebook.
                </EmptyState>
                <ol className="mx-auto mt-2 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
                  {[
                    ["1. Capture", "Chaque commentaire « jp A3 » devient une commande, avec l'article et la quantité."],
                    ["2. Message privé", "Le client reçoit automatiquement un message qui demande son nom, son téléphone et son adresse."],
                    ["3. Tableau des JP", "Sa réponse est lue et rangée dans le tableau : confirmez, livrez, exportez vers Excel."],
                  ].map(([t, d]) => (
                    <li key={t} className="row-s !block">
                      <p className="font-semibold" style={{ color: theme.text }}>{t}</p>
                      <p className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>{d}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex justify-center">
                  <Button icon={Plus} onClick={() => void openWizard()}>Démarrer une session</Button>
                </div>
              </div>
            ) : (
              <SessionsList sessions={sessions} onOpen={setOpenId} />
            )
          ) : sub === 2 ? (
            <ProductLists />
          ) : (
            <>
              <Select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium sm:w-80"
                style={{ border: 0 }}
                aria-label="Session"
              >
                <option value="">Toutes les sessions</option>
                {(sessions ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </Select>
              <OrdersTable
                orders={orders}
                showSession
                exportName={sessionFilter ? `JP - ${sessions?.find((s) => s.id === sessionFilter)?.title ?? "session"}` : "JP - toutes les sessions"}
                onOpen={setEditing}
                onChanged={(o) => setOrders((list) => list?.map((x) => (x.id === o.id ? { ...x, ...o } : x)) ?? null)}
              />
            </>
          )}
        </div>
      </section>

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
    </>
  );
}
