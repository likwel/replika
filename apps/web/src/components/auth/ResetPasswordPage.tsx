import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowRight, CheckCircle2 } from "lucide-react";
import { theme } from "@/theme";
import { authApi } from "@/lib/auth.api";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!token) { setError("Lien invalide ou expiré."); return; }
    if (pw !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (pw.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Réinitialisation impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Nouveau mot de passe" subtitle={done ? undefined : "Choisissez un nouveau mot de passe sécurisé."}>
      {done ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
            <CheckCircle2 size={28} style={{ color: theme.goldDark }} />
          </div>
          <p className="text-sm" style={{ color: theme.textMuted }}>Votre mot de passe a été réinitialisé avec succès.</p>
          <Button variant="primary" className="mt-6 w-full justify-center" icon={ArrowRight} onClick={() => nav("/login")}>Se connecter</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field icon={KeyRound} type="password" placeholder="Nouveau mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} toggle />
          <Field icon={KeyRound} type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} toggle />
          {error && <p className="text-sm" style={{ color: theme.red }}>{error}</p>}
          <Button variant="primary" size="lg" className="w-full mt-1 justify-center" icon={ArrowRight} onClick={handleSubmit} disabled={loading}>
            {loading ? "Réinitialisation…" : "Réinitialiser"}
          </Button>
        </div>
      )}
    </AuthShell>
  );
}