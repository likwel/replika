import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen flex" style={{ background: theme.bg }}>
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12" style={{ background: theme.bgDark }}>
        <Link to="/"><Logo dark /></Link>
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug">
            Répondez plus vite,<br />
            <em style={{ color: theme.goldLight, fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>vendez plus</em>.
          </h2>
          <p className="mt-4 max-w-sm" style={{ color: "#ffffff99" }}>
            Automatisez vos commentaires et messages Facebook & Instagram avec l'intelligence artificielle.
          </p>
          <div className="mt-8 flex items-center gap-3">
            {[Facebook, Instagram].map((I, i) => (
              <div key={i} className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }}>
                <I size={20} color="#fff" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm" style={{ color: "#ffffff66" }}>© 2026 ReplyKA</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center"><Link to="/"><Logo /></Link></div>
          <h1 className="text-2xl font-bold" style={{ color: theme.text }}>{title}</h1>
          {subtitle && <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}