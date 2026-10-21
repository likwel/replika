import { Smartphone } from "lucide-react";
import { theme } from "@/theme";

// Même règle que l'API : mobile malgache (034 12 345 67, +261…) ou numéro international (+33…)
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s().-]/g, "");
  const mg = s.match(/^(?:\+?261|00261|0)?(3[2-9]\d{7})$/);
  if (mg) return `+261${mg[1]}`;
  if (/^(\+|00)[1-9]\d{7,14}$/.test(s)) return s.startsWith("00") ? `+${s.slice(2)}` : s;
  return null;
}

// Affichage d'un numéro enregistré : 034 12 345 67
export function displayPhone(p: string | null | undefined): string {
  if (!p) return "";
  const m = p.match(/^\+261(3\d)(\d{2})(\d{3})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  touched?: boolean; // erreur affichée après une tentative de paiement
}

// Numéro de téléphone du payeur : enregistré avec le paiement, et prérempli sur la page Papi
export function PhoneField({ value, onChange, touched }: Props) {
  const invalid = touched && !normalizePhone(value);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Numéro de téléphone du paiement</span>
      <span
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-gold/40"
        style={{ background: theme.bg, border: `1px solid ${invalid ? theme.red : theme.border}` }}
      >
        <Smartphone size={16} style={{ color: theme.textMuted }} />
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="034 12 345 67"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none tabular-nums"
          style={{ color: theme.text }}
          aria-invalid={invalid || undefined}
        />
      </span>
      <span className="mt-1 block text-[11.5px]" style={{ color: invalid ? theme.red : theme.textMuted }}>
        {invalid
          ? "Numéro invalide : 10 chiffres commençant par 03 (MVola, Orange Money, Airtel Money), ou +indicatif."
          : "Le numéro MVola, Orange Money ou Airtel Money qui paie. Il figure sur votre reçu et est proposé la prochaine fois."}
      </span>
    </label>
  );
}
