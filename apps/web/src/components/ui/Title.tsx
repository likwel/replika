import { theme } from "@/theme";

interface Props {
  children: string;
  className?: string;
  dark?: boolean; // titre posé sur fond sombre : l'accent passe en or clair
}

// Le dernier mot est mis en valeur en Playfair Display italique, comme l'accroche de la page de connexion.
// font-size en em : l'accent suit toujours la taille du titre qui le porte.
export const TITLE_ACCENT: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: "1em",
  letterSpacing: "-0.005em",
};

export function Title({ children, className = "", dark = false }: Props) {
  const words = children.trim().split(" ");
  const last = words.pop();
  return (
    <h2 className={`font-semibold tracking-tight ${className}`} style={{ color: dark ? "#fff" : theme.text }}>
      {words.length > 0 && words.join(" ") + " "}
      {/* Or clair (#F2CB8E) sur fond sombre seulement : sur une carte blanche son contraste tombe à ~1,7:1 */}
      <em style={{ ...TITLE_ACCENT, color: dark ? theme.goldLight : theme.gold }}>{last}</em>
    </h2>
  );
}