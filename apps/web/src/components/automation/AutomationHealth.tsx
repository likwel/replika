import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Facebook, Loader2, Plus, Power, RefreshCw, Sparkles, XCircle, Activity } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ReconnectDialog } from "@/components/connections/ReconnectDialog";
import { accountApi } from "@/lib/account.api";
import { automationApi, type Diagnostic, type HealthCheck } from "@/lib/automation.api";

interface Props {
  onCreateRule: (channel: "COMMENT" | "DIRECT") => void;
  onOpenAi: () => void;
  refreshKey?: number; // règles modifiées : nouveau diagnostic
}

const STATUS = {
  ok: { label: "Opérationnel", color: theme.green, bg: theme.greenSoft },
  warning: { label: "À compléter", color: theme.amber, bg: theme.amberSoft },
  blocked: { label: "Bloqué", color: theme.red, bg: "#FDECEC" },
} as const;
const ORDER = { blocked: 0, warning: 1, ok: 2 };

// Ce qui empêche réellement une réponse automatique, compte par compte, avec l'action pour y remédier
export function AutomationHealth({ onCreateRule, onOpenAi, refreshKey }: Props) {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState<string | null | undefined>(undefined);

  const load = () => {
    setLoading(true);
    automationApi
      .diagnostic()
      .then((d) => {
        setDiag(d);
        // Le premier compte à corriger est déplié d'office
        setOpen((cur) => cur ?? [...d.accounts].sort((a, b) => ORDER[a.status] - ORDER[b.status]).find((a) => a.status !== "ok")?.id ?? null);
      })
      .catch(() => setDiag(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshKey]);

  const act = async (check: HealthCheck, accountId: string, name: string) => {
    if (check.action === "reconnect") setReconnect(name);
    else if (check.action === "create_rule") onCreateRule(check.id === "direct" ? "DIRECT" : "COMMENT");
    else if (check.action === "enable_ai") onOpenAi();
    else if (check.action === "activate") {
      await accountApi.toggle(accountId, true);
      load();
    }
  };

  const ACTION_LABEL: Record<NonNullable<HealthCheck["action"]>, { label: string; icon: typeof Plus }> = {
    reconnect: { label: "Reconnecter", icon: Facebook },
    create_rule: { label: "Créer une règle", icon: Plus },
    enable_ai: { label: "Activer l'IA", icon: Sparkles },
    activate: { label: "Activer", icon: Power },
    resume: { label: "Reprendre", icon: Power },
  };

  if (!diag) {
    return <div className="h-28 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />;
  }

  const accounts = [...diag.accounts].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const working = accounts.filter((a) => a.status === "ok").length;
  const blocked = accounts.filter((a) => a.status === "blocked");

  return (
    <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${blocked.length ? `${theme.red}40` : theme.border}` }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Activity size={18} style={{ color: blocked.length ? theme.red : theme.gold }} />
        <Title className="flex-1 text-base">État de l'Automatisation</Title>
        <button onClick={load} className="rounded-lg p-1.5 hover:bg-black/5" title="Relancer le diagnostic" aria-label="Relancer le diagnostic">
          {loading ? <Loader2 size={15} className="animate-spin" style={{ color: theme.textMuted }} /> : <RefreshCw size={15} style={{ color: theme.textMuted }} />}
        </button>
      </div>

      <p className="text-sm" style={{ color: theme.text }}>
        {accounts.length === 0
          ? "Aucun compte connecté : ajoutez vos Pages depuis Connexions."
          : working === accounts.length
            ? "Tout est prêt : les nouveaux commentaires et messages reçoivent une réponse automatique."
            : `${working} compte${working > 1 ? "s" : ""} sur ${accounts.length} répond${working > 1 ? "ent" : ""} automatiquement.${blocked.length ? ` ${blocked.length} bloqué${blocked.length > 1 ? "s" : ""} : Facebook ne donne plus l'accès.` : ""}`}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold"
          style={diag.autoReplyEnabled ? { background: theme.greenSoft, color: theme.green } : { background: "#FDECEC", color: theme.red }}
        >
          <StatusDot color={diag.autoReplyEnabled ? theme.green : theme.red} size={6} pulse={diag.autoReplyEnabled} />
          Réponses automatiques {diag.autoReplyEnabled ? "en ligne" : "en pause"}
        </span>
        <span className="rounded-full px-2 py-0.5" style={{ background: theme.bg, color: theme.textMuted }}>
          {diag.sync.mode === "webhook" ? "Réception instantanée (webhooks)" : `Relève toutes les ${diag.sync.pollSeconds} s`}
        </span>
        <span className="rounded-full px-2 py-0.5" style={{ background: theme.bg, color: diag.ai.configured ? theme.textMuted : "#b45309" }}>
          {diag.ai.configured ? `IA : ${diag.ai.provider}` : "IA non configurée (clé gratuite : AI_API_KEY)"}
        </span>
        <span className="rounded-full px-2 py-0.5" style={{ background: theme.bg, color: theme.textMuted }}>
          {diag.rules.active} règle{diag.rules.active > 1 ? "s" : ""} active{diag.rules.active > 1 ? "s" : ""} · {diag.rules.autoSend} en envoi auto
        </span>
      </div>

      {diag.brokenRules.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "#FEF3C7", color: "#92400e" }}>
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <span>
            {diag.brokenRules.map((r) => `« ${r.name} » ne vise que ${r.account}`).join(" · ")} — ce compte n'est plus utilisable : la règle ne se
            déclenchera pas. Reconnectez-le, ou modifiez la règle pour « Tous les comptes ».
          </span>
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {accounts.map((a) => {
          const status = STATUS[a.status];
          const failing = a.checks.filter((c) => !c.ok || c.warn);
          const expanded = open === a.id;
          return (
            <li key={a.id} className="rounded-xl" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <button onClick={() => setOpen(expanded ? null : a.id)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={expanded}>
                <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" style={{ color: theme.text }}>{a.name}</span>
                  <span className="block truncate text-[11px]" style={{ color: theme.textMuted }}>
                    {failing.length ? failing[0].detail : "Relève, autorisations et réponses : tout fonctionne."}
                  </span>
                </span>
                <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                <ChevronDown size={15} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: expanded ? "rotate(180deg)" : undefined }} />
              </button>
              {expanded && (
                <ul className="flex flex-col gap-1.5 border-t px-3 py-3" style={{ borderColor: theme.border }}>
                  {a.checks.map((c) => {
                    const Icon = c.ok && !c.warn ? CheckCircle2 : c.ok ? AlertTriangle : XCircle;
                    const color = c.ok && !c.warn ? theme.green : c.ok ? theme.amber : theme.red;
                    const action = c.action ? ACTION_LABEL[c.action] : null;
                    return (
                      <li key={c.id} className="flex flex-wrap items-start gap-2">
                        <Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color }} />
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="text-xs font-medium" style={{ color: theme.text }}>{c.label}</p>
                          <p className="text-[11px]" style={{ color: theme.textMuted }}>{c.detail}</p>
                        </div>
                        {action && (!c.ok || c.warn) && (
                          <Button size="sm" variant={c.action === "reconnect" ? "danger" : "soft"} icon={action.icon} onClick={() => act(c, a.id, a.name)}>
                            {action.label}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {reconnect !== undefined && <ReconnectDialog accountName={reconnect ?? undefined} onClose={() => setReconnect(undefined)} />}
    </div>
  );
}
