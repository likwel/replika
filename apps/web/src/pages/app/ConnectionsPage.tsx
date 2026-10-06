import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Facebook, Instagram, Film, MoreHorizontal, Plus,
  CheckCircle2, AlertCircle, Trash2, Power, RefreshCw, ShieldCheck, Loader2, XCircle, Link2,
} from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { AssistantCard } from "@/components/automation/AssistantCard";
import { ReconnectDialog } from "@/components/connections/ReconnectDialog";
import { accountApi, type AccountCheck, type SocialAccount } from "@/lib/account.api";
import { isPermissionError, permissionLabel } from "@/lib/meta";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";

const PLATFORM_META = {
  FACEBOOK: { icon: Facebook, color: "#1877F2", label: "Facebook" },
  INSTAGRAM: { icon: Instagram, color: "#E4405F", label: "Instagram" },
  TIKTOK: { icon: Film, color: "#000000", label: "TikTok" },
} as const;

const CHECK_META: Record<AccountCheck["status"], { label: string; color: string; bg: string }> = {
  ok: { label: "Opérationnel", color: theme.green, bg: theme.greenSoft },
  missing: { label: "Autorisations manquantes", color: theme.amber, bg: theme.amberSoft },
  not_authorized: { label: "Page non autorisée", color: theme.red, bg: "#FDECEC" },
  expired: { label: "Connexion expirée", color: theme.red, bg: "#FDECEC" },
  error: { label: "Vérification impossible", color: theme.textMuted, bg: theme.bg },
};

const available = [{ i: Film, n: "TikTok", d: "Vidéos et commentaires (limité)", c: "#000000", soon: true }];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// Erreur de relève qui se règle en reconnectant Facebook
const needsReconnect = (a: SocialAccount) => a.isActive && a.platform !== "TIKTOK" && Boolean(a.syncError) && isPermissionError(a.syncError!);

export function ConnectionsPage() {
  const [params, setParams] = useSearchParams();
  const fbStatus = params.get("fb");
  const absent = params.get("absent")?.split("|").filter(Boolean) ?? [];

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState<{ name?: string } | null>(null);
  const [checks, setChecks] = useState<Record<string, AccountCheck | "loading">>({});
  const accountsPage = usePagination(accounts, 20);

  const load = () => {
    setLoading(true);
    accountApi
      .list()
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (acc: SocialAccount) => {
    setMenuId(null);
    await accountApi.toggle(acc.id, !acc.isActive);
    setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, isActive: !a.isActive } : a)));
  };

  const handleRemove = async (acc: SocialAccount) => {
    setMenuId(null);
    if (!window.confirm(`Délier ${acc.name} ? Ses règles, sessions live et programmations seront supprimées.`)) return;
    await accountApi.remove(acc.id);
    setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
  };

  const check = async (acc: SocialAccount) => {
    setMenuId(null);
    setChecks((c) => ({ ...c, [acc.id]: "loading" }));
    try {
      const result = await accountApi.check(acc.id);
      setChecks((c) => ({ ...c, [acc.id]: result }));
      load(); // l'erreur affichée peut avoir été effacée ou mise à jour
    } catch {
      setChecks((c) => ({ ...c, [acc.id]: { status: "error", message: "Vérification impossible.", features: [], checkedAt: new Date().toISOString() } }));
    }
  };

  const toFix = accounts.filter(needsReconnect);
  const dismissBanner = () => setParams({}, { replace: true });

  return (
    <div>
      {/* Retour de Facebook */}
      {fbStatus === "success" && (
        <div className="mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: theme.goldSoft, color: theme.goldDark }}>
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <p className="flex-1">
            {params.get("pages")} page(s) Facebook
            {Number(params.get("ig")) > 0 && ` et ${params.get("ig")} compte(s) Instagram`} connecté(s) avec succès.
          </p>
          <button onClick={dismissBanner} aria-label="Fermer"><XCircle size={15} /></button>
        </div>
      )}
      {fbStatus === "success" && absent.length > 0 && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "#FEF3C7", color: "#92400e" }}>
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1 basis-56">
            <p className="font-semibold">Non cochées lors de cette connexion : {absent.join(", ")}</p>
            <p className="mt-0.5 text-xs">ReplyKA ne peut plus les gérer. Reconnectez-vous et cochez-les dans « Modifier les paramètres ».</p>
          </div>
          <Button size="sm" variant="dark" icon={Facebook} onClick={() => setReconnect({ name: absent[0] })}>Reconnecter</Button>
        </div>
      )}
      {fbStatus === "success" && params.get("missing") && (
        <div className="mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "#FDECEC", color: theme.red }}>
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Autorisations refusées : certaines fonctions ne marcheront pas.</p>
            <p className="mt-0.5 text-xs">
              Manquantes : {params.get("missing")!.split(",").map(permissionLabel).join(", ")}. Reconnectez Facebook en laissant toutes les
              autorisations cochées.
            </p>
          </div>
        </div>
      )}
      {fbStatus === "denied" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "#FDECEC", color: theme.red }}>
          <AlertCircle size={16} /> La connexion Facebook a été refusée.
        </div>
      )}
      {fbStatus === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "#FDECEC", color: theme.red }}>
          <AlertCircle size={16} /> {params.get("reason") ?? "Connexion à Facebook impossible, réessayez."}
        </div>
      )}

      {/* Comptes à reconnecter */}
      {toFix.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center" style={{ background: "#FDECEC", border: `1px solid ${theme.red}33` }}>
          <AlertCircle size={20} className="flex-shrink-0" style={{ color: theme.red }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: theme.red }}>
              {toFix.length === 1 ? "1 compte doit être reconnecté" : `${toFix.length} comptes doivent être reconnectés`}
            </p>
            <p className="text-xs" style={{ color: theme.red }}>{toFix.map((a) => a.name).join(", ")} : commentaires, messages et lives sont à l'arrêt.</p>
          </div>
          <Button size="sm" variant="danger" icon={Facebook} onClick={() => setReconnect({ name: toFix[0].name })}>Reconnecter Facebook</Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <AssistantCard showRulesLink />

          <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Title className="flex-1 text-base">Comptes Connectés</Title>
              <Button size="sm" variant="ghost" icon={Link2} onClick={() => setReconnect({})} title="Renouveler l'accès, ajouter ou retirer des Pages">
                Reconnecter / ajouter des Pages
              </Button>
              <button onClick={load} className="rounded-lg p-1.5 hover:bg-black/5" title="Rafraîchir">
                <RefreshCw size={15} style={{ color: theme.textMuted }} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {loading && accounts.length === 0 ? (
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl p-3.5" style={{ background: theme.bg }}>
                    <div className="h-9 w-9 rounded-lg" style={{ background: theme.border }} />
                    <div className="flex-1">
                      <div className="h-3 w-1/3 rounded" style={{ background: theme.border }} />
                      <div className="mt-2 h-2.5 w-1/2 rounded" style={{ background: theme.border }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-xl py-8 text-center" style={{ background: theme.bg }}>
                <p className="text-sm" style={{ color: theme.textMuted }}>Aucun compte connecté pour l'instant.</p>
                <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Connectez une plateforme depuis le panneau de droite.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {accountsPage.pageItems.map((acc) => {
                  const meta = PLATFORM_META[acc.platform];
                  const Icon = meta.icon;
                  const result = checks[acc.id];
                  const broken = needsReconnect(acc);
                  return (
                    <div key={acc.id} className="relative rounded-xl p-3.5" style={{ background: theme.bg, border: `1px solid ${broken ? `${theme.red}55` : theme.border}`, opacity: acc.isActive ? 1 : 0.55 }}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {acc.avatarUrl ? (
                            <img src={acc.avatarUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="rounded-lg p-2" style={{ background: theme.bgCard }}>
                              <Icon size={20} color={meta.color} />
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5">
                            <Icon size={12} color={meta.color} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{acc.name}</p>
                          <p className="text-[11px]" style={{ color: theme.textMuted }}>
                            {meta.label} · connecté en {formatDate(acc.createdAt)}
                          </p>
                          {acc.isActive && acc.syncError && (
                            <p className="mt-0.5 flex items-start gap-1 text-[11px]" style={{ color: theme.red }} title={acc.syncError}>
                              <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{acc.syncError}</span>
                            </p>
                          )}
                        </div>
                        {broken ? (
                          <Button size="sm" variant="danger" onClick={() => setReconnect({ name: acc.name })}>Reconnecter</Button>
                        ) : (
                          <span
                            className="hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:flex"
                            style={{
                              color: acc.isActive ? theme.green : theme.textMuted,
                              background: acc.isActive ? theme.greenSoft : theme.bgCard,
                            }}
                          >
                            <StatusDot color={acc.isActive ? theme.green : theme.textMuted} size={6} pulse={acc.isActive} />
                            {acc.isActive ? "En ligne" : "Inactif"}
                          </span>
                        )}
                        <button onClick={() => setMenuId(menuId === acc.id ? null : acc.id)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label={`Actions pour ${acc.name}`}>
                          <MoreHorizontal size={16} style={{ color: theme.textMuted }} />
                        </button>
                      </div>

                      {result && (
                        <div className="mt-3 rounded-lg p-3" style={{ background: theme.bgCard }}>
                          {result === "loading" ? (
                            <p className="flex items-center gap-2 text-xs" style={{ color: theme.textMuted }}><Loader2 size={13} className="animate-spin" /> Vérification auprès de Facebook…</p>
                          ) : (
                            <>
                              <p className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: CHECK_META[result.status].bg, color: CHECK_META[result.status].color }}>
                                  {CHECK_META[result.status].label}
                                </span>
                                <span style={{ color: theme.textMuted }}>{result.message}</span>
                              </p>
                              {result.features.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {result.features.map((f) => (
                                    <span key={f.label} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: f.ok ? theme.greenSoft : "#FDECEC", color: f.ok ? theme.green : theme.red }}>
                                      {f.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {f.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {result.status !== "ok" && result.status !== "error" && (
                                <Button size="sm" variant="soft" className="mt-2" icon={Facebook} onClick={() => setReconnect({ name: acc.name })}>Reconnecter</Button>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {menuId === acc.id && (
                        <div className="absolute right-3 top-12 z-10 w-56 rounded-xl py-1 shadow-lg" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                          {acc.platform !== "TIKTOK" && (
                            <>
                              <button onClick={() => check(acc)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5" style={{ color: theme.text }}>
                                <ShieldCheck size={15} /> Vérifier la connexion
                              </button>
                              <button onClick={() => { setMenuId(null); setReconnect({ name: acc.name }); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5" style={{ color: theme.text }}>
                                <RefreshCw size={15} /> Reconnecter
                              </button>
                            </>
                          )}
                          <button onClick={() => handleToggle(acc)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5" style={{ color: theme.text }}>
                            <Power size={15} /> {acc.isActive ? "Désactiver" : "Activer"}
                          </button>
                          <button onClick={() => handleRemove(acc)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5" style={{ color: theme.red }}>
                            <Trash2 size={15} /> Délier
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Pagination page={accountsPage.page} pageCount={accountsPage.pageCount} onChange={accountsPage.setPage} total={accountsPage.total} pageSize={20} />
          </div>
        </div>

        {/* Ajouter une plateforme */}
        <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <Title className="mb-4 text-base">Ajouter une Plateforme</Title>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setReconnect({})}
              className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:shadow-sm"
              style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
            >
              <Facebook size={20} color="#1877F2" />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: theme.text }}>Facebook</p>
                <p className="text-[11px]" style={{ color: theme.textMuted }}>Pages, commentaires, Messenger, Lives, publication</p>
              </div>
              <Plus size={16} style={{ color: theme.gold }} />
            </button>

            {/* Instagram professionnel : importé via la Page Facebook à laquelle il est lié */}
            <button
              onClick={() => setReconnect({})}
              className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:shadow-sm"
              style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
            >
              <Instagram size={20} color="#E4405F" />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: theme.text }}>Instagram</p>
                <p className="text-[11px]" style={{ color: theme.textMuted }}>Compte pro lié à une Page · commentaires, DM, publication</p>
              </div>
              <Plus size={16} style={{ color: theme.gold }} />
            </button>

            {available.map((p, i) => (
              <button key={i} disabled className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl p-3 text-left" style={{ background: theme.bg, border: `1px solid ${theme.border}`, opacity: 0.6 }}>
                <p.i size={20} color={p.c} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: theme.text }}>{p.n}</p>
                  <p className="text-[11px]" style={{ color: theme.textMuted }}>{p.d}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: theme.border, color: theme.textMuted }}>Bientôt</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {reconnect && <ReconnectDialog accountName={reconnect.name} onClose={() => setReconnect(null)} />}
    </div>
  );
}
