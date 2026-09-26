import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { theme } from "@/theme";
import { authApi } from "@/lib/auth.api";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Envoi impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Mot de passe oublié" subtitle={sent ? undefined : "Entrez votre e-mail, nous vous enverrons un lien de réinitialisation."}>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
            <CheckCircle2 size={28} style={{ color: theme.goldDark }} />
          </div>
          <p className="text-sm" style={{ color: theme.textMuted }}>
            Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.
          </p>
          <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: theme.goldDark }}>
            <ArrowLeft size={15} /> Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Field icon={Mail} type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p className="text-sm" style={{ color: theme.red }}>{error}</p>}
            <Button variant="primary" size="lg" className="w-full mt-1 justify-center" icon={ArrowRight} onClick={handleSubmit} disabled={loading}>
              {loading ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </div>
          <Link to="/login" className="mt-6 mx-auto flex items-center gap-1.5 text-sm font-medium w-fit" style={{ color: theme.goldDark }}>
            <ArrowLeft size={15} /> Retour à la connexion
          </Link>
        </>
      )}
    </AuthShell>
  );
}