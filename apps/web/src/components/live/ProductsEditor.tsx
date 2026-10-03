import { useRef, useState } from "react";
import { ClipboardPaste, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { mergeProductRows, parseImportFile, type ProductRow } from "./live";

interface Props {
  rows: ProductRow[];
  onChange: (rows: ProductRow[]) => void;
}

const cell = "w-full rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const cellStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

// Catalogue du live : code annoncé à l'antenne, nom, prix, stock (facultatif)
export function ProductsEditor({ rows, onChange }: Props) {
  const [paste, setPaste] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (i: number, k: keyof ProductRow, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  // Colonnes copiées depuis Excel (tabulations) ou saisies « code ; nom ; prix ; stock »
  const importPaste = () => {
    const parsed = (paste ?? "")
      .split(/\r?\n/)
      .map((l) => l.split(/\t|;/).map((c) => c.trim()))
      .filter((c) => c[0] && c[1])
      .map(([code, name, price = "", stock = ""]) => ({ code, name, price, stock }));
    onChange(mergeProductRows(rows, parsed));
    setPaste(null);
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setImportMsg(null);
    try {
      const parsed = await parseImportFile(file);
      if (!parsed.length) {
        setImportMsg({ text: "Aucun article reconnu dans ce fichier. Colonnes attendues : code, article, prix, stock.", error: true });
        return;
      }
      onChange(mergeProductRows(rows, parsed));
      setImportMsg({ text: `${parsed.length} article${parsed.length > 1 ? "s" : ""} importé${parsed.length > 1 ? "s" : ""}.` });
    } catch {
      setImportMsg({ text: "Fichier illisible. Formats acceptés : .csv, .txt, .xlsx.", error: true });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[90px_1fr_110px_80px_32px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide sm:grid" style={{ color: theme.textMuted }}>
        <span>Code</span>
        <span>Article</span>
        <span>Prix (Ar)</span>
        <span>Stock</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[80px_1fr_32px] gap-2 sm:grid-cols-[90px_1fr_110px_80px_32px]">
          <input value={r.code} onChange={(e) => update(i, "code", e.target.value)} placeholder="A3" className={cell} style={cellStyle} aria-label="Code" />
          <input value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Robe fleurie" className={cell} style={cellStyle} aria-label="Article" />
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="row-span-2 flex items-center justify-center rounded-lg hover:bg-black/5 sm:row-span-1 sm:order-last" aria-label="Retirer">
            <Trash2 size={14} style={{ color: theme.textMuted }} />
          </button>
          <input value={r.price} onChange={(e) => update(i, "price", e.target.value)} placeholder="25000" inputMode="numeric" className={cell} style={cellStyle} aria-label="Prix" />
          <input value={r.stock} onChange={(e) => update(i, "stock", e.target.value)} placeholder="∞" inputMode="numeric" className={cell} style={cellStyle} aria-label="Stock" />
        </div>
      ))}
      {rows.length === 0 && (
        <p className="rounded-xl px-3 py-4 text-center text-sm" style={{ background: theme.bg, color: theme.textMuted }}>
          Sans catalogue, le code tapé après « jp » est repris tel quel (ex. « jp 12 » → article 12).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="soft" icon={Plus} onClick={() => onChange([...rows, { code: "", name: "", price: "", stock: "" }])}>Ajouter un article</Button>
        <Button size="sm" variant="ghost" icon={ClipboardPaste} onClick={() => setPaste(paste === null ? "" : null)}>Coller une liste</Button>
        <Button
          size="sm"
          variant="ghost"
          icon={importing ? Loader2 : FileUp}
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          className={importing ? "[&>svg]:animate-spin" : ""}
        >
          Importer un fichier
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // permet de réimporter le même fichier
            if (file) importFile(file);
          }}
        />
      </div>
      {importMsg && (
        <p className="text-xs" style={{ color: importMsg.error ? theme.red : theme.goldDark }}>{importMsg.text}</p>
      )}
      <p className="text-[11px]" style={{ color: theme.textMuted }}>
        CSV, TXT ou Excel (.xlsx) — colonnes : code, article, prix, stock. Les codes déjà présents sont remplacés.
      </p>
      {paste !== null && (
        <div className="rounded-xl p-3" style={{ border: `1px solid ${theme.border}` }}>
          <p className="mb-1.5 text-xs" style={{ color: theme.textMuted }}>
            Une ligne par article : <strong>code ; nom ; prix ; stock</strong> — ou collez directement des colonnes Excel.
          </p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder={"A3;Robe fleurie;25000;2\n12;Sac raphia;15000"} className={cell} style={cellStyle} />
          <Button size="sm" className="mt-2" onClick={importPaste} disabled={!paste.trim()}>Importer</Button>
        </div>
      )}
    </div>
  );
}
