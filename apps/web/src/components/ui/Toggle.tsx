interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

// Interrupteur 44 × 26 : gris en creux éteint, dégradé de marque allumé ; le bouton glisse
export function Toggle({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="sw disabled:opacity-50"
    />
  );
}
