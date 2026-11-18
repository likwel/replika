import { Check } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

// Interrupteur moderne 48 × 28 : gris en creux éteint, dégradé de marque allumé ;
// la pastille blanche glisse et affiche une coche quand il est actif
export function Toggle({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="sw disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="sw-k" aria-hidden="true">
        <Check strokeWidth={3.5} />
      </span>
    </button>
  );
}
