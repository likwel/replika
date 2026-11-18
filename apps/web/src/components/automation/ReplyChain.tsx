import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, Check, ChevronDown, Info, Plus, Power, Settings2, MessageSquareDashed, Hash, Sparkles, SlidersHorizontal, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { plural } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { aiApi, type AiOverview } from "@/lib/ai.api";
import type { AutomationRule } from "@/lib/automation.api";
import { ActivateAiModal } from "./ActivateAiModal";

const LANG_LABEL = { AUTO: "langue du client", MG: "malagasy", FR: "français" } as const;

interface Props {
  rules: AutomationRule[];
  onOpenAi: () => void; // onglet « Assistant IA » (réglages détaillés)
  onCreateRule: () => void;
  onCreateDefault: () => void;
  onEditRule: (rule: AutomationRule) => void; // ouvre une règle pour la modifier ou l'améliorer
}

type Tone = "ok" | "todo" | "info";

// Ce qui est en place, pour les trois étapes
function chainState(rules: AutomationRule[], ai: AiOverview | null) {
  const active = rules.filter((r) => r.isActive);
  const keywordRules = active.filter((r) => r.matchType !== "ANY");
  const defaultRules = active.filter((r) => r.matchType === "ANY");
  const aiAccounts = ai?.accounts.filter((a) => a.aiEnabled) ?? [];
  const todo = [keywordRules.length > 0, ai === null || aiAccounts.length > 0].filter((ok) => !ok).length; // l'étape 3 est facultative
  return { keywordRules, defaultRules, aiAccounts, todo };
}

// Bouton « Comment ça marche ? » : ouvre dans une fenêtre l'ordre dans lequel SuiteFlow choisit sa réponse
export function ReplyChainButton(props: Props) {
  const [ai, setAi] = useState<AiOverview | null>(null);
  const [open, setOpen] = useState(false);
  const loadAi = () => aiApi.overview().then(setAi).catch(() => setAi(null));
  useEffect(() => {
    void loadAi();
  }, []);
  const { todo } = chainState(props.rules, ai);
  // Une action de la fenêtre ouvre souvent un autre écran : on la referme d'abord
  const then = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    setOpen(false);
    fn(...a);
  };
  return (
    <>
      <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setOpen(true)} title="Régler l'ordre des réponses : règles, assistant IA, réponse par défaut">
        Configurer
        {todo > 0 && <span className="chip warn !px-1.5 !py-0 !text-[10.5px]">{todo}</span>}
      </Button>
      {open && (
        <Modal
          title="Configurer vos réponses"
          subtitle="SuiteFlow suit ces étapes, dans cet ordre, à chaque message reçu."
          size="lg"
          onClose={() => setOpen(false)}
          footer={<Button icon={X} size="sm" onClick={() => setOpen(false)}>Fermer</Button>}
        >
          <ReplyChain
            rules={props.rules}
            ai={ai}
            onReloadAi={() => void loadAi()}
            onOpenAi={then(props.onOpenAi)}
            onCreateRule={then(props.onCreateRule)}
            onCreateDefault={then(props.onCreateDefault)}
            onEditRule={then(props.onEditRule)}
          />
        </Modal>
      )}
    </>
  );
}

// Les trois étapes, dans l'ordre où SuiteFlow les suit : chacune se déplie, avec son statut en icône
function ReplyChain({ rules, ai, onReloadAi, onOpenAi, onCreateRule, onCreateDefault, onEditRule }: Props & { ai: AiOverview | null; onReloadAi: () => void }) {
  const [activating, setActivating] = useState(false);
  const [openSteps, setOpenSteps] = useState<Set<number> | null>(null); // null : dépliées = celles à configurer
  const { keywordRules, defaultRules, aiAccounts } = chainState(rules, ai);
  const languages = [...new Set(aiAccounts.map((a) => a.aiLanguage ?? "AUTO"))];

  const link = (label: string, onClick: () => void, Icon: LucideIcon) => (
    <button onClick={onClick} className="inline-flex flex-shrink-0 items-center gap-1 text-[12.5px] font-bold underline-offset-2 hover:underline" style={{ color: theme.goldDark }}>
      <Icon size={13} />
      {label}
    </button>
  );

  // Les trois étapes, dans l'ordre où SuiteFlow les suit
  const steps: StepData[] = [
    {
      n: 1,
      icon: Hash,
      title: "Une règle correspond ?",
      instruction: "Oui : la première règle qui correspond répond au client. C'est terminé.",
      tone: keywordRules.length ? "ok" : "todo",
      status: keywordRules.length ? `${plural(keywordRules.length, "règle active", "règles actives")}, par priorité` : "Aucune règle active",
      action: keywordRules.length ? null : link("Créer une règle", onCreateRule, Plus),
    },
    {
      n: 2,
      icon: Sparkles,
      title: "L'assistant IA répond ?",
      instruction: "Oui : l'IA rédige la réponse à partir des infos de votre activité.",
      tone: !ai ? "info" : aiAccounts.length ? "ok" : "todo", // pendant le chargement : neutre, pour ne pas déplier à tort
      status: !ai
        ? "Chargement…"
        : !ai.configured
          ? "Modèle IA non configuré sur ce serveur"
          : aiAccounts.length
            ? `${plural(aiAccounts.length, "compte")} · réponses en ${languages.map((l) => LANG_LABEL[l as keyof typeof LANG_LABEL]).join(", ")}`
            : "Désactivé sur tous les comptes",
      action: ai && (aiAccounts.length ? link("Gérer", () => setActivating(true), Settings2) : link("Activer l'assistant", () => setActivating(true), Power)),
    },
    {
      n: 3,
      icon: MessageSquareDashed,
      title: "Une réponse par défaut ?",
      optional: true,
      instruction: "Oui : ce message d'accueil est envoyé. Sinon, le message vous attend dans « À traiter ».",
      tone: defaultRules.length ? "ok" : "info",
      status: defaultRules.length ? `« ${defaultRules[0].name} »${defaultRules.length > 1 ? ` +${defaultRules.length - 1}` : ""}` : "Aucune : le message reste dans « À traiter »",
      action: defaultRules.length ? link("Gérer", () => onEditRule(defaultRules[0]), Settings2) : link("Créer une réponse", onCreateDefault, Plus),
    },
  ];

  // Par défaut, seules les étapes à configurer sont dépliées ; dès qu'on clique, le choix de l'utilisateur prime
  const isOpen = (st: StepData) => (openSteps ? openSteps.has(st.n) : st.tone === "todo");
  const toggleStep = (st: StepData) => {
    const next = new Set(openSteps ?? steps.filter((x) => x.tone === "todo").map((x) => x.n));
    if (next.has(st.n)) next.delete(st.n);
    else next.add(st.n);
    setOpenSteps(next);
  };

  return (
    <div>
      <ol className="flex flex-col">
        {steps.map((st, i) => {
          const m = STATUS_ICON[st.tone];
          const expanded = isOpen(st);
          return (
            <li key={st.n}>
              <div className="overflow-hidden rounded-2xl" style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                <button type="button" onClick={() => toggleStep(st)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                  <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold" style={{ background: theme.goldSoft, color: theme.goldDark }}>{st.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] font-bold leading-tight" style={{ color: theme.text }}>
                      <st.icon size={14} style={{ color: theme.textMuted }} className="flex-shrink-0" />
                      {st.title}
                      {st.optional && <span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>facultatif</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] leading-snug" style={{ color: st.tone === "todo" ? theme.amber : theme.textMuted }}>{st.status}</span>
                  </span>
                  {/* Statut : coche verte (configuré), triangle (à configurer), info (facultatif non configuré) */}
                  <span className={`tr-ico ${m.cls} !h-6 !w-6 flex-shrink-0`} title={m.label} aria-label={m.label}><m.icon strokeWidth={st.tone === "ok" ? 3 : 2} /></span>
                  <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: expanded ? "rotate(180deg)" : undefined }} />
                </button>
                {expanded && (
                  <div className="animate-fade-in flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3.5 py-3 pl-[3.35rem]" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                    <p className="min-w-0 flex-1 basis-60 text-[12.5px] leading-snug" style={{ color: theme.textMuted }}>{st.instruction}</p>
                    {st.action}
                  </div>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center gap-2 py-1 pl-[1.65rem]" aria-hidden>
                  <span className="h-4 w-px" style={{ background: "var(--line-2)" }} />
                  <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: theme.textMuted }}>
                    Sinon <ArrowDown size={11} />
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {activating && (
        <ActivateAiModal onClose={() => setActivating(false)} onChanged={onReloadAi} onOpenSettings={onOpenAi} />
      )}
    </div>
  );
}

const STATUS_ICON: Record<Tone, { icon: LucideIcon; cls: string; label: string }> = {
  ok: { icon: Check, cls: "ok-solid", label: "Configuré" },
  todo: { icon: AlertTriangle, cls: "warn", label: "À configurer" },
  info: { icon: Info, cls: "", label: "Facultatif, non configuré" },
};

interface StepData {
  n: number;
  icon: LucideIcon;
  title: string;
  instruction: string;
  optional?: boolean;
  tone: Tone;
  status: string;
  action?: ReactNode;
}
