import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Check } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { aiApi, type AiAccount, type AiOverview } from "@/lib/ai.api";
import { swal } from "@/lib/swal";

interface Props {
  onClose: () => void;
  onChanged: () => void; // un compte a été activé ou désactivé : l'étape se met à jour
  onOpenSettings: () => void; // langue, consignes, canaux : l'onglet « Assistant IA »
}

const LANG = { AUTO: "dans la langue du client", FR: "en français", MG: "en malagasy" } as const;

// Activation rapide de l'assistant IA : un interrupteur par compte, enregistré aussitôt
export function ActivateAiModal({ onClose, onChanged, onOpenSettings }: Props) {
  const [overview, setOverview] = useState<AiOverview | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    aiApi.overview().then(setOverview).catch(() => setError(true));
  }, []);

  const toggle = async (a: AiAccount, on: boolean) => {
    if (!overview) return;
    const set = (patch: Partial<AiAccount>) => setOverview({ ...overview, accounts: overview.accounts.map((x) => (x.id === a.id ? { ...x, ...patch } : x)) });
    set({ aiEnabled: on }); // affichage immédiat, retour arrière en cas d'échec
    setBusy(a.id);
    try {
      await aiApi.updateAccount(a.id, { aiEnabled: on });
      onChanged();
    } catch (e) {
      set({ aiEnabled: !on });
      swal.toast({ variant: "error", title: "Réglage non enregistré", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const accounts = overview?.accounts.filter((a) => a.platform !== "TIKTOK") ?? [];
  const enabled = accounts.filter((a) => a.aiEnabled).length;

  return (
    <Modal
      title="Activer l'assistant IA"
      subtitle="Quand aucune règle ne correspond, l'IA rédige la réponse à votre place."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" icon={ExternalLink} onClick={() => { onClose(); onOpenSettings(); }}>Langue et consignes</Button>
          <Button icon={Check} size="sm" onClick={onClose}>Terminé</Button>
        </>
      }
    >
      {error ? (
        <p className="row-s text-[13px]" style={{ color: theme.red }}><AlertTriangle size={15} className="flex-shrink-0" />Impossible de charger les comptes.</p>
      ) : !overview ? (
        <div className="flex flex-col gap-2"><span className="sk h-14 !rounded-[14px]" /><span className="sk h-14 !rounded-[14px]" /></div>
      ) : (
        <>
          {!overview.configured && (
            <p className="row-s mb-3 !items-start" style={{ background: "var(--color-amberSoft)" }}>
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: theme.amber }} />
              <span className="text-[12.5px] leading-snug" style={{ color: theme.text }}>
                Le modèle IA n'est pas encore configuré sur ce serveur : vos choix sont enregistrés et s'appliqueront dès qu'il le sera.
              </span>
            </p>
          )}
          {accounts.length === 0 ? (
            <p className="row-s text-[13px]" style={{ color: theme.textMuted }}>Aucun compte associé : associez une Page ou un compte Instagram pour activer l'assistant.</p>
          ) : (
            <>
              <p className="mb-2 text-[12.5px]" style={{ color: theme.textMuted }}>{enabled} compte{enabled > 1 ? "s" : ""} sur {accounts.length} avec l'assistant activé</p>
              <ul className="stagger flex flex-col gap-2">
                {accounts.map((a) => (
                  <li key={a.id} className="row-s">
                    <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform as "FACEBOOK" | "INSTAGRAM"} size={36} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{a.name}</b>
                      <small className="block text-[12px]" style={{ color: theme.textMuted }}>
                        {a.aiEnabled ? `Répond ${LANG[(a.aiLanguage ?? "AUTO") as keyof typeof LANG]}${a.aiAutoSend ? "" : " · vous validez avant l'envoi"}` : "Assistant désactivé"}
                      </small>
                    </span>
                    <Toggle checked={a.aiEnabled} onChange={(v) => void toggle(a, v)} disabled={busy === a.id} label={`Assistant IA sur ${a.name}`} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
