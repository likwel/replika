import { useRef, useState } from "react";
import { FileUp, Link2, Loader2, Table2, Upload, X } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { ApiError } from "@/lib/api";
import { aiApi } from "@/lib/ai.api";
import { csvToKnowledge, fileToKnowledge, type ImportedText } from "@/lib/knowledgeImport";

interface Props {
  title: string; // « Importer des informations », « Importer des consignes »
  current: string; // texte déjà présent dans le champ
  maxLength: number;
  onApply: (value: string) => void;
  onClose: () => void;
}

// Importe du texte depuis un fichier (.txt, .csv, .xlsx) ou un Google Sheet, le montre pour relecture,
// puis l'ajoute au champ ou le remplace. Rien n'est enregistré avant « Enregistrer » dans la page.
export function KnowledgeImportModal({ title, current, maxLength, onApply, onClose }: Props) {
  const [source, setSource] = useState<"file" | "sheet">("file");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ImportedText & { name: string }) | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"append" | "replace">(current.trim() ? "append" : "replace");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const accept = (r: ImportedText, name: string) => {
    setResult({ ...r, name });
    setText(r.text);
    if (!r.text.trim()) setError("Aucun texte trouvé dans cette source.");
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      accept(await fileToKnowledge(file), file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const readSheet = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { csv } = await aiApi.importSheet(url.trim());
      accept(csvToKnowledge(csv), "Google Sheet");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lecture impossible.");
    } finally {
      setBusy(false);
    }
  };

  const base = mode === "append" && current.trim() ? `${current.trim()}\n\n` : "";
  const merged = `${base}${text.trim()}`;
  const tooLong = merged.length > maxLength;

  return (
    <Modal
      title={title}
      subtitle="Depuis un fichier ou un Google Sheet : relisez le texte avant de l'insérer."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" icon={X} onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            icon={Upload}
            disabled={!text.trim() || tooLong}
            onClick={() => {
              onApply(merged);
              onClose();
            }}
          >
            Insérer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          value={source}
          onChange={(v) => {
            setSource(v);
            setError(null);
          }}
          options={[
            { value: "file", label: "Fichier", icon: FileUp },
            { value: "sheet", label: "Google Sheets", icon: Table2 },
          ]}
        />

        {source === "file" ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void readFile(e.dataTransfer.files[0]);
            }}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors"
            style={{ borderColor: over ? theme.gold : "var(--line-2)", background: over ? theme.goldSoft : "var(--surface-2)" }}
          >
            {busy ? <Loader2 size={22} className="animate-spin" style={{ color: theme.goldDark }} /> : <FileUp size={22} style={{ color: theme.goldDark }} />}
            <span className="text-[13.5px] font-semibold" style={{ color: theme.text }}>Choisissez un fichier ou déposez-le ici</span>
            <span className="text-[12px]" style={{ color: theme.textMuted }}>.txt, .csv ou .xlsx · 2 Mo maximum</span>
            <input ref={input} type="file" accept=".txt,.md,.csv,.xlsx,.xls" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="field-in flex min-w-[14rem] flex-1 items-center gap-2 rounded-xl px-3 py-2">
                <Link2 size={15} style={{ color: theme.textMuted }} className="flex-shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void readSheet()}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  aria-label="Lien du Google Sheet"
                  className="w-full bg-transparent text-[13px] outline-none"
                  style={{ color: theme.text }}
                />
              </label>
              <Button size="sm" icon={busy ? Loader2 : Table2} disabled={busy || !url.trim()} className={busy ? "[&>svg]:animate-spin" : ""} onClick={() => void readSheet()}>Lire</Button>
            </div>
            <p className="text-[12px] leading-snug" style={{ color: theme.textMuted }}>
              Dans Google Sheets : Partager, puis « Accès général : Toute personne disposant du lien » (lecteur). La première feuille est lue, la première ligne sert d'en-têtes.
            </p>
          </div>
        )}

        {error && <p className="rounded-xl px-3 py-2 text-[13px]" style={{ background: theme.dangerBg, color: theme.red }}>{error}</p>}

        {result && result.text.trim() && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: theme.textMuted }}>
              <span className="font-semibold" style={{ color: theme.text }}>{result.name}</span>
              <span>· {result.rows} ligne{result.rows > 1 ? "s" : ""} lue{result.rows > 1 ? "s" : ""}</span>
              {result.cut && <span className="chip warn !text-[10.5px]">Seules les 400 premières lignes sont gardées</span>}
            </div>
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Texte à insérer"
              className="field-in w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none"
            />
            {current.trim() && (
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "append", label: "Ajouter à la suite" },
                  { value: "replace", label: "Remplacer le texte actuel" },
                ]}
              />
            )}
            <p className="text-[12px] font-medium" style={{ color: tooLong ? theme.red : theme.textMuted }}>
              {merged.length} / {maxLength} caractères{tooLong ? " : trop long, raccourcissez le texte ci-dessus ou choisissez « Remplacer »." : ""}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
