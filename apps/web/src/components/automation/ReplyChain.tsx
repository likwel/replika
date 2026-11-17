import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowRight, Check, ChevronDown, Info, Plus, Power, Settings2, MessageSquareDashed, Hash, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { plural } from "@/lib/format";
import { aiApi, type AiOverview } from "@/lib/ai.api";
import type { AutomationRule } from "@/lib/automation.api";
import { ActivateAiModal } from "./ActivateAiModal";

const OPEN_KEY = "suiteflow:chainOpen";
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
};

const LANG_LABEL = { AUTO: "langue du client", MG: "malagasy", FR: "français" } as const;

interface Props {
  rules: AutomationRule[];
  onOpenAi: () => void; // onglet « Assistant IA » (réglages détaillés)
  onCreateRule: () => void;
  onCreateDefault: () => void;
  onEditRule: (rule: AutomationRule) => void; // ouvre une règle pour la modifier ou l'améliorer
}

type Tone = "ok" | "todo" | "info";

// « Comment SuiteFlow choisit sa réponse » : une suite d'instructions, dans l'ordre où SuiteFlow les suit.
// Chaque étape dit quoi faire et, en bas, où vous en êtes : coche verte (en place), triangle (à faire), info (facultatif).
export function ReplyChain({ rules, onOpenAi, onCreateRule, onCreateDefault, onEditRule }: Props) {
  const [ai, setAi] = useState<AiOverview | null>(null);
  const [open, setOpen] = useState(readOpen);
  const [activating, setActivating] = useState(false);
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {
        // choix non mémorisé : sans conséquence
      }
      return !o;
    });
  const loadAi = () => aiApi.overview().then(setAi).catch(() => setAi(null));
  useEffect(() => {
    void loadAi();
  }, []);

  const active = rules.filter((r) => r.isActive);
  const keywordRules = active.filter((r) => r.matchType !== "ANY");
  const defaultRules = active.filter((r) => r.matchType === "ANY");
  const aiAccounts = ai?.accounts.filter((a) => a.aiEnabled) ?? [];
  const languages = [...new Set(aiAccounts.map((a) => a.aiLanguage ?? "AUTO"))];

  const todo = [keywordRules.length > 0, aiAccounts.length > 0].filter((ok) => !ok).length; // l'étape 3 est facultative

  const link = (label: string, onClick: () => void, Icon: LucideIcon) => (
    <button onClick={onClick} className="inline-flex flex-shrink-0 items-center gap-1 text-[12.5px] font-bold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>
      <Icon size={13} />
      {label}
    </button>
  );

  return (
    <div>
      <button onClick={toggle} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <span className="text-[13.5px] font-bold" style={{ color: theme.text }}>Comment SuiteFlow choisit sa réponse</span>
        <span className="hidden text-[12px] sm:inline" style={{ color: theme.textMuted }}>· à chaque message reçu, dans cet ordre</span>
        {todo > 0 && <span className="chip warn !text-[11px]">{todo} à configurer</span>}
        <ChevronDown size={16} className="ml-auto transition-transform" style={{ color: theme.textMuted, transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <ol className="mt-3 grid grid-cols-1 items-stretch gap-y-1 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <Step
            n={1}
            icon={Hash}
            title="Une règle correspond ?"
            instruction="Oui : la première règle qui correspond répond au client. C'est terminé."
            tone={keywordRules.length ? "ok" : "todo"}
            status={keywordRules.length ? `${plural(keywordRules.length, "règle active", "règles actives")}, par priorité` : "Aucune règle active"}
            action={!keywordRules.length && link("Créer", onCreateRule, Plus)}
          />
          <Else />
          <Step
            n={2}
            icon={Sparkles}
            title="L'assistant IA répond ?"
            instruction="Oui : l'IA rédige la réponse à partir des infos de votre activité."
            tone={aiAccounts.length ? "ok" : "todo"}
            status={
              !ai
                ? "Chargement…"
                : !ai.configured
                  ? "Modèle IA non configuré sur ce serveur"
                  : aiAccounts.length
                    ? `${plural(aiAccounts.length, "compte")} · réponses en ${languages.map((l) => LANG_LABEL[l as keyof typeof LANG_LABEL]).join(", ")}`
                    : "Désactivé sur tous les comptes"
            }
            action={ai && (aiAccounts.length ? link("Gérer", () => setActivating(true), Settings2) : link("Activer", () => setActivating(true), Power))}
          />
          <Else />
          <Step
            n={3}
            icon={MessageSquareDashed}
            title="Une réponse par défaut ?"
            optional
            instruction="Oui : ce message d'accueil est envoyé. Sinon, le message vous attend."
            tone={defaultRules.length ? "ok" : "info"}
            status={defaultRules.length ? `« ${defaultRules[0].name} »${defaultRules.length > 1 ? ` +${defaultRules.length - 1}` : ""}` : "Aucune : le message reste dans « À traiter »"}
            action={defaultRules.length ? link("Gérer", () => onEditRule(defaultRules[0]), Settings2) : link("Créer", onCreateDefault, Plus)}
          />
        </ol>
      )}

      {activating && (
        <ActivateAiModal onClose={() => setActivating(false)} onChanged={() => void loadAi()} onOpenSettings={onOpenAi} />
      )}
    </div>
  );
}

// Trait d'union entre deux étapes : « Sinon », avec une flèche vers l'étape suivante
function Else() {
  return (
    <li className="flex items-center justify-center py-1 md:px-1 md:py-0" aria-hidden>
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] md:flex-col" style={{ color: theme.textMuted }}>
        Sinon
        <ArrowDown size={14} className="md:hidden" />
        <ArrowRight size={14} className="hidden md:block" />
      </span>
    </li>
  );
}

const STATUS_ICON: Record<Tone, { icon: LucideIcon; cls: string }> = {
  ok: { icon: Check, cls: "ok-solid" },
  todo: { icon: AlertTriangle, cls: "warn" },
  info: { icon: Info, cls: "" },
};

function Step({ n, icon: Icon, title, instruction, optional, tone, status, action }: { n: number; icon: LucideIcon; title: string; instruction: string; optional?: boolean; tone: Tone; status: string; action?: ReactNode }) {
  const s = STATUS_ICON[tone];
  return (
    <li className="row-s !flex-col !items-stretch !gap-0 !p-0 overflow-hidden">
      <div className="flex items-start gap-2.5 p-3.5">
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{n}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] font-bold leading-tight" style={{ color: theme.text }}>
            <Icon size={14} style={{ color: theme.textMuted }} className="flex-shrink-0" />
            {title}
            {optional && <span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>facultatif</span>}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{instruction}</p>
        </div>
      </div>
      {/* Statut : où vous en êtes pour cette étape */}
      <div className="mt-auto flex items-center gap-2 border-t px-3.5 py-2.5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <span className={`tr-ico ${s.cls} !h-6 !w-6`}><s.icon strokeWidth={tone === "ok" ? 3 : 2} /></span>
        <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug" style={{ color: tone === "todo" ? theme.amber : theme.text }}>{status}</span>
        {action}
      </div>
    </li>
  );
}
