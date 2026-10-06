import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { toPublishableJpeg } from "@/lib/image";
import { uploadImage } from "@/lib/schedule.api";
import type { SocialAccount } from "@/lib/account.api";
import { marketplaceApi, type ListingInput, type MarketplaceListing } from "@/lib/marketplace.api";

interface Props {
  listing: MarketplaceListing | null; // null = création
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: (listing: MarketplaceListing) => void;
}

const inputClass = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };
const label = "mb-1.5 block text-[13px] font-semibold";

export function ListingEditor({ listing, accounts, onClose, onSaved }: Props) {
  const replyAccounts = accounts.filter((a) => a.platform !== "TIKTOK");
  const [form, setForm] = useState<ListingInput>(() =>
    listing
      ? {
          accountId: listing.accountId,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          stock: listing.stock,
          category: listing.category,
          images: listing.images,
          status: listing.status,
        }
      : { accountId: replyAccounts[0]?.id ?? "", title: "", description: null, price: null, stock: null, category: null, images: [], status: "ACTIVE" }
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ListingInput>(k: K, v: ListingInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 10 - (form.images?.length ?? 0))) {
        const { url } = await uploadImage(await toPublishableJpeg(file));
        urls.push(url);
      }
      set("images", [...(form.images ?? []), ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi de l'image impossible.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => set("images", (form.images ?? []).filter((u) => u !== url));

  const submit = async () => {
    setError(null);
    if (!form.accountId) return setError("Choisissez un compte.");
    if (!form.title.trim()) return setError("Donnez un titre à l'annonce.");
    setSaving(true);
    try {
      const saved = listing ? await marketplaceApi.updateListing(listing.id, form) : await marketplaceApi.createListing(form);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={listing ? "Modifier l'annonce" : "Nouvelle annonce Marketplace"}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className={label} style={{ color: theme.text }}>Photos</label>
          <div className="flex flex-wrap gap-2">
            {(form.images ?? []).map((url) => (
              <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-xl" style={{ border: `1px solid ${theme.border}` }}>
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => removePhoto(url)}
                  className="absolute right-1 top-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                  aria-label="Retirer la photo"
                >
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
            {(form.images?.length ?? 0) < 10 && (
              <label
                className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[11px]"
                style={{ background: theme.bg, border: `1px dashed ${theme.border}`, color: theme.textMuted }}
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                Ajouter
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        <div>
          <label className={label} style={{ color: theme.text }}>Titre</label>
          <input className={inputClass} style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Panier en raphia tressé" autoFocus />
        </div>

        <div>
          <label className={label} style={{ color: theme.text }}>Description</label>
          <textarea className={inputClass} style={inputStyle} rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={label} style={{ color: theme.text }}>Prix (Ar)</label>
            <input type="number" min={0} className={inputClass} style={inputStyle} value={form.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className={label} style={{ color: theme.text }}>Stock</label>
            <input type="number" min={0} className={inputClass} style={inputStyle} value={form.stock ?? ""} placeholder="∞" onChange={(e) => set("stock", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={label} style={{ color: theme.text }}>Catégorie</label>
            <input className={inputClass} style={inputStyle} value={form.category ?? ""} onChange={(e) => set("category", e.target.value || null)} placeholder="Artisanat" />
          </div>
          <div>
            <label className={label} style={{ color: theme.text }}>Statut</label>
            <select className={inputClass} style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value as ListingInput["status"])}>
              <option value="ACTIVE">En ligne</option>
              <option value="SOLD_OUT">Épuisé</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
        </div>

        <div>
          <label className={label} style={{ color: theme.text }}>Compte</label>
          <select className={inputClass} style={inputStyle} value={form.accountId} onChange={(e) => set("accountId", e.target.value)}>
            {replyAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}</option>
            ))}
          </select>
        </div>

        {error && <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>}
      </div>
    </Modal>
  );
}
