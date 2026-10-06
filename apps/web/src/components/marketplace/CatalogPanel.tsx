import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Facebook, Info, Link2, Loader2, RefreshCw, Unlink, Upload } from "lucide-react";
import { facebookApi } from "@/lib/facebook.api";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ListSkeleton } from "@/components/workspace/WorkspaceUi";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { marketplaceApi, type FacebookCatalog, type GescomAccount } from "@/lib/marketplace.api";

interface Props {
  onSynced: () => void;
}

export function CatalogPanel({ onSynced }: Props) {
  const [accounts, setAccounts] = useState<GescomAccount[] | null>(null);
  const [catalogs, setCatalogs] = useState<FacebookCatalog[] | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);

  const load = () => {
    marketplaceApi.accounts().then(setAccounts).catch(() => setAccounts([]));
  };
  useEffect(load, []);

  const loadCatalogs = async () => {
    setLoadingCatalogs(true);
    setMessage(null);
    try {
      setCatalogs(await marketplaceApi.catalogs());
    } catch (e) {
      setCatalogs([]);
      setMessage({ error: e instanceof ApiError ? e.message : "Catalogues inaccessibles." });
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const connect = async (accountId: string, catalog: FacebookCatalog | null) => {
    setBusy(accountId);
    setMessage(null);
    try {
      await marketplaceApi.connectCatalog(accountId, { catalogId: catalog?.id ?? null, catalogName: catalog?.name ?? null });
      load();
      setMessage({ ok: catalog ? `Catalogue « ${catalog.name} » connecté.` : "Catalogue déconnecté." });
    } catch (e) {
      setMessage({ error: e instanceof ApiError ? e.message : "Connexion impossible." });
    } finally {
      setBusy(null);
    }
  };

  const sync = async (accountId: string) => {
    setBusy(accountId);
    setMessage(null);
    try {
      const r = await marketplaceApi.syncCatalog(accountId);
      setMessage({ ok: `${r.total} produit${r.total > 1 ? "s" : ""} lu${r.total > 1 ? "s" : ""} · ${r.created} ajouté${r.created > 1 ? "s" : ""}, ${r.updated} mis à jour.` });
      load();
      onSynced();
    } catch (e) {
      setMessage({ error: e instanceof ApiError ? e.message : "Importation impossible." });
    } finally {
      setBusy(null);
    }
  };

  // Sens inverse : envoie les annonces Gescom dans le Catalogue Facebook
  const push = async (accountId: string) => {
    setBusy(accountId);
    setMessage(null);
    try {
      const r = await marketplaceApi.pushCatalog(accountId);
      const parts = [`${r.sent} annonce${r.sent > 1 ? "s" : ""} publiée${r.sent > 1 ? "s" : ""} vers Facebook`];
      if (r.skipped.length) parts.push(`${r.skipped.length} ignorée${r.skipped.length > 1 ? "s" : ""} : ${r.skipped.map((s) => `« ${s.title} » (${s.reason})`).join(", ")}`);
      if (r.errors.length) parts.push(`Refus de Meta : ${r.errors.join(" · ")}`);
      setMessage(r.errors.length ? { error: parts.join(" — ") } : { ok: parts.join(" — ") });
      load();
    } catch (e) {
      setMessage({ error: e instanceof ApiError ? e.message : "Publication impossible." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-2xl p-4 text-xs" style={{ background: theme.goldSoft, color: theme.goldDark }}>
        <Info size={15} className="mt-0.5 flex-shrink-0" />
        <p>
          Gescom se synchronise avec votre <strong>Catalogue Facebook</strong> (Commerce Manager), celui qui alimente vos annonces
          Marketplace. <strong>Importer</strong> récupère les produits Facebook dans Gescom ; <strong>Publier</strong> envoie vos annonces
          Gescom vers Facebook (titre, description, prix, photo, disponibilité). Prérequis : un Business Manager avec un catalogue et
          l'autorisation « catalog_management ». Pour être publiée, une annonce doit avoir un prix et une photo accessible depuis Internet.
        </p>
      </div>

      {/* Prérequis bloquant, affiché sans attendre un clic : c'est la cause n°1 d'une publication qui « ne fait rien » */}
      {accounts && accounts.length > 0 && !accounts[0].facebookLinked && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-xs" style={{ background: "#FDECEC", color: theme.red }}>
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span className="min-w-0 flex-1">
            <strong>Facebook n'est pas encore relié à votre catalogue.</strong> Reconnectez-vous une fois en laissant toutes les autorisations
            cochées : tant que ce lien manque, vos annonces restent dans Gescom et ne partent pas sur Facebook.
          </span>
          <Button size="sm" variant="danger" icon={Facebook} onClick={() => facebookApi.connect()}>Reconnecter Facebook</Button>
        </div>
      )}

      {message && (
        <p className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs" style={{ background: message.error ? "#FDECEC" : theme.goldSoft, color: message.error ? theme.red : theme.goldDark }}>
          {message.error ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />} {message.error ?? message.ok}
        </p>
      )}

      <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <Title className="text-base">Catalogue par compte</Title>
            <p className="text-[11px]" style={{ color: theme.textMuted }}>Un catalogue Facebook par Page connectée.</p>
          </div>
          <Button size="sm" variant="ghost" icon={loadingCatalogs ? Loader2 : RefreshCw} onClick={loadCatalogs} disabled={loadingCatalogs} className={loadingCatalogs ? "[&>svg]:animate-spin" : ""}>
            Chercher mes catalogues
          </Button>
        </div>

        {accounts === null ? (
          <ListSkeleton height={64} count={2} />
        ) : accounts.length === 0 ? (
          <p className="rounded-xl px-4 py-6 text-center text-sm" style={{ background: theme.bg, color: theme.textMuted }}>
            Aucune Page connectée : ajoutez-en une depuis Connexions.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{a.name}</p>
                    <p className="truncate text-[11px]" style={{ color: theme.textMuted }}>
                      {a.catalogId
                        ? `Catalogue : ${a.catalogName ?? a.catalogId}${a.catalogSyncedAt ? ` · importé ${timeAgo(a.catalogSyncedAt)}` : " · jamais importé"}`
                        : "Aucun catalogue connecté"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {catalogs && catalogs.length > 0 && (
                    <select
                      value={a.catalogId ?? ""}
                      onChange={(e) => connect(a.id, catalogs.find((c) => c.id === e.target.value) ?? null)}
                      disabled={busy === a.id}
                      className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
                      aria-label="Catalogue Facebook"
                    >
                      <option value="">— Aucun catalogue —</option>
                      {catalogs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.productCount !== null ? ` (${c.productCount})` : ""} · {c.businessName}
                        </option>
                      ))}
                    </select>
                  )}
                  {a.catalogId ? (
                    <>
                      <Button size="sm" variant="soft" icon={busy === a.id ? Loader2 : Download} onClick={() => sync(a.id)} disabled={busy === a.id} className={busy === a.id ? "[&>svg]:animate-spin" : ""}>
                        Importer
                      </Button>
                      <Button size="sm" variant="ghost" icon={busy === a.id ? Loader2 : Upload} onClick={() => push(a.id)} disabled={busy === a.id} className={busy === a.id ? "[&>svg]:animate-spin" : ""} title="Envoyer les annonces Gescom vers le Catalogue Facebook">
                        Publier
                      </Button>
                      <button onClick={() => connect(a.id, null)} disabled={busy === a.id} className="rounded-lg p-2 hover:bg-black/5" title="Déconnecter le catalogue">
                        <Unlink size={15} style={{ color: theme.textMuted }} />
                      </button>
                    </>
                  ) : (
                    !catalogs && (
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: theme.textMuted }}>
                        <Link2 size={12} /> Cherchez vos catalogues pour en connecter un
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
