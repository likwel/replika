import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, ArrowRight } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Divider } from "@/components/auth/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!accepted) { setError("Vous devez accepter les conditions d'utilisation."); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      nav("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Créer un compte" subtitle="Démarrez votre essai gratuit de 14 jours.">
      <SocialButtons />
      <Divider />
      <div className="flex flex-col gap-3">
        <Field icon={User} placeholder="Nom complet" value={form.name} onChange={set("name")} />
        <Field icon={Mail} type="email" placeholder="Adresse e-mail" value={form.email} onChange={set("email")} />
        <Field icon={Lock} type="password" placeholder="Mot de passe" value={form.password} onChange={set("password")} toggle />
        <label className="flex items-start gap-2 text-sm mt-1" style={{ color: theme.textMuted }}>
          <input type="checkbox" className="mt-0.5 rounded" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          J'accepte les <span style={{ color: theme.goldDark }}>conditions d'utilisation</span>.
        </label>
        {error && <p className="text-sm" style={{ color: theme.red }}>{error}</p>}
        <Button variant="primary" size="lg" className="w-full mt-1 justify-center" icon={ArrowRight} onClick={handleSubmit} disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </div>
      <p className="mt-6 text-center text-sm" style={{ color: theme.textMuted }}>
        Déjà inscrit ? <Link to="/login" className="font-semibold" style={{ color: theme.goldDark }}>Se connecter</Link>
      </p>
    </AuthShell>
  );
}