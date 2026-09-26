import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";

// Carte de section des paramètres ; `danger` pour les actions irréversibles
export function SettingsCard({
  title,
  description,
  danger,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: theme.bgCard, border: `1px solid ${danger ? "#F2C4BF" : theme.border}` }}
    >
      {danger ? (
        <h2 className="font-semibold tracking-tight" style={{ color: theme.red }}>{title}</h2>
      ) : (
        <Title className="text-base">{title}</Title>
      )}
      {description && <p className="mt-0.5 text-xs" style={{ color: theme.textMuted }}>{description}</p>}
      <div className="mt-4">{children}</div>
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
          className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-60"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, paddingRight: isPassword ? 40 : undefined }}
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
    return <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>;
  }
  if (ok) {
    return (
      <p className="flex items-center gap-1.5 text-sm" style={{ color: theme.goldDark }}>
        <Check size={14} /> {ok}
      </p>
    );
  }
  return null;
}

// Ligne « libellé + description + contrôle » (interrupteurs, sélecteurs)
export function SettingRow({ label, description, children }: { label: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl p-3.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div className="flex-1">
        <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{label}</p>
        {description && <div className="mt-0.5 text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}
