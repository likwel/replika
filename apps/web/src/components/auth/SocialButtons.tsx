import { Facebook, Instagram } from "lucide-react";
import { theme } from "@/theme";

export function SocialButtons() {
  return (
    <div className="flex flex-col gap-2.5">
      <button className="flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium transition-all hover:brightness-95" style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}>
        <Facebook size={18} color="#1877F2" /> Continuer avec Facebook
      </button>
      <button className="flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium transition-all hover:brightness-95" style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}>
        <Instagram size={18} color="#E4405F" /> Continuer avec Instagram
      </button>
    </div>
  );
}