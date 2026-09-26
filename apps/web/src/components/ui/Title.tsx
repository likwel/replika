import { theme } from "@/theme";

interface Props { children: string; className?: string; }

export function Title({ children, className = "" }: Props) {
  const words = children.trim().split(" ");
  const last = words.pop();
  return (
    <h2 className={`font-semibold tracking-tight ${className}`} style={{ color: theme.text }}>
      {words.length > 0 && words.join(" ") + " "}
      <em style={{ color: theme.gold, fontStyle: "italic" }}>{last}</em>
    </h2>
  );
}