import { useEffect, useRef, useState } from "react";
import { Check, ClipboardPaste, Columns3, FileSpreadsheet, FileUp, Link2, Loader2, Pencil, Plus, Sheet, Trash2, Download } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { mergeProductRows, parseImportFile, toRows, type ProductRow } from "./live";
import { ProductListImport } from "./ProductListImport";
import { deleteListWithConfirm, ListEditor, RenameModal } from "./ProductLists";
import { liveListApi, type ProductList } from "@/lib/liveList.api";
import { ApiError } from "@/lib/api";

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
  const [lists, setLists] = useState<ProductList[] | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState<"sheet" | "file" | null>(null);
  const [renaming, setRenaming] = useState<ProductList | null>(null);
  const [editing, setEditing] = useState<ProductList | null>(null);
  const reloadLists = () => liveListApi.list().then(setLists).catch(() => undefined);
  const removeList = async (l: ProductList) => {
    if (await deleteListWithConfirm(l)) {
      setLists((x) => (x ?? []).filter((i) => i.id !== l.id));
      setJoined((j) => j.filter((x) => x.id !== l.id));
    }
  };
  // Listes jointes pendant cette édition (un live peut en réunir plusieurs) : rappel des noms, et coche sur les listes déjà jointes
  const [joined, setJoined] = useState<Array<{ id: string | null; name: string; count: number }>>([]);
  const remember = (id: string | null, name: string, count: number) => setJoined((j) => [...j.filter((x) => (id ? x.id !== id : x.name !== name)), { id, name, count }]);

  useEffect(() => {
    liveListApi.list().then(setLists).catch(() => setLists([]));
  }, []);

  // Joindre une liste enregistrée : relue d'abord si elle vient d'un lien (prix et stocks du jour), puis fusionnée dans le catalogue
  const join = async (l: ProductList) => {
    setJoining(l.id);
    setImportMsg(null);
    try {
      const r = await liveListApi.items(l.id, true);
      onChange(mergeProductRows(rows, toRows(r.items)));
      remember(l.id, l.name, r.items.length);
      setImportMsg({ text: `${r.items.length} article${r.items.length > 1 ? "s" : ""} joint${r.items.length > 1 ? "s" : ""} depuis « ${l.name} »${r.refreshed ? " (tableur relu)" : ""}.${r.warning ? ` ${r.warning}` : ""}`, error: Boolean(r.warning) });
    } catch (e) {
      setImportMsg({ text: e instanceof ApiError ? e.message : "Liste illisible.", error: true });
    } finally {
      setJoining(null);
    }
  };
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
      {/* Listes préparées avant le live : un clic pour les joindre ; chaque liste importée est enregistrée et reste modifiable */}
      <section className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${theme.border}`, background: theme.bgCard }}>
        <header className="flex items-start gap-3 px-4 py-3" style={{ background: theme.goldSoft }}>
          <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg" style={{ background: theme.bgCard, color: theme.goldDark }}>
            <FileSpreadsheet size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold" style={{ color: theme.text }}>Joindre une liste d'articles</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>Vous pouvez joindre plusieurs listes à un même live : les articles se fusionnent (un code déjà présent est remplacé).</p>
          </div>
        </header>

        <div className="flex flex-col gap-2 p-3">
          {lists === null ? (
            <div className="h-14 animate-pulse rounded-xl" style={{ background: theme.bg }} />
          ) : lists.length === 0 ? (
            <p className="rounded-xl px-3 py-3 text-center text-[13px]" style={{ background: theme.bg, color: theme.textMuted }}>
              Aucune liste enregistrée pour l'instant. Importez-en une ci-dessous : les colonnes sont à associer une seule fois.
            </p>
          ) : (
            lists.map((l) => {
              const isJoined = joined.some((j) => j.id === l.id);
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-2.5" style={{ background: isJoined ? theme.greenSoft : theme.bg, border: `1px solid ${isJoined ? theme.green : theme.border}` }}>
                  <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: theme.bgCard, color: l.sourceUrl ? theme.green : theme.goldDark }}>
                    {l.sourceUrl ? <Link2 size={16} /> : <FileSpreadsheet size={16} />}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{l.name}</p>
                    <p className="text-[11.5px]" style={{ color: l.lastStatus === "ERROR" ? theme.red : theme.textMuted }}>
                      {l.itemCount} article{l.itemCount > 1 ? "s" : ""} · {l.sourceUrl ? "Google Sheets, relu à la jointure" : "fichier importé"}{l.lastStatus === "ERROR" ? " · dernière lecture en échec" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant={isJoined ? "ghost" : "primary"} icon={joining === l.id ? Loader2 : isJoined ? Check : Plus} onClick={() => void join(l)} disabled={joining !== null} className={joining === l.id ? "[&>svg]:animate-spin" : ""}>
                      {isJoined ? "Rejoindre" : "Joindre"}
                    </Button>
                    <button type="button" onClick={() => setRenaming(l)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5" aria-label={`Renommer ${l.name}`} title="Renommer"><Pencil size={14} style={{ color: theme.textMuted }} /></button>
                    <button type="button" onClick={() => setEditing(l)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5" aria-label={`Colonnes de ${l.name}`} title="Colonnes"><Columns3 size={14} style={{ color: theme.textMuted }} /></button>
                    <button type="button" onClick={() => void removeList(l)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5" aria-label={`Supprimer ${l.name}`} title="Supprimer"><Trash2 size={14} style={{ color: theme.red }} /></button>
                  </div>
                </div>
              );
            })
          )}
          {joined.length > 0 && (
            <p className="px-1 text-xs" style={{ color: theme.textMuted }}>
              Jointes à ce live : <b style={{ color: theme.text }}>{joined.map((j) => `${j.name} (${j.count})`).join(" · ")}</b>
            </p>
          )}
        </div>

        <div className="p-3 pt-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>Importer une nouvelle liste</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { id: "sheet", icon: Sheet, title: "Google Sheets", text: "Un lien, relu avant chaque live" },
              { id: "file", icon: FileUp, title: "Excel ou CSV", text: "Fichier .xlsx / .csv ou cellules collées" },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setImportOpen(m.id)}
                className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:brightness-[0.97]"
                style={{ background: theme.bg, border: `1px dashed ${theme.border}` }}
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: theme.goldSoft, color: theme.goldDark }}><m.icon size={17} /></span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{m.title}</span>
                  <span className="block text-[11.5px]" style={{ color: theme.textMuted }}>{m.text}</span>
                </span>
                <Plus size={16} className="ml-auto flex-shrink-0" style={{ color: theme.goldDark }} />
              </button>
            ))}
          </div>
        </div>
      </section>

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
      {renaming && <RenameModal list={renaming} taken={(lists ?? []).filter((l) => l.id !== renaming.id).map((l) => l.name)} onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); void reloadLists(); }} />}
      {editing && <ListEditor list={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reloadLists(); }} />}
      {importOpen && (
        <ProductListImport
          initialOrigin={importOpen}
          existingNames={[...(lists ?? []).map((l) => l.name), ...joined.map((j) => j.name)]}
          onClose={() => setImportOpen(null)}
          onDone={(items, list, name) => {
            setImportOpen(null);
            onChange(mergeProductRows(rows, toRows(items)));
            if (list) setLists((l) => [list, ...(l ?? [])]);
            remember(list?.id ?? null, name, items.length);
            setImportMsg({ text: `${items.length} article${items.length > 1 ? "s" : ""} importé${items.length > 1 ? "s" : ""} dans « ${name} »${list ? " · liste enregistrée" : ""}.` });
          }}
        />
      )}
      {paste !== null && (
        <div className="rounded-xl p-3" style={{ border: `1px solid ${theme.border}` }}>
          <p className="mb-1.5 text-xs" style={{ color: theme.textMuted }}>
            Une ligne par article : <strong>code ; nom ; prix ; stock</strong> — ou collez directement des colonnes Excel.
          </p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder={"A3;Robe fleurie;25000;2\n12;Sac raphia;15000"} className={cell} style={cellStyle} />
          <Button icon={Download} size="sm" className="mt-2" onClick={importPaste} disabled={!paste.trim()}>Importer</Button>
        </div>
      )}
    </div>
  );
}
