import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Activity, Bell, Bot, Building2, Check, Eye, EyeOff, KeyRound, Mail, Palette, Receipt, RefreshCw, Rocket, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { theme } from "@/theme";
import type { LucideIcon } from "lucide-react";
import { CardTitle } from "@/components/ui/Dash";

// Icône et couleur de chaque carte, d'après son titre (les cartes qui en passent une gardent la leur)
const AUTO_ICON: Array<[RegExp, LucideIcon, string]> = [
  [/^Informations du profil/i, UserRound, "#3B82F6"],
  [/^Adresse e-mail/i, Mail, "#0EA5E9"],
  [/^Mot de passe/i, KeyRound, "#F59E0B"],
  [/^Validation en deux/i, ShieldCheck, "#10B981"],
  [/^Sessions et activité/i, Activity, "#64748B"],
  [/^Réponses automatiques/i, Bot, "#10B981"],
  [/^Apparence/i, Palette, "#8B5CF6"],
  [/^Alertes et notifications/i, Bell, "#EF4444"],
  [/^Page d'ouverture/i, Rocket, "#06B6D4"],
  [/^Votre formule/i, Sparkles, "#f05a1a"],
  [/^Changer ou renouveler/i, RefreshCw, "#3B82F6"],
  [/^Historique des paiements/i, Receipt, "#64748B"],
  [/^Mon équipe/i, Users, "#3B82F6"],
  [/^Espaces où vous êtes membre/i, Building2, "#8B5CF6"],
  [/^Espace /i, Users, "#3B82F6"],
];

// Carte de section des paramètres ; `danger` pour les actions irréversibles
export function SettingsCard({
  title,
  description,
  danger,
  icon,
  tint,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  icon?: LucideIcon;
  tint?: string;
  children: ReactNode;
}) {
  const auto = icon ? null : AUTO_ICON.find(([re]) => re.test(title));
  return (
    <section className="card-x rounded-2xl p-5" style={danger ? { boxShadow: "inset 0 0 0 1.5px rgba(225,29,72,0.35), var(--sh-card)" } : undefined}>
      <CardTitle title={title} subtitle={description} icon={icon ?? auto?.[1]} tint={tint ?? auto?.[2]} danger={danger} />
      <div>{children}</div>
    </section>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, type = "text", ...props }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>{label}</span>
      <span className="relative block">
        <input
          type={isPassword && show ? "text" : type}
          className="field-in w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none disabled:opacity-60"
          style={{ border: 0, color: theme.text, paddingRight: isPassword ? 40 : undefined }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label={show ? "Masquer" : "Afficher"}
          >
            {show ? <EyeOff size={16} style={{ color: theme.textMuted }} /> : <Eye size={16} style={{ color: theme.textMuted }} />}
          </button>
        )}
      </span>
      {hint && <span className="mt-1 block text-[11px]" style={{ color: theme.textMuted }}>{hint}</span>}
    </label>
  );
}

// Retour d'action : succès doré ou erreur rouge
export function Feedback({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) {
    return <p className="rounded-xl px-3 py-2 text-sm" style={{ background: theme.dangerBg, color: theme.red }}>{error}</p>;
  }
  if (ok) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: theme.green }}>
        <Check size={14} /> {ok}
      </p>
    );
  }
  return null;
}

// Ligne « libellé + description + contrôle » (interrupteurs, sélecteurs)
export function SettingRow({ label, description, children }: { label: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="row-s !items-start !gap-4 !p-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{label}</p>
        {description && <div className="mt-0.5 text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}
