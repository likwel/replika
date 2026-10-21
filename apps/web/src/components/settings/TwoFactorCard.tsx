import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, KeyRound, Loader2, Mail, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { ApiError } from "@/lib/api";
import { authApi, type TwoFactorChallenge, type TwoFactorMethod, type TwoFactorStatus } from "@/lib/auth.api";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import { swal } from "@/lib/swal";
import { SettingsCard } from "./SettingsUi";
import { MailDeliveryNotice } from "@/components/auth/MailDeliveryNotice";

const errorOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const METHOD_LABEL: Record<TwoFactorMethod, string> = { TOTP: "application d'authentification", EMAIL: "code par e-mail" };

// Paramètres › Sécurité : validation en deux étapes (désactivée par défaut)
export function TwoFactorCard({ onChanged }: { onChanged: () => void }) {
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [modal, setModal] = useState<"TOTP" | "EMAIL" | "DISABLE" | null>(null);

  const load = () => authApi.twoFactor.status().then(setStatus).catch(() => setStatus(null));
  useEffect(() => {
    void load();
  }, []);

  const changed = (method: TwoFactorMethod | null) => {
    updateUser({ twoFactorMethod: method });
    void load();
    onChanged();
  };

  const method = status?.method ?? null;
  return (
    <SettingsCard
      title="Validation en Deux Étapes"
      description="En plus du mot de passe, un code à usage unique est demandé à chaque connexion. Désactivée par défaut."
    >
      {!status ? (
        <Loader2 size={16} className="animate-spin" style={{ color: theme.textMuted }} />
      ) : method ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl p-3.5" style={{ background: theme.greenSoft }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: theme.bgCard }}>
            <ShieldCheck size={20} style={{ color: theme.green }} />
          </span>
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-semibold" style={{ color: theme.text }}>Activée : {METHOD_LABEL[method]}</p>
            <p className="text-[12px]" style={{ color: theme.textMuted }}>
              {status.enabledAt ? `Depuis le ${formatDateTime(status.enabledAt)} · ` : ""}
              {status.recoveryLeft} code{status.recoveryLeft > 1 ? "s" : ""} de secours restant{status.recoveryLeft > 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={ShieldOff} onClick={() => setModal("DISABLE")}>Désactiver</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Option
            icon={Smartphone}
            title="Application d'authentification"
            badge="Recommandé"
            text="Google Authenticator, Microsoft Authenticator, Authy… Un code change toutes les 30 secondes, même sans réseau."
            action="Configurer"
            onClick={() => setModal("TOTP")}
          />
          <Option
            icon={Mail}
            title="Code par e-mail"
            text={`Un code à 6 chiffres envoyé à ${user?.email ?? "votre adresse"} (Gmail ou autre) à chaque connexion.`}
            action="Activer"
            onClick={() => setModal("EMAIL")}
            disabled={!status.emailAvailable}
            hint={
              !status.emailAvailable
                ? "Envoi d'e-mails non configuré sur le serveur."
                : !status.mailConfigured
                  ? "Serveur d'e-mail non configuré : en développement, le code s'affiche dans le terminal de l'API."
                  : undefined
            }
          />
        </div>
      )}

      {modal === "TOTP" && <TotpSetup onClose={() => setModal(null)} onEnabled={() => changed("TOTP")} />}
      {modal === "EMAIL" && <EmailSetup onClose={() => setModal(null)} onEnabled={() => changed("EMAIL")} />}
      {modal === "DISABLE" && method && <DisableDialog method={method} onClose={() => setModal(null)} onDisabled={() => changed(null)} />}
    </SettingsCard>
  );
}

function Option({ icon: Icon, title, text, action, onClick, badge, disabled, hint }: {
  icon: LucideIcon; title: string; text: string; action: string; onClick: () => void; badge?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <div className="flex flex-col rounded-xl p-4" style={{ background: theme.bg, border: `1px solid ${theme.border}`, opacity: disabled ? 0.6 : 1 }}>
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color: theme.goldDark }} />
        <p className="flex-1 text-[14px] font-semibold" style={{ color: theme.text }}>{title}</p>
        {badge && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{badge}</span>}
      </div>
      <p className="mt-1.5 flex-1 text-[12.5px]" style={{ color: theme.textMuted }}>{text}</p>
      {hint && <p className="mt-1 text-[11.5px]" style={{ color: theme.amber }}>{hint}</p>}
      <Button size="sm" className="mt-3 w-fit" onClick={onClick} disabled={disabled}>{action}</Button>
    </div>
  );
}

// Champ de code : 6 chiffres (ou code de secours si allowRecovery)
function CodeInput({ value, onChange, onSubmit, allowRecovery }: { value: string; onChange: (v: string) => void; onSubmit: () => void; allowRecovery?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(allowRecovery ? e.target.value.toUpperCase().slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 6))}
      onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      inputMode={allowRecovery ? "text" : "numeric"}
      autoComplete="one-time-code"
      placeholder="000000"
      aria-label="Code de vérification"
      className="w-full rounded-xl px-4 py-3 text-center text-[24px] font-semibold tracking-[0.35em] outline-none focus:ring-2 focus:ring-gold/40"
      style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
    />
  );
}

// ─── Application d'authentification ─────────────────────────────────────────

function TotpSetup({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    authApi.twoFactor.totpStart().then(setSetup).catch((e) => setError(errorOf(e, "Activation impossible.")));
  }, []);

  const confirm = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authApi.twoFactor.totpConfirm(code);
      setCodes(r.recoveryCodes);
      onEnabled();
    } catch (e) {
      setError(errorOf(e, "Code incorrect."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (codes) return <RecoveryCodes codes={codes} onClose={onClose} />;
  return (
    <Modal
      title="Configurer l'application d'authentification"
      subtitle="Google Authenticator, Microsoft Authenticator, Authy…"
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={confirm} disabled={busy || code.length !== 6}>{busy && <Loader2 size={14} className="animate-spin" />} Activer</Button>
        </>
      }
    >
      {!setup ? (
        error ? <Alert variant="error">{error}</Alert> : <Loader2 size={18} className="mx-auto animate-spin" style={{ color: theme.textMuted }} />
      ) : (
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-1.5 text-[13px]" style={{ color: theme.text }}>
            <li><strong>1.</strong> Installez Google Authenticator sur votre téléphone (Play Store ou App Store).</li>
            <li><strong>2.</strong> Dans l'application, touchez « + » puis « Scanner un code QR ».</li>
            <li><strong>3.</strong> Saisissez ci-dessous le code à 6 chiffres affiché pour SuiteFlow.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4 rounded-xl p-4" style={{ background: theme.bg }}>
            <img src={setup.qrDataUrl} alt="QR code à scanner avec l'application d'authentification" width={160} height={160} className="rounded-lg bg-white p-1.5" />
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-[12px]" style={{ color: theme.textMuted }}>Impossible de scanner ? Saisissez cette clé :</p>
              <p className="mt-1 break-all font-mono text-[13px] font-semibold" style={{ color: theme.text }}>{setup.secret}</p>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(setup.secret.replace(/\s/g, "")).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="mt-1.5 flex items-center gap-1 text-[12px] font-medium"
                style={{ color: theme.goldDark }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copiée" : "Copier la clé"}
              </button>
            </div>
          </div>
          <CodeInput value={code} onChange={setCode} onSubmit={confirm} />
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}

// ─── Code par e-mail ─────────────────────────────────────────────────────────

function EmailSetup({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // un seul code envoyé, même si l'effet est rejoué
    started.current = true;
    authApi.twoFactor.emailStart().then(setChallenge).catch((e) => setError(errorOf(e, "Envoi du code impossible.")));
  }, []);

  const confirm = async () => {
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authApi.twoFactor.emailConfirm(challenge.challengeId, code);
      setCodes(r.recoveryCodes);
      onEnabled();
    } catch (e) {
      setError(errorOf(e, "Code incorrect."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (codes) return <RecoveryCodes codes={codes} onClose={onClose} />;
  return (
    <Modal
      title="Activer le code par e-mail"
      subtitle={challenge ? `Code envoyé à ${challenge.emailHint}` : "Envoi du code…"}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={confirm} disabled={busy || !challenge || code.length !== 6}>{busy && <Loader2 size={14} className="animate-spin" />} Activer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px]" style={{ color: theme.text }}>
          Saisissez le code à 6 chiffres reçu par e-mail (pensez aux courriers indésirables). Il expire dans 10 minutes.
        </p>
        <MailDeliveryNotice delivery={challenge?.delivery} />
        <CodeInput value={code} onChange={setCode} onSubmit={confirm} />
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

// ─── Codes de secours (affichés une seule fois) ──────────────────────────────

function RecoveryCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `Codes de secours SuiteFlow (chacun ne sert qu'une fois)\n\n${codes.join("\n")}\n`;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "suiteflow-codes-de-secours.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    setSaved(true);
  };
  return (
    <Modal
      title="Validation en deux étapes activée"
      subtitle="Conservez ces codes de secours en lieu sûr : ils ne seront plus affichés."
      onClose={() => saved && onClose()}
      footer={<Button size="sm" onClick={onClose} disabled={!saved}>Terminer</Button>}
    >
      <div className="flex flex-col gap-4">
        <Alert variant="info" icon={KeyRound}>
          Si vous perdez votre téléphone ou l'accès à votre boîte mail, chaque code permet une connexion, une seule fois.
        </Alert>
        <div className="grid grid-cols-2 gap-2 rounded-xl p-4 font-mono text-[15px] font-semibold" style={{ background: theme.bg, color: theme.text }}>
          {codes.map((c) => <span key={c} className="text-center tracking-wider">{c}</span>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" icon={Copy} onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => {});
            setSaved(true);
            swal.toast({ title: "Codes copiés" });
          }}>Copier</Button>
          <Button size="sm" variant="ghost" icon={Download} onClick={download}>Télécharger (.txt)</Button>
        </div>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: theme.text }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          J'ai conservé mes codes de secours
        </label>
      </div>
    </Modal>
  );
}

// ─── Désactivation ───────────────────────────────────────────────────────────

function DisableDialog({ method, onClose, onDisabled }: { method: TwoFactorMethod; onClose: () => void; onDisabled: () => void }) {
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Par e-mail : un code de confirmation est envoyé
  const started = useRef(false);
  useEffect(() => {
    if (method !== "EMAIL" || started.current) return;
    started.current = true;
    authApi.twoFactor.disableStart().then(setChallenge).catch((e) => setError(errorOf(e, "Envoi du code impossible.")));
  }, [method]);

  const confirm = async () => {
    if (code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.twoFactor.disable(code.trim(), challenge?.challengeId);
      swal.toast({ variant: "info", title: "Validation en deux étapes désactivée" });
      onDisabled();
      onClose();
    } catch (e) {
      setError(errorOf(e, "Code incorrect."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Désactiver la validation en deux étapes"
      subtitle={method === "EMAIL" ? (challenge ? `Code envoyé à ${challenge.emailHint}` : "Envoi du code…") : "Saisissez le code de votre application, ou un code de secours."}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button size="sm" variant="danger" onClick={confirm} disabled={busy || code.trim().length < 6}>{busy && <Loader2 size={14} className="animate-spin" />} Désactiver</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px]" style={{ color: theme.textMuted }}>Votre compte ne sera plus protégé que par le mot de passe.</p>
        <MailDeliveryNotice delivery={challenge?.delivery} />
        <CodeInput value={code} onChange={setCode} onSubmit={confirm} allowRecovery />
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
