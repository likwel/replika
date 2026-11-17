import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ClipboardCopy, Download, FileSpreadsheet, FileUp, Image as ImageIcon, Info, Link2, Loader2, RefreshCw, ScanSearch, Sheet, Sparkles, Upload, X,
} from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { formatSlot } from "@/components/planner/planner";
import { ApiError } from "@/lib/api";
import { swal } from "@/lib/swal";
import { workspaceApi, type WsAccount } from "@/lib/workspace.api";
import {
  INTERVALS, scheduleImportApi, templateCsv, templateTsv,
  type ImportPreview, type ImportRow, type ImportSummary, type ImportTemplate, type RowResult,
} from "@/lib/scheduleImport.api";

interface Props {
  onClose: () => void;
  onDone: () => void; // des publications ont été créées : la page se recharge
}

type Origin = "sheet" | "csv";
type Step = "source" | "preview" | "result";

const MAX_CSV = 90_000;
const STEP_LABEL: Record<Step, string> = { source: "1 sur 3 · Source", preview: "2 sur 3 · Vérification", result: "3 sur 3 · Résultat" };

const Label = ({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) => (
  <div className="mb-1.5">
    <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{children}</p>
    {hint && <p className="text-xs" style={{ color: theme.textMuted }}>{hint}</p>}
  </div>
);

// Importer des publications depuis un tableur : 1. la source (lien Google Sheets, fichier ou texte CSV) et les comptes,
// 2. la vérification ligne par ligne, 3. le résultat. Un lien peut être gardé : le tableur est relu et les nouvelles lignes importées seules.
export function ImportModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("source");
  const [origin, setOrigin] = useState<Origin>("sheet");
  const [url, setUrl] = useState("");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<WsAccount[] | null>(null);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [asDraft, setAsDraft] = useState(false);
  const [template, setTemplate] = useState<ImportTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [keep, setKeep] = useState(true);
  const [sourceName, setSourceName] = useState("");
  const [interval, setInterval] = useState(60);
  const [result, setResult] = useState<{ results: RowResult[]; summary: ImportSummary; kept: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const created = useRef(false);

  useEffect(() => {
    workspaceApi.accounts().then((a) => setAccounts(a.filter((x) => x.platform === "FACEBOOK" || x.platform === "INSTAGRAM"))).catch(() => setAccounts([]));
    scheduleImportApi.template().then(setTemplate).catch(() => undefined);
  }, []);

  const toggleAccount = (id: string) => setAccountIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const source = origin === "sheet" ? { url: url.trim() } : { csv };
  const ready = origin === "sheet" ? /^https?:\/\/\S+$/i.test(url.trim()) : csv.trim().length > 0;
  const fail = (e: unknown, fallback: string) => setError(e instanceof ApiError ? e.message : fallback);

  const close = () => {
    onClose();
    if (created.current) onDone();
  };

  const copyTemplate = async () => {
    if (!template) return;
    try {
      await navigator.clipboard.writeText(templateTsv(template.rows));
      swal.toast({ title: "Modèle copié : collez-le dans la cellule A1 de Google Sheets" });
    } catch {
      swal.toast({ variant: "error", title: "Copie impossible : téléchargez le modèle CSV" });
    }
  };

  const downloadTemplate = () => {
    if (!template) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([templateCsv(template.rows)], { type: "text/csv;charset=utf-8" }));
    a.download = "modele-publications-suiteflow.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    const text = await f.text();
    if (text.length > MAX_CSV) return setError(`Fichier trop long (${MAX_CSV.toLocaleString("fr-FR")} caractères maximum) : importez moins de lignes ou utilisez un lien Google Sheets.`);
    setCsv(text);
    setFileName(f.name);
  };

  const analyse = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await scheduleImportApi.preview({ source, accountIds, asDraft });
      setPreview(p);
      setStep("preview");
      if (!sourceName) setSourceName(origin === "sheet" ? "Tableur Google Sheets" : "");
    } catch (e) {
      fail(e, "Lecture impossible : vérifiez le lien ou le contenu.");
    } finally {
      setBusy(false);
    }
  };

  const importNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const kept = origin === "sheet" && keep;
      const r = await scheduleImportApi.commit({
        source,
        accountIds,
        asDraft,
        save: kept ? { name: sourceName.trim() || "Tableur Google Sheets", autoSync: true, intervalMinutes: interval } : undefined,
      });
      created.current = r.summary.created > 0;
      setResult({ results: r.results, summary: r.summary, kept });
      setStep("result");
    } catch (e) {
      fail(e, "Import impossible.");
    } finally {
      setBusy(false);
    }
  };

  const missing = preview?.columns.missing ?? [];
  const label = (k: string) => template?.columns.find((c) => c.key === k)?.label ?? k;
  const canImport = Boolean(preview && missing.length === 0 && preview.counts.ok > 0);

  return (
    <Modal
      size="xl"
      title="Importer des publications"
      subtitle={STEP_LABEL[step]}
      onClose={close}
      footer={
        step === "source" ? (
          <>
            <Button variant="ghost" icon={X} onClick={close}>Annuler</Button>
            <Button icon={busy ? Loader2 : ScanSearch} disabled={!ready || busy} onClick={analyse} className={busy ? "[&>svg]:animate-spin" : ""}>Analyser le tableur</Button>
          </>
        ) : step === "preview" ? (
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep("source")} disabled={busy}>Modifier</Button>
            <Button icon={busy ? Loader2 : Upload} disabled={!canImport || busy} onClick={importNow} className={busy ? "[&>svg]:animate-spin" : ""}>
              {busy ? "Import en cours…" : asDraft ? `Enregistrer ${preview?.counts.ok ?? 0} brouillon${(preview?.counts.ok ?? 0) > 1 ? "s" : ""}` : `Programmer ${preview?.counts.ok ?? 0} publication${(preview?.counts.ok ?? 0) > 1 ? "s" : ""}`}
            </Button>
          </>
        ) : (
          <Button icon={Check} onClick={close}>Terminer</Button>
        )
      }
    >
      {error && <Alert variant="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {step === "source" && (
        <div className="flex flex-col gap-5">
          <div>
            <Tabs
              items={[
                { id: "sheet" as Origin, label: "Google Sheets", icon: Sheet },
                { id: "csv" as Origin, label: "Fichier ou texte CSV", icon: FileUp },
              ]}
              value={origin}
              onChange={(o) => {
                setOrigin(o);
                setError(null);
              }}
            />
          </div>

          {origin === "sheet" ? (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2 rounded-2xl p-4 text-[13px]" style={{ background: theme.bg, color: theme.text }}>
                <Step n={1}>
                  Créez votre tableur avec les colonnes du modèle.{" "}
                  <button type="button" onClick={copyTemplate} disabled={!template} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>
                    <ClipboardCopy size={13} /> Copier le modèle pour Google Sheets
                  </button>
                  {" · "}
                  <button type="button" onClick={downloadTemplate} disabled={!template} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>
                    <Download size={13} /> Télécharger le CSV
                  </button>
                </Step>
                <Step n={2}>Cliquez sur <b>Partager</b>, puis « Accès général : <b>Toute personne disposant du lien</b> » (lecteur).</Step>
                <Step n={3}>Collez le lien du tableur ci-dessous.</Step>
              </ol>
              <div>
                <Label>Lien du tableur</Label>
                <div className="relative">
                  <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="field-in h-10 w-full rounded-xl pl-9 pr-3 text-[13px] outline-none"
                    style={{ border: 0 }}
                    inputMode="url"
                    autoFocus
                  />
                </div>
                <p className="mt-1.5 text-xs" style={{ color: theme.textMuted }}>
                  Un onglet précis : ouvrez-le avant de copier le lien. Un lien CSV public fonctionne aussi.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} />
                <Button variant="ghost" icon={FileUp} onClick={() => file.current?.click()}>Choisir un fichier</Button>
                <Button variant="ghost" icon={Download} onClick={downloadTemplate} disabled={!template}>Télécharger le modèle CSV</Button>
                {fileName && <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: theme.green }}><CheckCircle2 size={14} /> {fileName}</span>}
              </div>
              <div>
                <Label hint="Exportez votre tableur en CSV, ou copiez ses cellules et collez-les ici.">Contenu du tableur</Label>
                <textarea
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    setFileName(null);
                  }}
                  rows={6}
                  placeholder={"Date;Heure;Texte;Compte;Lien du média\n20/11/2026;09:00;Nouvelle collection !;Ma Page;https://…/photo.jpg"}
                  className="field-in w-full rounded-xl px-3 py-2.5 font-mono text-[12px] outline-none"
                  style={{ border: 0 }}
                  maxLength={MAX_CSV}
                />
              </div>
            </div>
          )}

          {/* Colonnes attendues */}
          <details className="group rounded-2xl" style={{ border: `1px solid var(--line)` }}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold" style={{ color: theme.text }}>
              <FileSpreadsheet size={15} style={{ color: theme.goldDark }} /> Colonnes du tableur
              <span className="ml-auto text-xs font-normal" style={{ color: theme.textMuted }}>Date et Texte obligatoires</span>
            </summary>
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <tbody>
                  {(template?.columns ?? []).map((c) => (
                    <tr key={c.key} className="align-top">
                      <th className="whitespace-nowrap py-1.5 pr-3 font-semibold" style={{ color: theme.text }}>
                        {c.label}
                        {c.required && <span className="ml-1" style={{ color: theme.red }} title="Obligatoire">*</span>}
                      </th>
                      <td className="py-1.5" style={{ color: theme.textMuted }}>{c.hint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: theme.textMuted }}>
                <Info size={13} className="mt-px flex-shrink-0" /> Les noms de colonnes peuvent varier (« Légende » pour Texte, « Image » pour Lien du média…) ; l'ordre est libre. Les médias sont téléchargés depuis leur lien et conservés sur SuiteFlow.
              </p>
            </div>
          </details>

          <div>
            <Label hint="Utilisés pour les lignes dont la colonne Compte est vide.">Publier sur</Label>
            {accounts === null ? (
              <div className="h-9 animate-pulse rounded-xl" style={{ background: theme.bg }} />
            ) : accounts.length === 0 ? (
              <p className="text-sm" style={{ color: theme.textMuted }}>Aucun compte associé : ajoutez-en depuis « Comptes associés ».</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const on = accountIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccount(a.id)}
                      aria-pressed={on}
                      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium"
                      style={{ background: on ? theme.goldSoft : theme.bg, border: `1px solid ${on ? theme.gold : theme.border}`, color: theme.text }}
                    >
                      <AccountAvatar name={a.accountName} src={a.accountAvatar} platform={a.platform} size={24} />
                      <span className="max-w-[150px] truncate">{a.accountName}</span>
                      {on && <Check size={13} style={{ color: theme.goldDark }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3" style={{ background: theme.bg }}>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Tout enregistrer en brouillons</p>
              <p className="text-xs" style={{ color: theme.textMuted }}>Rien ne part sans votre validation ; les dates passées sont acceptées. Vous programmez ensuite depuis l'onglet Brouillons.</p>
            </div>
            <Toggle checked={asDraft} onChange={setAsDraft} label="Brouillons" />
          </label>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          {missing.length > 0 ? (
            <Alert variant="error">
              Colonne{missing.length > 1 ? "s" : ""} obligatoire{missing.length > 1 ? "s" : ""} introuvable{missing.length > 1 ? "s" : ""} : <b>{missing.map(label).join(", ")}</b>. Ajoutez-la en première ligne du tableur, ou copiez le modèle.
            </Alert>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Count n={preview.counts.ok} label="prête" plural="prêtes" color={theme.green} bg={theme.greenSoft} icon={CheckCircle2} />
              <Count n={preview.counts.error} label="en erreur" plural="en erreur" color={theme.red} bg={theme.dangerBg} icon={AlertTriangle} />
              <Count n={preview.counts.ignored} label="ignorée" plural="ignorées" color={theme.textMuted} bg={theme.bg} icon={Info} />
              {preview.columns.unknown.length > 0 && (
                <span className="text-xs" style={{ color: theme.textMuted }}>Colonnes ignorées : {preview.columns.unknown.join(", ")}</span>
              )}
            </div>
          )}
          {preview.truncated && <Alert variant="warning">Seules les {preview.limit} premières lignes sont lues. Importez le reste dans un second temps.</Alert>}

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--line)" }}>
              <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr style={{ background: theme.bg, color: theme.textMuted }}>
                    <th className="px-3 py-2 font-semibold">Ligne</th>
                    <th className="px-3 py-2 font-semibold">Quand</th>
                    <th className="px-3 py-2 font-semibold">Sur</th>
                    <th className="px-3 py-2 font-semibold">Texte</th>
                    <th className="px-3 py-2 font-semibold">État</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <PreviewRow key={r.line} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {origin === "sheet" && missing.length === 0 && (
            <div className="rounded-2xl p-4" style={{ background: theme.goldSoft }}>
              <label className="flex cursor-pointer items-center gap-3">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl" style={{ background: theme.bgCard, color: theme.goldDark }}>
                  <RefreshCw size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold" style={{ color: theme.text }}>Garder ce tableur et importer automatiquement</span>
                  <span className="block text-xs" style={{ color: theme.textMuted }}>
                    SuiteFlow relit le tableur : chaque nouvelle ligne devient une publication programmée toute seule. Une ligne déjà importée ne l'est jamais deux fois.
                  </span>
                </span>
                <Toggle checked={keep} onChange={setKeep} label="Importer automatiquement" />
              </label>
              {keep && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Nom de la source"
                    maxLength={80}
                    className="field-in h-9 rounded-xl px-3 text-[13px] outline-none"
                    style={{ border: 0 }}
                    aria-label="Nom de la source"
                  />
                  <Select value={String(interval)} onChange={(e) => setInterval(Number(e.target.value))} className="h-9 text-[13px]">
                    {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-4">
          <Alert variant={result.summary.created > 0 ? "success" : "warning"}>
            {result.summary.created > 0
              ? `${result.summary.created} publication${result.summary.created > 1 ? "s" : ""} ${asDraft ? "enregistrée" : "programmée"}${result.summary.created > 1 ? "s" : ""}.`
              : "Aucune publication créée."}
            {result.summary.duplicates > 0 && ` ${result.summary.duplicates} déjà importée${result.summary.duplicates > 1 ? "s" : ""}.`}
            {result.kept && " Le tableur est gardé : les nouvelles lignes seront importées automatiquement (onglet Imports)."}
          </Alert>
          {result.results.filter((r) => r.state === "error").length > 0 && (
            <div>
              <Label>À corriger dans le tableur</Label>
              <ul className="flex flex-col gap-1.5">
                {result.results.filter((r) => r.state === "error").map((r) => (
                  <li key={r.line} className="flex items-start gap-2 rounded-xl px-3 py-2 text-[12.5px]" style={{ background: theme.dangerBg, color: theme.red }}>
                    <AlertTriangle size={14} className="mt-px flex-shrink-0" />
                    <span><b>Ligne {r.line}</b> : {r.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs" style={{ color: theme.textMuted }}>Corrigez ces lignes dans le tableur puis relancez l'import : seules les lignes non importées seront créées.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{n}</span>
      <span className="min-w-0 leading-relaxed">{children}</span>
    </li>
  );
}

function Count({ n, label, plural, color, bg, icon: Icon }: { n: number; label: string; plural: string; color: string; bg: string; icon: typeof Info }) {
  if (n === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold" style={{ background: bg, color }}>
      <Icon size={14} /> {n} {n > 1 ? plural : label}
    </span>
  );
}

const STATE: Record<ImportRow["state"], { label: string; color: string; bg: string }> = {
  ok: { label: "Prête", color: theme.green, bg: theme.greenSoft },
  error: { label: "Erreur", color: theme.red, bg: theme.dangerBg },
  past: { label: "Date passée", color: theme.amber, bg: theme.amberSoft },
  skipped: { label: "Ignorée", color: theme.textMuted, bg: theme.bg },
};

function PreviewRow({ row }: { row: ImportRow }) {
  const s = STATE[row.state];
  const notes = useMemo(() => [...row.errors, ...row.warnings], [row]);
  return (
    <tr className="align-top" style={{ borderTop: "1px solid var(--line)" }}>
      <td className="px-3 py-2 tabular-nums" style={{ color: theme.textMuted }}>{row.line}</td>
      <td className="whitespace-nowrap px-3 py-2" style={{ color: theme.text }}>
        {row.scheduledAt ? formatSlot(row.scheduledAt) : "—"}
        {row.draft && <span className="ml-1.5 rounded px-1 text-[10.5px] font-semibold" style={{ background: theme.bg, color: theme.textMuted }}>brouillon</span>}
      </td>
      <td className="px-3 py-2" style={{ color: theme.text }}>{row.accountNames.length ? row.accountNames.join(", ") : "—"}</td>
      <td className="max-w-[260px] px-3 py-2" style={{ color: theme.text }}>
        <p className="line-clamp-2 break-words">{row.text || <em style={{ color: theme.textMuted }}>vide</em>}</p>
        {row.mediaUrl && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: theme.textMuted }}>
            <ImageIcon size={11} /> média à télécharger
          </p>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: s.bg, color: s.color }}>
          {row.state === "ok" && <Sparkles size={11} />}
          {s.label}
        </span>
        {notes.map((n) => (
          <p key={n} className="mt-1 text-[11.5px] leading-snug" style={{ color: row.errors.includes(n) ? theme.red : theme.textMuted }}>{n}</p>
        ))}
      </td>
    </tr>
  );
}
