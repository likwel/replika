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
    <div className="rounded-2xl p-5 text-white" style={{ background: theme.bgDark }}>
      <div className="flex items-start gap-4">
        <div className="rounded-xl p-3" style={{ background: "rgba(229,172,95,0.15)" }}>
          <Bot size={24} style={{ color: theme.goldLight }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Réponses automatiques</h3>
            {settings && (
              <span
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: enabled ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.08)",
                  color: enabled ? theme.greenLight : "#FFFFFF99",
                }}
              >
                <StatusDot color={enabled ? theme.greenLight : "#FFFFFF66"} size={6} pulse={enabled} />
                {enabled ? "En ligne" : "En pause"}
              </span>
            )}
          </div>

          {stats ? (
            <p className="mt-1 text-sm opacity-80">
              {plural(stats.autoRepliedToday, "réponse automatique", "réponses automatiques")} aujourd'hui ·{" "}
              {plural(stats.suggested, "suggestion")} à valider · {plural(stats.escalated, "escaladé")}
              {stats.failed > 0 && (
                <span style={{ color: "#F5A097" }}> · {plural(stats.failed, "échec")} d'envoi</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm opacity-60">Chargement…</p>
          )}
          {settings && (
            <p className="mt-1 text-[11px] opacity-50">
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
              className={showRulesLink ? "!text-white !border-white/20" : ""}
              onClick={toggle}
              disabled={!settings || busy !== null}
            >
              {enabled ? "Mettre en pause" : "Activer"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              className="!text-white !border-white/20"
              onClick={sync}
              disabled={busy !== null}
            >
              {busy === "sync" ? "Synchronisation…" : "Synchroniser"}
            </Button>
          </div>
          {notice && <p className="mt-2 text-xs" style={{ color: theme.goldLight }}>{notice}</p>}

          {/* Relève en échec : sans elle, aucun commentaire n'est vu, donc aucune réponse ne part */}
          {settings && settings.syncIssues.length > 0 && (
            <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(192,57,43,0.18)", border: "1px solid rgba(245,160,151,0.35)" }}>
              <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#F5A097" }}>
                <AlertTriangle size={15} />
                Relève impossible sur {plural(settings.syncIssues.length, "compte")} : aucune réponse ne peut partir
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs opacity-90">
                {settings.syncIssues.map((a) => (
                  <li key={a.id}>
                    <strong>{a.name}</strong> — {a.syncError}
                  </li>
                ))}
              </ul>
              {settings.syncIssues.some((a) => isPermissionError(a.syncError)) && (
                <>
                  <p className="mt-2 text-xs opacity-90">
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
