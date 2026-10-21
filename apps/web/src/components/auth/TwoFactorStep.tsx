import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ApiError } from "@/lib/api";
import { authApi, type TwoFactorChallenge } from "@/lib/auth.api";
import { useAuth } from "@/context/AuthContext";
import { swal } from "@/lib/swal";
import { MailDeliveryNotice } from "./MailDeliveryNotice";

interface Props {
  challenge: TwoFactorChallenge;
  onDone: () => void;
  onCancel: () => void;
}

// Seconde étape de la connexion : code reçu par e-mail, code de l'application, ou code de secours
export function TwoFactorStep({ challenge: initial, onDone, onCancel }: Props) {
  const { completeTwoFactor } = useAuth();
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(45);
  const input = useRef<HTMLInputElement>(null);
  const email = challenge.method === "EMAIL";

  useEffect(() => {
    input.current?.focus();
  }, [recovery]);
  useEffect(() => {
    if (!email || cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown, email]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    try {
      const r = await completeTwoFactor(challenge.challengeId, code.trim());
      if (r.usedRecovery) {
        swal.toast({
          variant: r.recoveryLeft <= 2 ? "warning" : "info",
          title: "Code de secours utilisé",
          text: `Il vous en reste ${r.recoveryLeft}. Pensez à reconfigurer la validation en deux étapes si vous avez perdu votre accès.`,
          duration: 6000,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Vérification impossible, réessayez.");
      setCode("");
      input.current?.focus();
      if (err instanceof ApiError && (err.code === "TWO_FACTOR_EXPIRED" || err.code === "TWO_FACTOR_LOCKED")) setTimeout(onCancel, 2500);
    } finally {
      setLoading(false);
    }
  };

  // Six chiffres saisis : vérification automatique
  useEffect(() => {
    if (!recovery && /^\d{6}$/.test(code) && !loading) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setError("");
    try {
      setChallenge(await authApi.resendTwoFactor(challenge.challengeId));
      setCooldown(45);
      swal.toast({ title: "Nouveau code envoyé", text: challenge.emailHint ?? undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Envoi impossible, réessayez.");
    }
  };

  const Icon = recovery ? KeyRound : email ? Mail : Smartphone;
  return (
    <div>
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
        <Icon size={26} style={{ color: theme.goldDark }} />
      </span>
      <p className="text-center text-[14px]" style={{ color: theme.text }}>
        {recovery
          ? "Saisissez l'un de vos codes de secours (format ABCD-1234). Chaque code ne sert qu'une fois."
          : email
            ? <>Nous avons envoyé un code à 6 chiffres à <strong>{challenge.emailHint}</strong>.</>
            : "Ouvrez Google Authenticator (ou votre application d'authentification) et saisissez le code SuiteFlow."}
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        {email && !recovery && <MailDeliveryNotice delivery={challenge.delivery} />}
        {error && <Alert variant="error">{error}</Alert>}
        <input
          ref={input}
          value={code}
          onChange={(e) => setCode(recovery ? e.target.value.toUpperCase().slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode={recovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={recovery ? "ABCD-1234" : "000000"}
          aria-label={recovery ? "Code de secours" : "Code de vérification"}
          className="w-full rounded-xl px-4 py-3 text-center text-[26px] font-semibold tracking-[0.35em] outline-none focus:ring-2 focus:ring-gold/40"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
        />
        <Button type="submit" size="lg" className="w-full justify-center" disabled={loading || !code.trim()} icon={ShieldCheck}>
          {loading ? "Vérification…" : "Vérifier et se connecter"}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <button onClick={onCancel} className="flex items-center gap-1 font-medium" style={{ color: theme.textMuted }}>
          <ArrowLeft size={14} /> Retour
        </button>
        <div className="flex items-center gap-3">
          {email && !recovery && (
            <button onClick={resend} disabled={cooldown > 0} className="font-medium disabled:opacity-50" style={{ color: theme.goldDark }}>
              {cooldown > 0 ? `Renvoyer (${cooldown} s)` : "Renvoyer le code"}
            </button>
          )}
          <button
            onClick={() => {
              setRecovery((r) => !r);
              setCode("");
              setError("");
            }}
            className="font-medium"
            style={{ color: theme.goldDark }}
          >
            {recovery ? "Utiliser le code habituel" : "Utiliser un code de secours"}
          </button>
        </div>
      </div>
    </div>
  );
}
