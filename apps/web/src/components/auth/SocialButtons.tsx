import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { theme } from "@/theme";
import { authApi, type SocialProvider } from "@/lib/auth.api";
import { Divider } from "./Divider";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}

const PROVIDERS: Array<{ id: SocialProvider; label: string; logo: ReactNode }> = [
  { id: "google", label: "Google", logo: <GoogleLogo /> },
  { id: "facebook", label: "Facebook", logo: <FacebookLogo /> },
];

// Connexion / inscription en un clic. Le compte est créé au premier passage s'il n'existe pas.
export function SocialButtons() {
  const [available, setAvailable] = useState<Record<SocialProvider, boolean> | null>(null);
  const [pending, setPending] = useState<SocialProvider | null>(null);

  useEffect(() => {
    authApi.providers().then(setAvailable).catch(() => setAvailable({ facebook: false, google: false }));
    // Retour arrière depuis la fenêtre du fournisseur : la page est restaurée telle quelle, on réactive les boutons
    const reset = () => setPending(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // En production, un fournisseur non configuré n'est pas proposé ; en développement il reste visible, désactivé
  const shown = PROVIDERS.filter((p) => !available || available[p.id] || import.meta.env.DEV);
  const missing = available ? PROVIDERS.filter((p) => !available[p.id]) : [];
  if (shown.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {shown.map((p) => {
          const ready = available?.[p.id] ?? false;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!ready || pending !== null}
              onClick={() => {
                setPending(p.id);
                window.location.href = authApi.socialLoginUrl(p.id);
              }}
              className="flex h-11 items-center justify-center gap-2.5 rounded-lg text-sm font-medium transition-[filter] hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-55"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
            >
              {pending === p.id ? <Loader2 size={18} className="animate-spin" /> : p.logo}
              Continuer avec {p.label}
            </button>
          );
        })}
      </div>
      {import.meta.env.DEV && missing.length > 0 && (
        <p className="mt-2 text-xs" style={{ color: theme.textMuted }}>
          Mode développement : connexion {missing.map((p) => p.label).join(" et ")} non configurée (voir apps/api/.env.example).
        </p>
      )}
      {/* Pas de case à cocher avec Google / Facebook : l'acceptation des conditions est annoncée ici */}
      <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: theme.textMuted }}>
        En continuant avec Google ou Facebook, vous acceptez nos{" "}
        <Link to="/cgu" target="_blank" rel="noreferrer" className="underline underline-offset-2">conditions d'utilisation</Link> et notre{" "}
        <Link to="/confidentialite" target="_blank" rel="noreferrer" className="underline underline-offset-2">politique de confidentialité</Link>.
      </p>
      <Divider label="ou avec votre e-mail" />
    </>
  );
}
