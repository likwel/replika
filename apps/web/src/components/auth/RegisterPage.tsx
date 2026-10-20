import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const MIN_PASSWORD = 8;

const legalLink = "font-medium underline underline-offset-2";

export function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < MIN_PASSWORD) return setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
    if (!accepted) return setError("Acceptez les conditions d'utilisation pour créer votre compte.");
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      nav("/app", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible, réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Créer votre compte" subtitle="Démarrez votre essai gratuit de 14 jours.">
      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      <SocialButtons />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field icon={User} label="Nom complet" name="name" autoComplete="name" placeholder="Votre nom et prénom" value={form.name} onChange={set("name")} required />
        <Field
          icon={Mail}
          label="Adresse e-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          value={form.email}
          onChange={set("email")}
          required
        />
        <Field
          icon={Lock}
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Choisissez un mot de passe"
          value={form.password}
          onChange={set("password")}
          toggle
          required
          hint={`${MIN_PASSWORD} caractères minimum.`}
        />
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed" style={{ color: theme.text }}>
          <input
            type="checkbox"
            className="mt-[3px] h-4 w-4 flex-shrink-0 accent-[var(--color-gold)]"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          {/* Liens ouverts dans un nouvel onglet : le formulaire en cours n'est pas perdu */}
          <span>
            J'accepte les{" "}
            <Link to="/cgu" target="_blank" rel="noreferrer" className={legalLink} style={{ color: theme.goldDark }}>
              conditions d'utilisation
            </Link>{" "}
            et la{" "}
            <Link to="/confidentialite" target="_blank" rel="noreferrer" className={legalLink} style={{ color: theme.goldDark }}>
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full justify-center" disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: theme.textMuted }}>
        Déjà inscrit ?{" "}
        <Link to="/connexion" className="font-semibold" style={{ color: theme.goldDark }}>Se connecter</Link>
      </p>
    </AuthShell>
  );
}
