import { theme } from "@/theme";

interface Props { dark?: boolean; }

export function Logo({ dark = false }: Props) {
  return (
    <span
      className="text-xl tracking-tight"
      style={{ color: dark ? "#fff" : theme.text, fontWeight: 800, letterSpacing: "-0.8px" }}
    >
      Reply
      <em
        className="text-2xl align-baseline"
        style={{ color: theme.gold, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, letterSpacing: "-0.5px" }}
      >
        KA
      </em>
    </span>
  );
}