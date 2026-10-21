import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";
import { TwoFactorStep } from "@/components/auth/TwoFactorStep";
import type { TwoFactorChallenge, TwoFactorMethod } from "@/lib/auth.api";

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const { login } = useAuth();
  // Page demandée avant la redirection vers la connexion (session expirée)
  const from = (loc.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  // Retour de Facebook / Google avec un message (connexion annulée, e-mail non partagé…)
  const [error, setError] = useState(params.get("oauth_error") ?? "");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaOn, setCaptchaOn] = useState(true);
  const turnstile = useRef<TurnstileHandle>(null);
  // Validation en deux étapes : retour de Facebook / Google avec un code à saisir, ou connexion par mot de passe
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(() =>
    params.get("challenge")
      ? { challengeId: params.get("challenge")!, method: (params.get("method") as TwoFactorMethod) ?? "TOTP", emailHint: params.get("hint"), expiresAt: "" }
      : null,
  );

  // Le message est affiché une fois : il ne réapparaît pas en rechargeant la page
  useEffect(() => {
    if (params.has("oauth_error") || params.has("challenge")) setParams({}, { replace: true });
  }, []);

  const goIn = () => nav(from?.startsWith("/app") ? from : "/app", { replace: true });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await login(email.trim(), password, remember, captcha);
      if (r.twoFactor) return setChallenge(r.twoFactor);
      // Sinon /app → page d'ouverture choisie dans les préférences. replace : « précédent » ne revient pas au formulaire.
      goIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible, réessayez.");
      turnstile.current?.reset(); // un jeton Cloudflare ne sert qu'une fois
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <AuthShell title="Validation en deux étapes" subtitle="Une vérification de plus pour protéger votre compte.">
        <TwoFactorStep
          challenge={challenge}
          onDone={goIn}
          onCancel={() => {
            setChallenge(null);
            setPassword("");
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Bon retour parmi nous" subtitle="Connectez-vous à votre espace SuiteFlow.">
      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      <SocialButtons />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          icon={Mail}
          label="Adresse e-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          icon={Lock}
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          toggle
          required
          trailingLabel={
            <Link to="/forgot-password" className="text-[13px] font-medium" style={{ color: theme.goldDark }}>
              Mot de passe oublié ?
            </Link>
          }
        />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm" style={{ color: theme.text }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Rester connecté
        </label>
        <Turnstile ref={turnstile} onToken={setCaptcha} onEnabled={setCaptchaOn} />
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full justify-center" disabled={loading || (captchaOn && !captcha)}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: theme.textMuted }}>
        Pas encore de compte ?{" "}
        <Link to="/register" className="font-semibold" style={{ color: theme.goldDark }}>Créer un compte</Link>
      </p>
    </AuthShell>
  );
}
