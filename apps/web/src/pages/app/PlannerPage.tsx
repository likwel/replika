import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, History, Plus, X, CalendarDays } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CalendarView } from "@/components/planner/CalendarView";
import { ScheduleList } from "@/components/planner/ScheduleList";
import { ScheduleComposer } from "@/components/planner/ScheduleComposer";
import { ScheduleDetails } from "@/components/planner/ScheduleDetails";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { dayKey, formatSlot, monthRange } from "@/components/planner/planner";
import { scheduleApi, type Schedule } from "@/lib/schedule.api";

interface Ctx { sub: number; setSub: (i: number) => void }

// Sous-menus de « Planifier » (même ordre)
const VIEWS = ["calendar", "queue", "drafts", "history"] as const;
type View = (typeof VIEWS)[number];
const TITLES: Record<View, string> = {
  calendar: "Calendrier Éditorial",
  queue: "File d'Attente",
  drafts: "Brouillons",
  history: "Historique des Envois",
};

type ComposerState = { initial?: Schedule | null; duplicate?: boolean; defaultDate?: Date | null } | null;

const byDate = (a: Schedule, b: Schedule) => +new Date(a.scheduledAt ?? a.createdAt) - +new Date(b.scheduledAt ?? b.createdAt);
const sentAt = (s: Schedule) => s.publishedAt ?? s.scheduledAt;

export function PlannerPage() {
  const { sub, setSub } = useOutletContext<Ctx>();
  const view: View = VIEWS[sub] ?? "calendar";

  const [items, setItems] = useState<Schedule[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [composer, setComposer] = useState<ComposerState>(null);
  const [details, setDetails] = useState<Schedule | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [notice, setNotice] = useState<{ ok: string; warnings: string[] } | null>(null);
  const request = useRef(0);

  const load = () => {
    const id = ++request.current;
    setLoading(true);
    scheduleApi
      .list()
      .then((list) => id === request.current && setItems(list))
      .catch(() => id === request.current && setItems((l) => l ?? []))
      .finally(() => id === request.current && setLoading(false));
  };

  useEffect(load, []);

  // Suivi des envois : rafraîchissement rapide tant qu'un envoi est imminent ou en cours, sinon chaque minute
  const busy = (items ?? []).some(
    (s) => s.status === "PUBLISHING" || (s.status === "SCHEDULED" && s.scheduledAt && new Date(s.scheduledAt).getTime() < Date.now() + 5000)
  );
  useEffect(() => {
    const timer = setInterval(load, busy ? 3000 : 60000);
    return () => clearInterval(timer);
  }, [busy]);

  // La fiche ouverte suit les mises à jour de la liste
  useEffect(() => {
    if (details) setDetails((items ?? []).find((s) => s.id === details.id) ?? details);
  }, [items]);

  const all = items ?? [];
  const queue = useMemo(() => all.filter((s) => s.status === "SCHEDULED" || s.status === "PUBLISHING").sort(byDate), [items]);
  const drafts = useMemo(() => all.filter((s) => s.status === "DRAFT").sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)), [items]);
  const history = useMemo(
    () => all.filter((s) => ["DONE", "PARTIAL", "FAILED"].includes(s.status)).sort((a, b) => +new Date(sentAt(b) ?? 0) - +new Date(sentAt(a) ?? 0)),
    [items]
  );
  const failures = history.filter((s) => s.status !== "DONE");
  const { start, end } = monthRange(month);
  const monthItems = all.filter((s) => s.scheduledAt && new Date(s.scheduledAt) >= start && new Date(s.scheduledAt) < end);
  const today = queue.filter((s) => s.scheduledAt && dayKey(new Date(s.scheduledAt)) === dayKey(new Date())).length;

  const saved = (s: Schedule, warnings: string[]) => {
    setComposer(null);
    setNotice({
      ok: s.status === "DRAFT" ? "Brouillon enregistré." : s.scheduledAt && new Date(s.scheduledAt).getTime() > Date.now() + 5000 ? `Programmé : ${formatSlot(s.scheduledAt)}.` : "Envoi en cours…",
      warnings,
    });
    load();
  };

  const changed = (s: Schedule | null) => {
    if (!s) setDetails(null);
    else setDetails(s);
    load();
  };

  const stat = (label: string, value: number, Icon: LucideIcon, target: number, color: string) => (
    <button
      onClick={() => setSub(target)}
      className="flex items-center gap-3 rounded-2xl p-3 text-left transition-all hover:shadow-sm"
      style={{ background: theme.bgCard, border: `1px solid ${sub === target ? theme.gold : theme.border}` }}
    >
      <span className="rounded-xl p-2" style={{ background: `${color}1A` }}>
        <Icon size={17} style={{ color }} />
      </span>
      <span>
        <span className="block text-lg font-bold leading-tight" style={{ color: theme.text }}>{value}</span>
        <span className="block text-[11px]" style={{ color: theme.textMuted }}>{label}</span>
      </span>
    </button>
  );

  const list = view === "queue" ? queue : view === "drafts" ? drafts : history;
  const empty: Record<Exclude<View, "calendar">, [string, string]> = {
    queue: ["Rien de programmé", "Programmez une publication, un commentaire ou un message : il partira automatiquement à l'heure choisie."],
    drafts: ["Aucun brouillon", "Enregistrez une programmation en brouillon pour la terminer plus tard."],
    history: ["Aucun envoi pour l'instant", "Les publications envoyées et leurs résultats apparaîtront ici."],
  };

  // Agenda mobile : jours du mois qui ont des éléments
  const agenda = useMemo(() => {
    const groups = new Map<string, Schedule[]>();
    for (const s of [...monthItems].sort(byDate)) {
      const k = dayKey(new Date(s.scheduledAt!));
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    return [...groups.entries()];
  }, [items, month]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Title className="text-lg">{TITLES[view]}</Title>
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Publications, commentaires et messages privés envoyés automatiquement sur vos Pages et comptes.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setComposer({})}>Nouvelle programmation</Button>
      </div>

      {notice && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: notice.warnings.length ? "#FEF3C7" : theme.goldSoft, color: notice.warnings.length ? "#92400e" : theme.goldDark }}>
          {notice.warnings.length ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />}
          <div className="flex-1">
            <p className="font-medium">{notice.ok}</p>
            {notice.warnings.map((w) => <p key={w} className="mt-0.5 text-xs">{w}</p>)}
          </div>
          <button onClick={() => setNotice(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stat("À venir", queue.length, CalendarClock, 1, theme.goldDark)}
        {stat("Aujourd'hui", today, CalendarDays, 0, "#2563eb")}
        {stat("Brouillons", drafts.length, FileText, 2, theme.textMuted)}
        {stat("Échecs", failures.length, failures.length ? AlertTriangle : History, 3, failures.length ? theme.red : "#15803d")}
      </div>

      {items === null ? (
        <ListSkeleton height={96} count={3} />
      ) : view === "calendar" ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_300px]">
          <div className="hidden sm:block">
            <CalendarView
              month={month}
              items={monthItems}
              loading={loading}
              onMonth={setMonth}
              onOpen={setDetails}
              onCreate={(d) => {
                const at = new Date(d);
                at.setHours(9, 0, 0, 0);
                setComposer({ defaultDate: at < new Date() ? null : at });
              }}
              onDay={setDay}
            />
          </div>

          {/* Mobile : agenda du mois */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex items-center justify-between">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg px-2 py-1 text-sm" style={{ color: theme.text }}>‹</button>
              <span className="text-sm font-semibold capitalize" style={{ color: theme.text }}>{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg px-2 py-1 text-sm" style={{ color: theme.text }}>›</button>
            </div>
            {agenda.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Rien ce mois-ci">Touchez « Nouvelle programmation » pour commencer.</EmptyState>
            ) : (
              agenda.map(([k, list]) => (
                <div key={k}>
                  <p className="mb-1.5 text-xs font-semibold capitalize" style={{ color: theme.textMuted }}>
                    {new Date(`${k}T12:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <ScheduleList items={list} onOpen={setDetails} />
                </div>
              ))
            )}
          </div>

          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <Title className="mb-3 text-base">Prochains Envois</Title>
              {queue.length === 0 ? (
                <p className="text-sm" style={{ color: theme.textMuted }}>Aucun envoi programmé.</p>
              ) : (
                <ScheduleList items={queue.slice(0, 5)} onOpen={setDetails} compact />
              )}
            </div>
            {failures.length > 0 && (
              <button
                onClick={() => setSub(3)}
                className="flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm"
                style={{ background: "#FDECEC", color: theme.red }}
              >
                <AlertTriangle size={16} />
                <span className="flex-1">{failures.length} envoi{failures.length > 1 ? "s" : ""} en échec à vérifier</span>
              </button>
            )}
          </aside>
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={view === "history" ? History : view === "drafts" ? FileText : CalendarClock} title={empty[view][0]}>
          {empty[view][1]}
        </EmptyState>
      ) : (
        <ScheduleList items={list} onOpen={setDetails} dateOf={view === "history" ? sentAt : undefined} />
      )}

      {day && (
        <Modal title={day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} onClose={() => setDay(null)}>
          <ScheduleList
            items={monthItems.filter((s) => dayKey(new Date(s.scheduledAt!)) === dayKey(day)).sort(byDate)}
            onOpen={(s) => {
              setDay(null);
              setDetails(s);
            }}
          />
        </Modal>
      )}

      {details && (
        <ScheduleDetails
          schedule={details}
          onClose={() => setDetails(null)}
          onEdit={() => {
            setComposer({ initial: details });
            setDetails(null);
          }}
          onDuplicate={() => {
            setComposer({ initial: details, duplicate: true });
            setDetails(null);
          }}
          onChanged={changed}
        />
      )}

      {composer && (
        <ScheduleComposer
          initial={composer.initial}
          duplicate={composer.duplicate}
          defaultDate={composer.defaultDate}
          onClose={() => setComposer(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
