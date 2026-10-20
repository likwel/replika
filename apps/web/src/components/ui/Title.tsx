import { theme } from "@/theme";

interface Props {
  children: string;
  className?: string;
  dark?: boolean; // titre posé sur fond sombre
}

// Titre de section : sobre, sans accent décoratif
export function Title({ children, className = "", dark = false }: Props) {
  return (
    <h2 className={`font-semibold tracking-[-0.01em] ${className}`} style={{ color: dark ? "#fff" : theme.text }}>
      {children}
    </h2>
  );
}
