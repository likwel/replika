import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, RefreshCw, Power, AlertTriangle, Facebook } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { ApiError } from "@/lib/api";
import { plural } from "@/lib/format";
import { automationApi, type AutomationSettings } from "@/lib/automation.api";
import { facebookApi } from "@/lib/facebook.api";
import { isPermissionError } from "@/lib/meta";

interface Props {
  showRulesLink?: boolean;
  onSynced?: () => void;
}

// Carte sombre : état de l'assistant, chiffres du jour, activer / synchroniser
export function AssistantCard({ showRulesLink, onSynced }: Props) {
  const nav = useNavigate();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [busy, setBusy] = useState<"toggle" | "sync" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => automationApi.settings().then(setSettings).catch(() => setSettings(null));

  useEffect(() => {
    load();
  }, []);

  const toggle = async () => {
    if (!settings) return;
    setBusy("toggle");
    try {
      setSettings(await automationApi.setEnabled(!settings.autoReplyEnabled));
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    setNotice(null);
    try {
      const r = await automationApi.sync();
      setNotice(
        r.initialized
          ? `${plural(r.initialized, "compte initialisé", "comptes initialisés")} : seuls les nouveaux messages seront traités.`
          : r.processed
            ? `${plural(r.processed, "nouveau message traité", "nouveaux messages traités")}.`
            : "Aucun nouveau message."
      );
      await load();
      onSynced?.();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Synchronisation impossible.");
    } finally {
      setBusy(null);
    }
  };

  const enabled = settings?.autoReplyEnabled ?? false;
  const stats = settings?.stats;

  return (
    <div className="rounded-xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="flex items-start gap-4">
        <div className="rounded-lg p-2.5" style={{ background: theme.goldSoft }}>
          <Bot size={22} style={{ color: theme.goldDark }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold" style={{ color: theme.text }}>Réponses automatiques</h3>
            {settings && (
              <span
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: enabled ? theme.greenSoft : theme.bg, color: enabled ? theme.green : theme.textMuted }}
              >
                <StatusDot color={enabled ? theme.greenLight : theme.textMuted} size={6} pulse={enabled} />
                {enabled ? "En ligne" : "En pause"}
              </span>
            )}
          </div>

          {stats ? (
            <p className="mt-1 text-sm" style={{ color: theme.text }}>
              {plural(stats.autoRepliedToday, "réponse automatique", "réponses automatiques")} aujourd'hui ·{" "}
              {plural(stats.suggested, "suggestion")} à valider · {plural(stats.escalated, "escaladé")}
              {stats.failed > 0 && (
                <span style={{ color: theme.red }}> · {plural(stats.failed, "échec")} d'envoi</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>Chargement…</p>
          )}
          {settings && (
            <p className="mt-1 text-[11.5px]" style={{ color: theme.textMuted }}>
              {settings.webhookConfigured ? "Jeton webhook Meta défini" : "Webhooks Meta non configurés"} ·{" "}
              {settings.pollSeconds > 0
                ? `relève automatique toutes les ${settings.pollSeconds} s`
                : "relève automatique désactivée"}{" "}
              · {settings.ai.configured ? `IA : ${settings.ai.model}` : "IA non configurée"}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {showRulesLink && (
              <Button size="sm" variant="primary" onClick={() => nav("/app/automatisation")}>
                Voir les règles
              </Button>
            )}
            <Button
              size="sm"
              variant={showRulesLink ? "ghost" : "primary"}
              icon={Power}
              onClick={toggle}
              disabled={!settings || busy !== null}
            >
              {enabled ? "Mettre en pause" : "Activer"}
            </Button>
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={sync} disabled={busy !== null}>
              {busy === "sync" ? "Synchronisation…" : "Synchroniser"}
            </Button>
          </div>
          {notice && <p className="mt-2 text-xs" style={{ color: theme.goldDark }}>{notice}</p>}

          {/* Relève en échec : sans elle, aucun commentaire n'est vu, donc aucune réponse ne part */}
          {settings && settings.syncIssues.length > 0 && (
            <div className="mt-4 rounded-lg p-3" style={{ background: theme.dangerBg, color: theme.red }}>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <AlertTriangle size={15} />
                Relève impossible sur {plural(settings.syncIssues.length, "compte")} : aucune réponse ne peut partir
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {settings.syncIssues.map((a) => (
                  <li key={a.id}>
                    <strong>{a.name}</strong> — {a.syncError}
                  </li>
                ))}
              </ul>
              {settings.syncIssues.some((a) => isPermissionError(a.syncError)) && (
                <>
                  <p className="mt-2 text-xs">
                    Facebook refuse l'accès : reconnectez Facebook et laissez <strong>toutes</strong> les autorisations
                    cochées (lecture et réponse aux commentaires, messages).
                  </p>
                  <Button size="sm" variant="primary" icon={Facebook} className="mt-2" onClick={() => facebookApi.connect()}>
                    Reconnecter Facebook
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
