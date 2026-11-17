import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { saveThemePref, THEME_LABELS, useThemePref, type ThemePref } from "@/lib/themePref";

const OPTIONS: Array<{ value: ThemePref; icon: LucideIcon; hint: string }> = [
  { value: "auto", icon: Monitor, hint: "Suit l'apparence de votre appareil" },
  { value: "light", icon: Sun, hint: "Toujours clair" },
  { value: "dark", icon: Moon, hint: "Toujours sombre" },
];

// Sélecteur de thème des pages publiques : Automatique (défaut, suit l'appareil), Clair, Sombre.
// Réglage de cet appareil ; dans l'application, le même choix se fait depuis Paramètres › Préférences.
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { pref } = useThemePref();
  return (
    <div role="radiogroup" aria-label="Thème d'affichage" className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${className}`} style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      {OPTIONS.map(({ value, icon: Icon, hint }) => {
        const on = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={THEME_LABELS[value]}
            title={`${THEME_LABELS[value]} : ${hint}`}
            onClick={() => saveThemePref(value)}
            className="grid h-7 w-7 place-items-center rounded-full transition-colors"
            style={on ? { background: theme.text, color: theme.bgCard } : { color: theme.textMuted }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
