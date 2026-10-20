import { useId, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { theme } from "@/theme";

interface Props {
  icon: LucideIcon;
  label?: string; // libellé au-dessus du champ (plus lisible et accessible qu'un simple placeholder)
  type?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  toggle?: boolean; // bouton afficher / masquer le mot de passe
  autoComplete?: string; // remplissage automatique du navigateur et des gestionnaires de mots de passe
  required?: boolean;
  hint?: ReactNode; // aide sous le champ
  trailingLabel?: ReactNode; // à droite du libellé (ex. « Mot de passe oublié ? »)
}

export function Field({ icon: Icon, label, type = "text", name, placeholder, value, onChange, toggle, autoComplete, required, hint, trailingLabel }: Props) {
  const [show, setShow] = useState(false);
  const id = useId();
  const isPw = type === "password";
  return (
    <div>
      {(label || trailingLabel) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && <label htmlFor={id} className="text-[13px] font-medium" style={{ color: theme.text }}>{label}</label>}
          {trailingLabel}
        </div>
      )}
      <div className="relative">
        <Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
        <input
          id={id}
          name={name}
          type={isPw && show ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          className="h-11 w-full rounded-lg pl-11 pr-11 text-sm outline-none transition-shadow focus:ring-2 focus:ring-gold/30"
          style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
        />
        {isPw && toggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-black/5"
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {show ? <EyeOff size={17} style={{ color: theme.textMuted }} /> : <Eye size={17} style={{ color: theme.textMuted }} />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs" style={{ color: theme.textMuted }}>{hint}</p>}
    </div>
  );
}
