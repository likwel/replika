import { theme } from "@/theme";

interface Props {
  name: string;
  src?: string | null;
  size?: number;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "?";

// Photo de profil, ou initiales sur fond doré
export function Avatar({ name, src, size = 36 }: Props) {
  if (src) {
    return <img src={src} alt={name} className="flex-shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: theme.gold, color: "#1A1410", fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}
