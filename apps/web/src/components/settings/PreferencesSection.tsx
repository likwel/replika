import { useEffect, useState } from "react";
import { LayoutDashboard, Bot, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { ApiError } from "@/lib/api";
import { notifyPermission, requestNotifyPermission, showNotification, type NotifyPermission } from "@/lib/notify";
import { profileApi, type DefaultPage, type Profile } from "@/lib/profile.api";
import { useAuth } from "@/context/AuthContext";
import { Feedback, SettingRow, SettingsCard } from "./SettingsUi";

const PAGES: Array<{ value: DefaultPage; label: string; icon: LucideIcon }> = [
  { value: "connexions", label: "Connexions", icon: LayoutDashboard },
  { value: "gestion", label: "Gestion", icon: LayoutDashboard },
  { value: "automatisation", label: "Automatisation", icon: Bot },
  { value: "statistiques", label: "Statistiques", icon: BarChart3 },
];

const PERMISSION_HINT: Record<NotifyPermission, string | null> = {
  granted: null,
  default: null,
  denied: "Votre navigateur bloque les notifications pour ce site : autorisez-les depuis l'icône à gauche de l'adresse, puis réessayez.",
  unsupported: "Ce navigateur ne prend pas en charge les notifications.",
};

export function PreferencesSection() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState<keyof Profile | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission());

  useEffect(() => {
    profileApi.get().then(setProfile).catch(() => setError("Impossible de charger vos préférences."));
  }, []);

  const save = async (patch: Partial<Pick<Profile, "autoReplyEnabled" | "defaultPage" | "desktopNotifications">>, message: string) => {
    const key = Object.keys(patch)[0] as keyof Profile;
    setSaving(key);
    setError(null);
    setOk(null);
    try {
      const updated = await profileApi.updatePreferences(patch);
      setProfile(updated);
      updateUser({ defaultPage: updated.defaultPage, desktopNotifications: updated.desktopNotifications });
      setOk(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(null);
    }
  };

  const toggleNotifications = async (on: boolean) => {
    if (on) {
      const p = await requestNotifyPermission();
      setPermission(p);
      if (p !== "granted") return;
      showNotification("Notifications activées : vous serez prévenu des messages à traiter.");
    }
    await save({ desktopNotifications: on }, on ? "Notifications activées" : "Notifications désactivées");
  };

  if (!profile) {
    return error ? <Feedback error={error} /> : <div className="h-64 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />;
  }

  return (
    <>
      <SettingsCard title="Réponses Automatiques">
        <SettingRow
          label="Activer les réponses automatiques"
          description="Interrupteur général des règles et de l'assistant IA. En pause, les commentaires et messages continuent d'arriver dans votre boîte de réception, sans réponse."
        >
          <Toggle
            checked={profile.autoReplyEnabled}
            disabled={saving !== null}
            onChange={(v) => save({ autoReplyEnabled: v }, v ? "Réponses automatiques activées" : "Réponses automatiques en pause")}
            label="Réponses automatiques"
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Alertes et Notifications">
        <SettingRow
          label="Notifications du navigateur"
          description={
            <>
              Une notification apparaît quand de nouveaux messages attendent votre validation (suggestions, escalades),
              tant que ReplyKA est ouvert dans un onglet. Le compteur de la cloche, lui, est toujours affiché.
              {PERMISSION_HINT[permission] && (
                <span className="mt-1 block" style={{ color: theme.red }}>{PERMISSION_HINT[permission]}</span>
              )}
            </>
          }
        >
          <Toggle
            checked={profile.desktopNotifications && permission === "granted"}
            disabled={saving !== null || permission === "unsupported"}
            onChange={toggleNotifications}
            label="Notifications du navigateur"
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Page d'Ouverture" description="La page affichée juste après la connexion.">
        <div className="grid grid-cols-3 gap-2">
          {PAGES.map((p) => {
            const active = profile.defaultPage === p.value;
            return (
              <button
                key={p.value}
                type="button"
                disabled={saving !== null}
                onClick={() => !active && save({ defaultPage: p.value }, `« ${p.label} » s'ouvrira après la connexion`)}
                className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-sm font-medium transition-all"
                style={{
                  background: active ? theme.goldSoft : theme.bg,
                  border: `1px solid ${active ? theme.gold : theme.border}`,
                  color: active ? theme.goldDark : theme.text,
                }}
                aria-pressed={active}
              >
                <p.icon size={20} style={{ color: active ? theme.goldDark : theme.textMuted }} />
                {p.label}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <Feedback ok={ok} error={error} />
    </>
  );
}
