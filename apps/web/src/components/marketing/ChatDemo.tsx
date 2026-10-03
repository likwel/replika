import { useEffect, useState } from "react";
import { MessageCircle, Mail, Sparkles } from "lucide-react";
import { theme } from "@/theme";

// Échanges réalistes : mêmes intentions que celles gérées par le vrai moteur IA (ai.service.ts)
const SCENARIOS = [
  { kind: "Commentaire" as const, question: "C'est combien le panier M ?", reply: "Bonjour ! Le panier M est à 35 000 Ar 😊" },
  { kind: "Message privé" as const, question: "Vous livrez à Toamasina ?", reply: "Oui, sous 5 jours, livraison à 10 000 Ar." },
  { kind: "Commentaire" as const, question: "Ohatrinona ny harona S ?", reply: "Ny harona S dia 25 000 Ar 😊" },
];

type Phase = "asking" | "typing" | "replied";

export function ChatDemo() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("asking");

  useEffect(() => {
    setPhase("asking");
    const t1 = setTimeout(() => setPhase("typing"), 900);
    const t2 = setTimeout(() => setPhase("replied"), 2200);
    const t3 = setTimeout(() => setI((n) => (n + 1) % SCENARIOS.length), 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [i]);

  const s = SCENARIOS[i];
  const Icon = s.kind === "Commentaire" ? MessageCircle : Mail;

  return (
    <div
      className="w-full max-w-sm rounded-3xl p-5 shadow-xl animate-float"
      style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.textMuted }}>
          <Icon size={13} /> {s.kind}
        </span>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
          <Sparkles size={10} /> ReplyKA
        </span>
      </div>

      <div className="flex flex-col gap-2.5 min-h-[132px]">
        <div key={`q-${i}`} className="animate-pop-in self-start max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm" style={{ background: theme.bg, color: theme.text }}>
          {s.question}
        </div>

        {phase === "typing" && (
          <div className="animate-pop-in self-end flex items-center gap-1 rounded-2xl rounded-br-sm px-3.5 py-3" style={{ background: theme.bgDark }}>
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: theme.goldLight, animation: "typingDot 1.1s ease-in-out infinite", animationDelay: `${d * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {phase === "replied" && (
          <div key={`r-${i}`} className="animate-pop-in self-end max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm" style={{ background: theme.bgDark, color: "#fff" }}>
            {s.reply}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px]" style={{ color: theme.textMuted }}>
        Répondu automatiquement en quelques secondes
      </p>
    </div>
  );
}
