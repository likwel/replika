import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ExternalLink, Layers, Loader2, Mail, MessageCircle, Pause, Plug, RefreshCw, Unplug, X } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Segmented";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ReconnectDialog } from "@/components/connections/ReconnectDialog";
import { accountApi, type AccountCheck, type SocialAccount } from "@/lib/account.api";
import { aiApi, type AiAccount, type AiLanguage } from "@/lib/ai.api";
import type { RuleChannel } from "@/lib/automation.api";
import { isPermissionError } from "@/lib/meta";
import { ApiError } from "@/lib/api";
import { swal } from "@/lib/swal";

interface Props {
  account: { id: string; accountId?: string; accountName: string }; // compte cliqué (ligne du tableau de bord)
  onClose: () => void;
  onChanged: () => void; // la liste des comptes doit être relue (pause, dissociation…)
  onOpenInbox?: () => void;
  onOpenAssistant?: () => void;
}

const CHECK_META: Record<AccountCheck["status"], { label: string; tone: "ok" | "warn" | "bad" | "off" }> = {
  ok: { label: "Opérationnel", tone: "ok" },
  missing: { label: "Autorisations manquantes", tone: "warn" },
  not_authorized: { label: "Page non autorisée", tone: "bad" },
  expired: { label: "Connexion expirée", tone: "bad" },
  error: { label: "Vérification impossible", tone: "off" },
};

const CHANNELS: Array<{ value: RuleChannel; label: string }> = [
  { value: "ALL", label: "Tout" },
  { value: "COMMENT", label: "Commentaires" },
  { value: "DIRECT", label: "Messages privés" },
];

const LANGS: Array<{ value: AiLanguage; label: string }> = [
  { value: "AUTO", label: "Automatique (langue du client)" },
  { value: "FR", label: "Français" },
  { value: "MG", label: "Malagasy" },
];

const fmtSince = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

// Une section de la fenêtre : petit titre, puis ses lignes
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>{title}</p>
      {hint && <p className="mb-2 mt-0.5 text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{hint}</p>}
      <div className={`flex flex-col gap-2 ${hint ? "" : "mt-2"}`}>{children}</div>
    </section>
  );
}

// Ligne de réglage : libellé et explication à gauche, commande à droite
function Setting({ title, text, children, disabled }: { title: string; text?: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <div className={`row-s flex-wrap !items-center ${disabled ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1 basis-56">
        <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{title}</b>
        {text && <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{text}</small>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

// Gestion d'un compte associé : pause, assistant IA, accès, reconnexion, dissociation
export function ManageAccountModal({ account, onClose, onChanged, onOpenInbox, onOpenAssistant }: Props) {
  const [acc, setAcc] = useState<SocialAccount | null>(null);
  const [ai, setAi] = useState<AiAccount | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [check, setCheck] = useState<AccountCheck | "loading" | null>(null);
  const [reconnect, setReconnect] = useState(false);

  useEffect(() => {
    accountApi
      .list()
      .then((list) => {
        const found = list.find((a) => a.id === account.id) ?? list.find((a) => a.externalId === account.accountId);
        if (found) setAcc(found);
        else setLoadError("Ce compte n'est plus associé.");
      })
      .catch(() => setLoadError("Impossible de charger ce compte."));
    aiApi
      .overview()
      .then((o) => {
        setAiConfigured(o.configured);
        setAi(o.accounts.find((a) => a.id === account.id) ?? null);
      })
      .catch(() => setAi(null));
  }, [account.id, account.accountId]);

  const fail = (e: unknown, title: string) => swal.toast({ variant: "error", title, text: e instanceof ApiError ? e.message : (e as Error).message });

  const togglePause = async (active: boolean) => {
    if (!acc) return;
    setBusy("toggle");
    try {
      await accountApi.toggle(acc.id, active);
      setAcc({ ...acc, isActive: active });
      swal.toast({ title: active ? "Compte réactivé" : "Compte en pause" });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === "PAGE_LIMIT") swal.toast({ variant: "error", title: "Limite de Pages atteinte", text: e.message });
      else fail(e, "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  const saveAi = async (patch: Partial<Pick<AiAccount, "aiEnabled" | "aiAutoSend" | "aiChannel" | "aiLanguage">>) => {
    if (!ai) return;
    const before = ai;
    setAi({ ...ai, ...patch }); // affichage immédiat, retour arrière en cas d'échec
    setBusy("ai");
    try {
      setAi(await aiApi.updateAccount(ai.id, patch));
    } catch (e) {
      setAi(before);
      fail(e, "Réglage non enregistré");
    } finally {
      setBusy(null);
    }
  };

  const runCheck = async () => {
    if (!acc) return;
    setCheck("loading");
    try {
      setCheck(await accountApi.check(acc.id));
      onChanged();
    } catch {
      setCheck({ status: "error", message: "Vérification impossible pour le moment.", features: [], checkedAt: new Date().toISOString() });
    }
  };

  const dissociate = async () => {
    if (!acc) return;
    const ok = await swal.confirm({
      variant: "warning",
      title: `Dissocier ${acc.name} ?`,
      text: "Ses règles, sessions live et programmations seront supprimées. Votre Page Facebook ou compte Instagram, elle, n'est pas touchée.",
      confirmText: "Dissocier",
    });
    if (!ok) return;
    setBusy("remove");
    try {
      await accountApi.remove(acc.id);
      swal.toast({ title: "Compte dissocié" });
      onChanged();
      onClose();
    } catch (e) {
      setBusy(null);
      fail(e, "Dissociation impossible");
    }
  };

  const needsReconnect = acc && acc.isActive && acc.platform !== "TIKTOK" && Boolean(acc.syncError) && isPermissionError(acc.syncError!);
  const state = !acc ? null : !acc.isActive ? { label: "En pause", tone: "off" } : acc.syncError ? (needsReconnect ? { label: "À reconnecter", tone: "warn" } : { label: "Erreur de relève", tone: "bad" }) : { label: "Actif", tone: "ok" };
  const platformLabel = acc?.platform === "INSTAGRAM" ? "Compte Instagram" : acc?.platform === "TIKTOK" ? "TikTok" : "Page Facebook";

  if (reconnect) return <ReconnectDialog accountName={account.accountName} onClose={() => setReconnect(false)} />;

  return (
    <Modal
      size="lg"
      title="Gérer le compte"
      subtitle="Pause, assistant IA, accès et dissociation de ce compte."
      onClose={onClose}
      footer={
        <>
          {onOpenInbox && <Button variant="ghost" size="sm" icon={ExternalLink} onClick={() => { onClose(); onOpenInbox(); }}>Ouvrir dans Gestion</Button>}
          <Button icon={X} size="sm" onClick={onClose}>Fermer</Button>
        </>
      }
    >
      {loadError ? (
        <p className="row-s text-[13px]" style={{ color: theme.red }}><AlertTriangle size={16} className="flex-shrink-0" />{loadError}</p>
      ) : !acc ? (
        <div className="flex flex-col gap-3"><span className="sk h-16 !rounded-[14px]" /><span className="sk h-14 !rounded-[14px]" /><span className="sk h-14 !rounded-[14px]" /></div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Identité du compte */}
          <div className="row-s !gap-3.5 !p-3.5">
            {acc.platform === "TIKTOK" ? null : <AccountAvatar name={acc.name} src={acc.avatarUrl} platform={acc.platform} size={48} />}
            <div className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-bold tracking-[-0.01em]" style={{ color: theme.text }}>{acc.name}</b>
              <small className="block text-[12.5px]" style={{ color: theme.textMuted }}>{platformLabel} · associé depuis {fmtSince(acc.createdAt)}</small>
            </div>
            {state && <span className={`chip ${state.tone} flex-shrink-0`}>{state.label}</span>}
          </div>

          {acc.syncError && (
            <div className="row-s !items-start" style={{ background: "var(--color-amberSoft)" }}>
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: theme.amber }} />
              <div className="min-w-0 flex-1 text-[12.5px] leading-snug" style={{ color: theme.text }}>
                <b className="block">Dernière erreur de relève</b>
                <span className="break-words" style={{ color: theme.textMuted }}>{acc.syncError}</span>
              </div>
              {needsReconnect && <Button size="sm" variant="soft" icon={Plug} onClick={() => setReconnect(true)}>Reconnecter</Button>}
            </div>
          )}

          <Section title="Fonctionnement">
            <Setting
              title="Compte actif"
              text={acc.isActive ? "SuiteFlow lit les commentaires et messages de ce compte et y répond selon vos règles." : "En pause : plus aucune relève ni réponse automatique. Rien n'est supprimé."}
            >
              {busy === "toggle" && <Loader2 size={15} className="animate-spin" style={{ color: theme.textMuted }} />}
              <Toggle checked={acc.isActive} onChange={togglePause} disabled={busy !== null} label="Compte actif" />
            </Setting>
            {acc.platform === "FACEBOOK" && (
              <p className="px-1 text-[12px] leading-snug" style={{ color: theme.textMuted }}>
                <Pause size={11} className="mr-1 inline" />Mettre une Page en pause met aussi en pause son compte Instagram lié.
              </p>
            )}
          </Section>

          {acc.platform !== "TIKTOK" && (
            <Section title="Assistant IA de ce compte" hint={!aiConfigured ? "Le modèle IA n'est pas encore configuré sur ce serveur : ces réglages s'appliqueront dès qu'il le sera." : undefined}>
              {ai === null ? (
                <span className="sk h-14 !rounded-[14px]" />
              ) : (
                <>
                  <Setting title="Réponses générées par l'IA" text="Pour les messages qu'aucune règle à mots-clés ne couvre.">
                    <Toggle checked={ai.aiEnabled} onChange={(v) => saveAi({ aiEnabled: v })} disabled={busy === "ai"} label="Réponses IA" />
                  </Setting>
                  <Setting title="Envoi automatique" text={ai.aiAutoSend ? "La réponse part toute seule." : "La réponse attend votre validation dans « À traiter »."} disabled={!ai.aiEnabled}>
                    <Toggle checked={ai.aiAutoSend} onChange={(v) => saveAi({ aiAutoSend: v })} disabled={!ai.aiEnabled || busy === "ai"} label="Envoi automatique" />
                  </Setting>
                  <Setting title="Canaux concernés" text="Où l'assistant répond." disabled={!ai.aiEnabled}>
                    <div className={ai.aiEnabled ? "" : "pointer-events-none"}>
                      <Segmented options={CHANNELS.map((c) => ({ ...c, icon: c.value === "ALL" ? Layers : c.value === "COMMENT" ? MessageCircle : Mail }))} value={ai.aiChannel} onChange={(v) => saveAi({ aiChannel: v })} />
                    </div>
                  </Setting>
                  <Setting title="Langue des réponses" text="Quelle que soit la langue du message reçu." disabled={!ai.aiEnabled}>
                    <Select
                      value={ai.aiLanguage ?? "AUTO"}
                      onChange={(e) => saveAi({ aiLanguage: e.target.value as AiLanguage })}
                      disabled={!ai.aiEnabled}
                      className="field-in h-9 w-56 rounded-xl px-3 text-[13px] font-medium"
                      style={{ border: 0 }}
                      aria-label="Langue des réponses"
                    >
                      {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </Select>
                  </Setting>
                  {onOpenAssistant && (
                    <button className="lnk self-start px-1" onClick={() => { onClose(); onOpenAssistant(); }}>
                      Contexte et consignes de l'IA<span aria-hidden> ›</span>
                    </button>
                  )}
                </>
              )}
            </Section>
          )}

          {acc.platform !== "TIKTOK" && (
            <Section title="Accès et autorisations">
              <Setting title="Vérifier l'accès" text="Contrôle le jeton, l'accès à la Page et les autorisations de chaque fonction.">
                <Button size="sm" variant="ghost" icon={check === "loading" ? Loader2 : RefreshCw} onClick={runCheck} disabled={check === "loading"} className={check === "loading" ? "[&>svg]:animate-spin" : ""}>
                  Vérifier
                </Button>
                <Button size="sm" variant="ghost" icon={Plug} onClick={() => setReconnect(true)}>Reconnecter</Button>
              </Setting>
              {check && check !== "loading" && (
                <div className="row-s !items-start">
                  <span className={`tr-ico md ${CHECK_META[check.status].tone === "ok" ? "ok-solid" : CHECK_META[check.status].tone === "off" ? "" : "warn"}`}>
                    {CHECK_META[check.status].tone === "ok" ? <Check strokeWidth={3} /> : CHECK_META[check.status].tone === "off" ? <X /> : <AlertTriangle />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-semibold" style={{ color: theme.text }}>{CHECK_META[check.status].label}</b>
                    <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{check.message}</small>
                    {check.features.length > 0 && (
                      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {check.features.map((f) => (
                          <li key={f.label} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: f.ok ? theme.text : theme.red }}>
                            {f.ok ? <Check size={13} strokeWidth={3} style={{ color: "#16a34a" }} /> : <X size={13} />} {f.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section title="Zone de danger">
            <div className="row-s flex-wrap !items-center" style={{ boxShadow: "inset 0 0 0 1px rgba(225,29,72,0.25)" }}>
              <div className="min-w-0 flex-1 basis-56">
                <b className="block text-[13.5px] font-semibold" style={{ color: theme.red }}>Dissocier ce compte</b>
                <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>
                  Supprime son association à SuiteFlow, avec ses règles, sessions live et programmations. Vous pourrez l'associer de nouveau plus tard.
                </small>
              </div>
              <Button size="sm" variant="danger" icon={busy === "remove" ? Loader2 : Unplug} onClick={dissociate} disabled={busy !== null}>
                Dissocier
              </Button>
            </div>
          </Section>
        </div>
      )}
    </Modal>
  );
}
