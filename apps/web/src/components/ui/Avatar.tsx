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

// Photo de profil, ou initiales sur le dégradé de marque (reflet en haut, halo coloré)
export function Avatar({ name, src, size = 36 }: Props) {
  if (src) {
    return <img src={src} alt={name} className="flex-shrink-0 rounded-full object-cover" style={{ width: size, height: size, boxShadow: "0 0 0 1px var(--line-2)" }} />;
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--brand)",
        color: theme.onAccent,
        fontSize: size * 0.38,
        boxShadow: "0 6px 14px -8px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.3)",
      }}
    >
      {initials(name)}
    </span>
  );
}
