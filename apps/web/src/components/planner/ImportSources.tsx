import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSpreadsheet, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { ApiError } from "@/lib/api";
import { swal } from "@/lib/swal";
import { INTERVALS, scheduleImportApi, type ScheduleSource } from "@/lib/scheduleImport.api";

const ago = (iso: string | null) => {
  if (!iso) return "jamais";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
};

const sheetLink = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined);

// Onglet « Imports » : tableurs gardés pour l'import automatique (état, relève immédiate, fréquence, suppression)
export function ImportSources({ onImport, onChanged }: { onImport: () => void; onChanged: () => void }) {
  const [sources, setSources] = useState<ScheduleSource[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => scheduleImportApi.sources().then(setSources).catch(() => setSources((s) => s ?? []));
  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const patch = async (s: ScheduleSource, body: Parameters<typeof scheduleImportApi.updateSource>[1]) => {
    setSources((l) => (l ?? []).map((x) => (x.id === s.id ? { ...x, ...body } : x)));
    try {
      await scheduleImportApi.updateSource(s.id, body);
    } catch (e) {
      swal.toast({ variant: "error", title: "Modification impossible", text: e instanceof ApiError ? e.message : undefined });
      void load();
    }
  };

  const sync = async (s: ScheduleSource) => {
    setBusy(s.id);
    try {
      const r = await scheduleImportApi.syncSource(s.id);
      swal.toast({ title: r.summary.created ? `${r.summary.created} publication${r.summary.created > 1 ? "s" : ""} importée${r.summary.created > 1 ? "s" : ""}` : "Rien de nouveau dans le tableur" });
      if (r.summary.created) onChanged();
    } catch (e) {
      swal.toast({ variant: "error", title: "Relève impossible", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
      void load();
    }
  };

  const remove = async (s: ScheduleSource) => {
    if (!(await swal.confirm({ title: `Retirer « ${s.name} » ?`, text: "Les publications déjà programmées restent. Le tableur ne sera plus relu.", confirmText: "Retirer", variant: "warning" }))) return;
    try {
      await scheduleImportApi.removeSource(s.id);
      setSources((l) => (l ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      swal.toast({ variant: "error", title: "Suppression impossible", text: e instanceof ApiError ? e.message : undefined });
    }
  };

  if (sources === null) return <ListSkeleton height={96} count={2} />;
  if (sources.length === 0) {
    return (
      <EmptyState icon={FileSpreadsheet} title="Aucun tableur relié">
        <p>Importez vos publications depuis Google Sheets : SuiteFlow lit les dates, textes et liens d'images, télécharge les médias et programme tout seul, y compris les lignes ajoutées plus tard.</p>
        <div className="mt-4 flex justify-center">
          <Button icon={Plus} onClick={onImport}>Importer un tableur</Button>
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sources.map((s) => {
        const error = s.lastStatus === "ERROR";
        return (
          <div key={s.id} className="rounded-2xl p-4 card-x">
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                <FileSpreadsheet size={19} />
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-[14px] font-bold" style={{ color: theme.text }}>{s.name}</p>
                <a href={sheetLink(s.url)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs hover:underline" style={{ color: theme.textMuted }}>
                  <span className="truncate">{s.url}</span> <ExternalLink size={11} className="flex-shrink-0" />
                </a>
                <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px]" style={{ color: error ? theme.red : theme.text }}>
                  {error ? <AlertTriangle size={14} className="mt-px flex-shrink-0" /> : <CheckCircle2 size={14} className="mt-px flex-shrink-0" style={{ color: theme.green }} />}
                  <span>
                    {s.lastMessage ?? "Pas encore relu"} <span style={{ color: theme.textMuted }}>· {ago(s.lastSyncAt)}</span>
                  </span>
                </p>
                <p className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>{s.importedCount} publication{s.importedCount > 1 ? "s" : ""} importée{s.importedCount > 1 ? "s" : ""}{s.asDraft ? " · en brouillons" : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
                  <span className="text-[13px] font-medium" style={{ color: theme.text }}>{s.autoSync ? "Automatique" : "En pause"}</span>
                  <Toggle checked={s.autoSync} onChange={(v) => patch(s, { autoSync: v })} label={`Import automatique : ${s.name}`} />
                </label>
                {s.autoSync && (
                  <Select value={String(s.intervalMinutes)} onChange={(e) => patch(s, { intervalMinutes: Number(e.target.value) })} className="h-9 w-48 text-[13px]">
                    {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </Select>
                )}
                <Button size="sm" variant="ghost" icon={busy === s.id ? Loader2 : RefreshCw} onClick={() => sync(s)} disabled={busy !== null} className={busy === s.id ? "[&>svg]:animate-spin" : ""}>Relire maintenant</Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(s)} aria-label={`Retirer ${s.name}`}>Retirer</Button>
              </div>
            </div>
          </div>
        );
      })}
      <div>
        <Button icon={Plus} variant="ghost" onClick={onImport}>Importer un autre tableur</Button>
      </div>
    </div>
  );
}
