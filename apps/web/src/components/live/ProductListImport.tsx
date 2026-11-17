import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCopy, FileUp, Info, Link2, Loader2, Sheet, Upload, X } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api";
import { swal } from "@/lib/swal";
import type { LiveProduct } from "@/lib/live.api";
import { liveListApi, type FieldInfo, type FieldKey, type ListPreview, type ListRead, type Mapping, type ProductList, type Source } from "@/lib/liveList.api";
import { fileToCsvText } from "./live";

interface Props {
  initialOrigin?: "sheet" | "file"; // méthode choisie avant l'ouverture (boutons « Google Sheets » / « Excel ou CSV »)
  existingNames?: string[]; // listes déjà enregistrées : le nom proposé ne les répète pas
  onClose: () => void;
  // Articles prêts à joindre ; `list` quand la liste a été enregistrée pour être réutilisée
  onDone: (items: LiveProduct[], list: ProductList | null, name: string) => void;
  suggestedName?: string;
}

type Origin = "sheet" | "file";
type Step = "source" | "columns" | "preview";

const MAX_CSV = 90_000;
const TEMPLATE_TSV = "Code\tArticle\tPrix\tStock\nA1\tRobe fleurie\t25000\t3\nA2\tSac en raphia\t15000\t\nA3\tChapeau\t12000\t10";
const STEPS: Array<[Step, string]> = [["source", "Tableur"], ["columns", "Colonnes"], ["preview", "Vérification"]];
// Nom proposé à chaque import : le fichier, sinon « Liste du 18 nov. » ; « (2) » si ce nom existe déjà. Toujours modifiable.
export function defaultListName(fileName: string | null, existing: string[]): string {
  const base = fileName ? fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() : `Liste du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  let name = base || "Liste d'articles";
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} (${i})`;
  return name.slice(0, 80);
}
const money = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("fr-FR")} Ar`);

// Colonnes du tableur ↔ champs de l'article, choisies par l'utilisateur ; les propositions viennent des en-têtes reconnus
export function MappingFields({ fields, headers, mapping, onChange }: { fields: FieldInfo[]; headers: string[]; mapping: Mapping; onChange: (m: Mapping) => void }) {
  const used = (key: FieldKey, h: string) => (Object.entries(mapping) as [FieldKey, string | null][]).some(([k, v]) => k !== key && v === h);
  return (
    <div className="flex flex-col gap-2.5">
      {fields.map((f) => (
        <div key={f.key} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[170px_1fr]">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: theme.text }}>
              {f.label} {f.required ? <span className="font-normal" style={{ color: theme.red }} title="Obligatoire">*</span> : <span className="text-[11px] font-normal" style={{ color: theme.textMuted }}>facultatif</span>}
            </p>
          </div>
          <div className="min-w-0">
            <Select
              value={mapping[f.key] ?? ""}
              onChange={(e) => onChange({ ...mapping, [f.key]: e.target.value || null })}
              className="field-in h-9 w-full rounded-xl px-3 text-[13px] font-medium"
              style={{ border: 0 }}
              aria-label={`Colonne pour ${f.label}`}
            >
              <option value="">{f.required ? "— Choisir une colonne —" : "— Aucune colonne —"}</option>
              {headers.filter((h) => h.trim()).map((h) => (
                <option key={h} value={h} disabled={used(f.key, h)}>{h}{used(f.key, h) ? " (déjà utilisée)" : ""}</option>
              ))}
            </Select>
            <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>{f.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductListImport({ onClose, onDone, suggestedName, existingNames = [], initialOrigin = "sheet" }: Props) {
  const [step, setStep] = useState<Step>("source");
  const [origin, setOrigin] = useState<Origin>(initialOrigin);
  const [url, setUrl] = useState("");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [read, setRead] = useState<ListRead | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ code: null, name: null, price: null, stock: null });
  const [preview, setPreview] = useState<ListPreview | null>(null);
  const [name, setName] = useState(suggestedName ?? "");
  const [nameTouched, setNameTouched] = useState(Boolean(suggestedName));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const source: Source = origin === "sheet" ? { url: url.trim() } : { csv };
  const ready = origin === "sheet" ? /^https?:\/\/\S+$/i.test(url.trim()) : csv.trim().length > 0;
  const fail = (e: unknown, fallback: string) => setError(e instanceof ApiError ? e.message : fallback);
  const chosenOk = read ? read.fields.filter((f) => f.required).every((f) => mapping[f.key]) : false;

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const text = await fileToCsvText(f);
      if (text.length > MAX_CSV) return setError(`Fichier trop long (${MAX_CSV.toLocaleString("fr-FR")} caractères maximum) : gardez les colonnes utiles ou utilisez un lien Google Sheets.`);
      setCsv(text);
      setFileName(f.name);
    } catch {
      setError("Fichier illisible. Formats acceptés : .csv, .txt, .xlsx.");
    }
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE_TSV);
      swal.toast({ title: "Modèle copié : collez-le dans la cellule A1 de Google Sheets" });
    } catch {
      swal.toast({ variant: "error", title: "Copie impossible" });
    }
  };

  const doRead = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await liveListApi.read(source);
      setRead(r);
      setMapping(r.suggested);
      setStep("columns");
    } catch (e) {
      fail(e, "Lecture impossible : vérifiez le lien ou le fichier.");
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await liveListApi.preview(source, mapping));
      if (!nameTouched) setName(defaultListName(origin === "file" ? fileName : null, existingNames));
      setStep("preview");
    } catch (e) {
      fail(e, "Vérification impossible.");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      // Toute liste importée est enregistrée : elle reste disponible (joindre, renommer, modifier, supprimer) pour les prochains lives
      const { list } = await liveListApi.create({ name: name.trim() || "Liste d'articles", source, mapping });
      onDone(preview.items, list, list.name);
    } catch (e) {
      fail(e, "Enregistrement impossible.");
      setBusy(false);
    }
  };

  const idx = STEPS.findIndex(([s]) => s === step);
  const errors = preview?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = preview?.issues.filter((i) => i.level === "warning") ?? [];
  const mappedFor = (h: string) => read?.fields.find((f) => mapping[f.key] === h);

  return (
    <Modal
      size="xl"
      title="Importer une liste d'articles"
      subtitle={
        <span className="flex items-center gap-2">
          {STEPS.map(([s, label], i) => (
            <span key={s} className="flex items-center gap-1" style={{ color: i === idx ? theme.goldDark : theme.textMuted, fontWeight: i === idx ? 600 : 400 }}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]" style={{ background: i <= idx ? theme.gold : theme.border, color: theme.onAccent }}>
                {i < idx ? <Check size={9} /> : i + 1}
              </span>
              {label}
            </span>
          ))}
        </span>
      }
      onClose={onClose}
      footer={
        step === "source" ? (
          <>
            <Button variant="ghost" icon={X} onClick={onClose}>Annuler</Button>
            <Button icon={busy ? Loader2 : ArrowRight} disabled={!ready || busy} onClick={doRead} className={busy ? "[&>svg]:animate-spin" : ""}>Lire le tableur</Button>
          </>
        ) : step === "columns" ? (
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep("source")} disabled={busy}>Retour</Button>
            <Button icon={busy ? Loader2 : ArrowRight} disabled={!chosenOk || busy} onClick={doPreview} className={busy ? "[&>svg]:animate-spin" : ""}>Vérifier les articles</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep("columns")} disabled={busy}>Colonnes</Button>
            <Button icon={busy ? Loader2 : Upload} disabled={busy || !preview || preview.count === 0 || !name.trim()} onClick={doImport} className={busy ? "[&>svg]:animate-spin" : ""}>
              Enregistrer et utiliser {preview?.count ?? 0} article{(preview?.count ?? 0) > 1 ? "s" : ""}
            </Button>
          </>
        )
      }
    >
      {error && <Alert variant="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {step === "source" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Méthode d'import">
            {(
              [
                { id: "sheet", icon: Sheet, title: "Google Sheets", text: "Collez le lien du tableur. Il est relu avant chaque live : prix et stocks toujours à jour.", tag: "Recommandé" },
                { id: "file", icon: FileUp, title: "Fichier Excel ou CSV", text: "Importez un fichier .xlsx ou .csv de votre ordinateur, ou collez des cellules copiées.", tag: null },
              ] as const
            ).map((m) => {
              const on = origin === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setOrigin(m.id);
                    setError(null);
                  }}
                  className="relative flex items-start gap-3 rounded-2xl p-4 text-left transition-colors"
                  style={{ background: on ? theme.goldSoft : theme.bgCard, border: `1.5px solid ${on ? theme.gold : theme.border}` }}
                >
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl" style={{ background: on ? theme.gold : theme.bg, color: on ? theme.onAccent : theme.textMuted }}>
                    <m.icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-bold" style={{ color: theme.text }}>
                      {m.title}
                      {m.tag && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: theme.greenSoft, color: theme.green }}>{m.tag}</span>}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{m.text}</span>
                  </span>
                  {on && <Check size={16} className="flex-shrink-0" style={{ color: theme.goldDark }} />}
                </button>
              );
            })}
          </div>
          {origin === "sheet" ? (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2 rounded-2xl p-4 text-[13px]" style={{ background: theme.bg, color: theme.text }}>
                <li className="flex items-start gap-2.5"><Num n={1} /><span>Une ligne par article, avec des <b>noms de colonnes en première ligne</b> (vous les associerez à l'étape suivante, les noms sont libres). <button type="button" onClick={copyTemplate} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}><ClipboardCopy size={13} /> Copier un exemple pour Google Sheets</button></span></li>
                <li className="flex items-start gap-2.5"><Num n={2} /><span>Cliquez sur <b>Partager</b>, puis « Accès général : <b>Toute personne disposant du lien</b> » (lecteur).</span></li>
                <li className="flex items-start gap-2.5"><Num n={3} /><span>Collez le lien ci-dessous (ouvrez d'abord l'onglet voulu).</span></li>
              </ol>
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
                  aria-label="Lien du tableur"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={file} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/plain" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
                <Button variant="ghost" icon={FileUp} onClick={() => file.current?.click()}>Choisir un fichier</Button>
                {fileName && <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: theme.green }}><CheckCircle2 size={14} /> {fileName}</span>}
              </div>
              <textarea
                value={csv}
                onChange={(e) => {
                  setCsv(e.target.value);
                  setFileName(null);
                }}
                rows={6}
                maxLength={MAX_CSV}
                placeholder={"Code;Article;Prix;Stock\nA1;Robe fleurie;25000;3"}
                className="field-in w-full rounded-xl px-3 py-2.5 font-mono text-[12px] outline-none"
                style={{ border: 0 }}
                aria-label="Contenu du tableur"
              />
              <p className="text-xs" style={{ color: theme.textMuted }}>Ou copiez des cellules depuis Excel / Google Sheets et collez-les ici (la première ligne = noms des colonnes).</p>
            </div>
          )}
        </div>
      )}

      {step === "columns" && read && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px]" style={{ color: theme.textMuted }}>
            {read.rowCount} ligne{read.rowCount > 1 ? "s" : ""} lue{read.rowCount > 1 ? "s" : ""}. Indiquez quelle colonne de votre tableur correspond à chaque information de l'article : ce choix est gardé pour les prochaines fois.
          </p>
          <MappingFields fields={read.fields} headers={read.headers} mapping={mapping} onChange={setMapping} />

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Aperçu de votre tableur</p>
            <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--line)" }}>
              <table className="w-full min-w-[480px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr style={{ background: theme.bg }}>
                    {read.headers.map((h, i) => {
                      const f = mappedFor(h);
                      return (
                        <th key={`${h}-${i}`} className="px-3 py-2 align-bottom font-semibold" style={{ color: f ? theme.goldDark : theme.textMuted, background: f ? theme.goldSoft : undefined }}>
                          {h || <em>sans nom</em>}
                          {f && <span className="mt-0.5 block text-[10.5px] font-bold uppercase tracking-wide">→ {f.label}</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {read.sample.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      {read.headers.map((h, c) => (
                        <td key={c} className="max-w-[200px] truncate px-3 py-1.5" style={{ color: theme.text, background: mappedFor(h) ? `${theme.goldSoft}80` : undefined }}>{r[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: theme.greenSoft, color: theme.green }}><CheckCircle2 size={14} /> {preview.count} article{preview.count > 1 ? "s" : ""}</span>
            {errors.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: theme.dangerBg, color: theme.red }}><AlertTriangle size={14} /> {errors.length} ligne{errors.length > 1 ? "s" : ""} ignorée{errors.length > 1 ? "s" : ""}</span>}
            {warnings.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: theme.amberSoft, color: theme.amber }}><Info size={14} /> {warnings.length} remarque{warnings.length > 1 ? "s" : ""}</span>}
          </div>

          {preview.issues.length > 0 && (
            <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-2xl p-3 text-[12.5px]" style={{ background: theme.bg }}>
              {preview.issues.map((i, k) => (
                <li key={k} className="flex items-start gap-2" style={{ color: i.level === "error" ? theme.red : theme.amber }}>
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> <span><b>Ligne {i.line}</b> : {i.message}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="max-h-64 overflow-auto rounded-2xl" style={{ border: "1px solid var(--line)" }}>
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead className="sticky top-0" style={{ background: theme.bg, color: theme.textMuted }}>
                <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Article</th><th className="px-3 py-2">Prix</th><th className="px-3 py-2">Stock</th></tr>
              </thead>
              <tbody>
                {preview.items.map((it) => (
                  <tr key={it.code} style={{ borderTop: "1px solid var(--line)", color: theme.text }}>
                    <td className="px-3 py-1.5 font-semibold">{it.code}</td>
                    <td className="px-3 py-1.5">{it.name}</td>
                    <td className="px-3 py-1.5 tabular-nums">{money(it.price)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{it.stock === null ? "∞" : it.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Nom de cette liste</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              placeholder="Ex. Collection novembre, Déstockage, Live du samedi…"
              maxLength={80}
              className="field-in h-10 w-full rounded-xl px-3 text-[13px] font-medium outline-none"
              style={{ border: 0 }}
              aria-label="Nom de la liste"
            />
            <span className="mt-1 block text-xs" style={{ color: theme.textMuted }}>Chaque import a son nom : vous pouvez joindre plusieurs listes différentes à un même live.</span>
          </label>

          <p className="flex items-start gap-2 rounded-2xl p-3.5 text-[12.5px]" style={{ background: theme.goldSoft, color: theme.text }}>
            <Info size={15} className="mt-0.5 flex-shrink-0" style={{ color: theme.goldDark }} />
            <span>
              Cette liste est <b>enregistrée</b> sous ce nom dans « Ventes en live › Listes d'articles » : vous pourrez la joindre à n'importe quel live, la renommer, corriger ses colonnes ou la supprimer.
              {origin === "sheet" ? " Le tableur est relu avant chaque utilisation pour avoir les prix et stocks du jour." : ""}
            </span>
          </p>
        </div>
      )}
    </Modal>
  );
}

function Num({ n }: { n: number }) {
  return <span className="mt-px grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{n}</span>;
}

