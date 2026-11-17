import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Columns3, ExternalLink, FileSpreadsheet, FileUp, Loader2, Pencil, RefreshCw, Save, Search, Sheet, Trash2, X } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { EmptyState, ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { ApiError } from "@/lib/api";
import { swal } from "@/lib/swal";
import type { LiveProduct } from "@/lib/live.api";
import { liveListApi, type Mapping, type ProductList } from "@/lib/liveList.api";
import { MappingFields, ProductListImport } from "./ProductListImport";

const FIELDS = [
  { key: "code", label: "Code", required: true, hint: "Le code annoncé à l'antenne (ex. A3) : le client écrit « jp A3 »." },
  { key: "name", label: "Article", required: true, hint: "Le nom repris dans les messages envoyés au client." },
  { key: "price", label: "Prix (Ar)", required: false, hint: "Prix en ariary : 25000, 25 000 ou « 25 000 Ar »." },
  { key: "stock", label: "Stock", required: false, hint: "Quantité disponible ; vide ou « ∞ » : illimité." },
] as const;

const ago = (iso: string | null) => {
  if (!iso) return "jamais";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
};

// Supprimer une liste, avec confirmation (les lives déjà démarrés gardent leurs articles)
export async function deleteListWithConfirm(l: ProductList): Promise<boolean> {
  if (!(await swal.confirm({ title: `Supprimer « ${l.name} » ?`, text: "Les lives déjà démarrés gardent leurs articles. La liste ne pourra plus être jointe.", confirmText: "Supprimer", variant: "warning" }))) return false;
  try {
    await liveListApi.remove(l.id);
    return true;
  } catch (e) {
    swal.toast({ variant: "error", title: "Suppression impossible", text: e instanceof ApiError ? e.message : undefined });
    return false;
  }
}

const money = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("fr-FR")} Ar`);

// Aperçu des articles d'une liste (chargé à l'ouverture de la carte)
function Preview({ id }: { id: string }) {
  const [items, setItems] = useState<LiveProduct[] | null>(null);
  useEffect(() => {
    liveListApi.items(id, false).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [id]);
  if (items === null) return <div className="h-24 animate-pulse rounded-xl" style={{ background: theme.bg }} />;
  return (
    <div className="max-h-60 overflow-auto rounded-xl" style={{ border: "1px solid var(--line)" }}>
      <table className="w-full border-collapse text-left text-[12.5px]">
        <thead className="sticky top-0" style={{ background: theme.bg, color: theme.textMuted }}>
          <tr><th className="px-3 py-1.5">Code</th><th className="px-3 py-1.5">Article</th><th className="px-3 py-1.5">Prix</th><th className="px-3 py-1.5">Stock</th></tr>
        </thead>
        <tbody>
          {items.map((it) => (
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
  );
}

// Onglet « Listes d'articles » : préparer ses articles avant le live (Google Sheets, Excel, CSV), les mettre en
// correspondance une fois, puis les joindre en un clic au démarrage d'une session.
// Toute liste importée est enregistrée ici : elle peut être jointe, renommée, corrigée ou supprimée.
export function ProductLists() {
  const [lists, setLists] = useState<ProductList[] | null>(null);
  const [importing, setImporting] = useState<"sheet" | "file" | null>(null);
  const [editing, setEditing] = useState<ProductList | null>(null);
  const [renaming, setRenaming] = useState<ProductList | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = () => liveListApi.list().then(setLists).catch(() => setLists((l) => l ?? []));
  useEffect(() => {
    void load();
  }, []);

  const refresh = async (l: ProductList) => {
    setBusy(l.id);
    try {
      const r = await liveListApi.refresh(l.id);
      swal.toast({ title: `${r.list.itemCount} article${r.list.itemCount > 1 ? "s" : ""} à jour` });
      setOpen((o) => (o === l.id ? null : o)); // l'aperçu se recharge à la réouverture
    } catch (e) {
      swal.toast({ variant: "error", title: "Actualisation impossible", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
      void load();
    }
  };

  const remove = async (l: ProductList) => {
    if (await deleteListWithConfirm(l)) setLists((x) => (x ?? []).filter((i) => i.id !== l.id));
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lists ?? []).filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [lists, query]);
  const totalItems = (lists ?? []).reduce((n, l) => n + l.itemCount, 0);

  const importButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button icon={Sheet} onClick={() => setImporting("sheet")}>Depuis Google Sheets</Button>
      <Button icon={FileUp} variant="ghost" onClick={() => setImporting("file")}>Depuis Excel ou CSV</Button>
    </div>
  );

  return (
    <>
      {lists === null ? (
        <ListSkeleton height={96} count={2} />
      ) : lists.length === 0 ? (
        <EmptyState bare icon={FileSpreadsheet} title="Aucune liste d'articles">
          <p>Préparez vos articles avant le live dans Google Sheets ou Excel : code, nom, prix, stock. Chaque liste importée est enregistrée : au démarrage d'une session, il suffit de la joindre.</p>
          <div className="mt-4 flex justify-center">{importButtons}</div>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-[15px] font-bold" style={{ color: theme.text }}>
                {lists.length} liste{lists.length > 1 ? "s" : ""} <span className="text-[13px] font-medium" style={{ color: theme.textMuted }}>· {totalItems.toLocaleString("fr-FR")} article{totalItems > 1 ? "s" : ""}</span>
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>Enregistrées : jointes en un clic au démarrage d'un live, modifiables et supprimables à tout moment.</p>
            </div>
            {lists.length > 4 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une liste…" className="field-in h-9 w-56 rounded-xl pl-8 pr-3 text-[13px] outline-none" style={{ border: 0 }} aria-label="Rechercher une liste" />
              </div>
            )}
            {importButtons}
          </div>

          {shown.length === 0 && <p className="py-6 text-center text-sm" style={{ color: theme.textMuted }}>Aucune liste ne correspond à « {query} ».</p>}

          {shown.map((l) => {
            const error = l.lastStatus === "ERROR";
            const isOpen = open === l.id;
            const Icon = l.sourceUrl ? Sheet : FileUp;
            return (
              <div key={l.id} className="overflow-hidden rounded-2xl card-x">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl" style={{ background: l.sourceUrl ? theme.greenSoft : theme.goldSoft, color: l.sourceUrl ? theme.green : theme.goldDark }}>
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-[14.5px] font-bold" style={{ color: theme.text }}>{l.name}</p>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={error ? { background: theme.dangerBg, color: theme.red } : { background: theme.greenSoft, color: theme.green }}>
                        {error ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />} {error ? "À vérifier" : "À jour"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>
                      <b style={{ color: theme.text }}>{l.itemCount}</b> article{l.itemCount > 1 ? "s" : ""}
                      {" · "}
                      {l.sourceUrl ? (
                        <a href={l.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Google Sheets <ExternalLink size={11} /></a>
                      ) : "fichier importé"}
                      {" · "}
                      {ago(l.lastSyncAt)}
                    </p>
                    <p className="mt-1.5 text-[12.5px]" style={{ color: error ? theme.red : theme.textMuted }}>{l.lastMessage ?? "Prête"}</p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]" style={{ color: theme.textMuted }}>
                      {FIELDS.filter((f) => l.mapping[f.key]).map((f) => (
                        <span key={f.key} className="rounded-full px-2 py-0.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>{f.label} ← {l.mapping[f.key]}</span>
                      ))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {l.sourceUrl && (
                      <Button size="sm" variant="soft" icon={busy === l.id ? Loader2 : RefreshCw} onClick={() => refresh(l)} disabled={busy !== null} className={busy === l.id ? "[&>svg]:animate-spin" : ""}>Actualiser</Button>
                    )}
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setRenaming(l)}>Renommer</Button>
                    <Button size="sm" variant="ghost" icon={Columns3} onClick={() => setEditing(l)}>Colonnes</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(l)} aria-label={`Supprimer ${l.name}`} className="!text-[color:var(--color-red)]">Supprimer</Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : l.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
                  style={{ borderTop: "1px solid var(--line)", background: theme.bg, color: theme.textMuted }}
                >
                  <ChevronDown size={14} className="transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                  {isOpen ? "Masquer les articles" : "Voir les articles"}
                </button>
                {isOpen && <div className="p-4 pt-3"><Preview id={l.id} /></div>}
              </div>
            );
          })}
        </div>
      )}

      {importing && (
        <ProductListImport
          initialOrigin={importing}
          existingNames={(lists ?? []).map((l) => l.name)}
          onClose={() => setImporting(null)}
          onDone={(_items, list) => {
            setImporting(null);
            if (list) swal.toast({ title: `Liste « ${list.name} » enregistrée` });
            void load();
          }}
        />
      )}
      {renaming && <RenameModal list={renaming} taken={(lists ?? []).filter((l) => l.id !== renaming.id).map((l) => l.name)} onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); void load(); }} />}
      {editing && <ListEditor list={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </>
  );
}

// Renommer une liste et corriger la correspondance des colonnes (les articles sont recalculés sans relire le tableur)
export function ListEditor({ list, onClose, onSaved }: { list: ProductList; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(list.name);
  const [mapping, setMapping] = useState<Mapping>(list.mapping);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const ok = Boolean(name.trim() && mapping.code && mapping.name);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await liveListApi.update(list.id, { name: name.trim(), mapping });
      const warn = r.issues.filter((i) => i.level === "warning" || i.level === "error");
      if (warn.length) {
        setNotes(warn.slice(0, 5).map((i) => `Ligne ${i.line} : ${i.message}`));
        swal.toast({ title: `${r.list.itemCount} articles · ${warn.length} remarque${warn.length > 1 ? "s" : ""}` });
      } else swal.toast({ title: "Correspondance enregistrée" });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Colonnes de la liste"
      subtitle={list.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" icon={X} onClick={onClose}>Annuler</Button>
          <Button icon={busy ? Loader2 : Save} disabled={!ok || busy} onClick={save} className={busy ? "[&>svg]:animate-spin" : ""}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold" style={{ color: theme.text }}>Nom de la liste</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field-in h-9 w-full rounded-xl px-3 text-[13px] outline-none" style={{ border: 0 }} />
        </label>
        <MappingFields fields={[...FIELDS]} headers={list.headers} mapping={mapping} onChange={setMapping} />
        {notes.length > 0 && <ul className="text-xs" style={{ color: theme.amber }}>{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </div>
    </Modal>
  );
}

// Renommer une liste (les lives déjà démarrés gardent leurs articles ; seul le nom de la liste change)
export function RenameModal({ list, taken, onClose, onSaved }: { list: ProductList; taken: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(list.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = name.trim();
  const duplicate = taken.some((n) => n.trim().toLowerCase() === clean.toLowerCase());

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await liveListApi.update(list.id, { name: clean });
      swal.toast({ title: "Liste renommée" });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Renommage impossible.");
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Renommer la liste"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" icon={X} onClick={onClose}>Annuler</Button>
          <Button icon={busy ? Loader2 : Save} disabled={!clean || clean === list.name || busy} onClick={save} className={busy ? "[&>svg]:animate-spin" : ""}>Renommer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && clean && clean !== list.name && !busy && void save()}
          maxLength={80}
          autoFocus
          className="field-in h-10 w-full rounded-xl px-3 text-[13px] font-medium outline-none"
          style={{ border: 0 }}
          aria-label="Nom de la liste"
        />
        {duplicate && <p className="text-xs" style={{ color: theme.amber }}>Une autre liste porte déjà ce nom : vous aurez du mal à les distinguer au démarrage d'un live.</p>}
      </div>
    </Modal>
  );
}
