import type { CSSProperties } from "react";
import { AlertTriangle, Check, Cpu, Lock } from "lucide-react";
import { theme } from "@/theme";
import { IconTile } from "@/components/ui/Dash";
import { timeAgo } from "@/lib/format";
import type { AiOverview } from "@/lib/ai.api";

// Modèles annoncés : choisir son modèle par compte arrive bientôt ; ils restent désactivés d'ici là
const COMING: Array<{ id: string; name: string; vendor: string; mark: string; a: string; b: string }> = [
  { id: "chatgpt", name: "ChatGPT", vendor: "OpenAI", mark: "G", a: "#34d3a5", b: "#0e8f6e" },
  { id: "claude", name: "Claude", vendor: "Anthropic", mark: "C", a: "#f0a27c", b: "#c4623a" },
  { id: "deepseek", name: "DeepSeek", vendor: "DeepSeek", mark: "D", a: "#7b93ff", b: "#3b52e0" },
  { id: "gemini", name: "Gemini", vendor: "Google", mark: "G", a: "#7ab1ff", b: "#3a6fe0" },
  { id: "mistral", name: "Mistral", vendor: "Mistral AI", mark: "M", a: "#ffa14a", b: "#e0540f" },
  { id: "llama", name: "Llama", vendor: "Meta", mark: "L", a: "#6aa8ff", b: "#1f5fd6" },
];

const mark = (a: string, b: string): CSSProperties => ({ "--a": a, "--b": b, color: "#fff", fontWeight: 800, fontSize: 16 }) as CSSProperties;

// Choix du modèle IA : le modèle utilisé aujourd'hui est actif ; les autres sont annoncés (« Bientôt ») et désactivés
export function AiModelPicker({ overview, bare = false }: { overview: AiOverview; bare?: boolean }) {
  const ok = overview.configured;
  return (
    <section className="flex flex-col gap-3">
      {(!bare || overview.lastError) && (
        <div className="flex flex-wrap items-center gap-3">
          {!bare && (
            <>
              <IconTile icon={Cpu} tint="#8B5CF6" size="md" />
              <div className="min-w-0 flex-1 basis-48">
                <h3 className="text-[16px] font-bold leading-tight tracking-[-0.01em]" style={{ color: theme.text }}>Modèle IA</h3>
                <p className="mt-0.5 text-[13px] leading-snug" style={{ color: theme.textMuted }}>Le modèle qui rédige les réponses de l'assistant. Choisir un autre modèle arrive bientôt.</p>
              </div>
            </>
          )}
          {overview.lastError && (
            <span className="chip bad !whitespace-normal" title={overview.lastError.message}>
              <AlertTriangle size={12} />
              {timeAgo(overview.lastError.at)} : erreur du modèle
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Modèle IA">
        {/* Modèle utilisé aujourd'hui */}
        <div
          role="radio"
          aria-checked
          className="row-s !p-3"
          style={{ background: theme.goldSoft, boxShadow: "inset 0 0 0 1.5px rgb(var(--color-gold-rgb) / 0.55)" }}
        >
          <span className="ico-tile sm" style={mark("var(--brand-1)", "var(--brand-3)")}>S</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px] font-bold" style={{ color: theme.goldDark }}>{ok ? overview.model : "SuiteFlow IA"}</b>
            <small className="block truncate text-[12px]" style={{ color: theme.textMuted }}>{ok ? `${overview.provider} · modèle actuel` : "Non configuré sur ce serveur"}</small>
          </span>
          {ok ? <span className="tr-ico ok-solid sm" title="Modèle actif"><Check strokeWidth={3} /></span> : <span className="chip warn flex-shrink-0">À configurer</span>}
        </div>

        {/* À venir : visibles, mais désactivés */}
        {COMING.map((m) => (
          <div key={m.id} role="radio" aria-checked={false} aria-disabled="true" className="row-s !cursor-not-allowed !p-3 opacity-60" title={`${m.name} : bientôt disponible`}>
            <span className="ico-tile sm" style={mark(m.a, m.b)}>{m.mark}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[13.5px] font-bold" style={{ color: theme.text }}>{m.name}</b>
              <small className="block truncate text-[12px]" style={{ color: theme.textMuted }}>{m.vendor}</small>
            </span>
            <span className="chip off flex-shrink-0 !gap-1"><Lock size={11} />Bientôt</span>
          </div>
        ))}
      </div>
    </section>
  );
}
