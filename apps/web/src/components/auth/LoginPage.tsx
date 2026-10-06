import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Divider } from "@/components/auth/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login } = useAuth();
  // Page demandée avant la redirection vers la connexion (session expirée)
  const from = (loc.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Sinon /app → page d'ouverture choisie dans les préférences. replace : « précédent » ne revient pas au formulaire.
      nav(from?.startsWith("/app") ? from : "/app", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Connexion" subtitle="Heureux de vous revoir sur ReplyKA.">
      <SocialButtons />
      <Divider />
      <div className="flex flex-col gap-3">
        <Field icon={Mail} type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field icon={Lock} type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} toggle />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2" style={{ color: theme.textMuted }}>
            <input type="checkbox" className="rounded" /> Se souvenir de moi
          </label>
          <Link to="/forgot-password" className="font-medium" style={{ color: theme.goldDark }}>Mot de passe oublié ?</Link>
        </div>
        {error && <p className="text-sm" style={{ color: theme.red }}>{error}</p>}
        <Button variant="primary" size="lg" className="w-full mt-1 justify-center" icon={ArrowRight} onClick={handleSubmit} disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </div>
      <p className="mt-6 text-center text-sm" style={{ color: theme.textMuted }}>
        Pas encore de compte ? <Link to="/register" className="font-semibold" style={{ color: theme.goldDark }}>Créer un compte</Link>
      </p>
    </AuthShell>
  );
}