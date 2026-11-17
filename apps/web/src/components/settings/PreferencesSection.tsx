import { useEffect, useState } from "react";
import { LayoutDashboard, LayoutGrid, Bot, BarChart3, Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import type { ThemePref } from "@/lib/themePref";
import { FONT_OPTIONS, applyFont, readFont, type FontPref } from "@/lib/fontPref";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { ApiError } from "@/lib/api";
import { notifyPermission, requestNotifyPermission, showNotification, type NotifyPermission } from "@/lib/notify";
import { profileApi, type AccentTheme, type DefaultPage, type Profile } from "@/lib/profile.api";
import { useAuth } from "@/context/AuthContext";
import { Feedback, SettingRow, SettingsCard } from "./SettingsUi";
import { swal } from "@/lib/swal";

// Connexions n'en fait pas partie : le serveur ne l'accepte pas comme page d'ouverture
const PAGES: Array<{ value: DefaultPage; label: string; icon: LucideIcon }> = [
  { value: "tableau-de-bord", label: "Tableau de bord", icon: LayoutGrid },
  { value: "gestion", label: "Publications et messages", icon: LayoutDashboard },
  { value: "automatisation", label: "Pipelines", icon: Bot },
  { value: "statistiques", label: "Performances", icon: BarChart3 },
];

const ACCENTS: Array<{ value: AccentTheme; label: string; swatch: string }> = [
  // La valeur « whatsapp » reste celle enregistrée en base (API inchangée) ; elle porte l'orange pr.social
  { value: "whatsapp", label: "Orange", swatch: "linear-gradient(135deg, #ff8a3d, #f05a1a 48%, #dc2626)" },
  // « classic » : valeur enregistrée en base, elle porte désormais le vert (ancien accent par défaut)
  { value: "classic", label: "Vert", swatch: "linear-gradient(135deg, #25D366, #00A884 48%, #008069)" },
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
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission());
  const [font, setFont] = useState<FontPref>(readFont);
  const { pref: themePref, choose: chooseTheme } = useThemeToggle();

  useEffect(() => {
    profileApi.get().then(setProfile).catch(() => setError("Impossible de charger vos préférences."));
  }, []);

  const save = async (
    patch: Partial<Pick<Profile, "autoReplyEnabled" | "defaultPage" | "desktopNotifications" | "darkMode" | "accentTheme">>,
    message: string,
  ) => {
    const key = Object.keys(patch)[0] as keyof Profile;
    setSaving(key);
    setError(null);
    try {
      const updated = await profileApi.updatePreferences(patch);
      setProfile(updated);
      updateUser({
        defaultPage: updated.defaultPage,
        desktopNotifications: updated.desktopNotifications,
        darkMode: updated.darkMode,
        accentTheme: updated.accentTheme,
      });
      swal.toast({ title: message });
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
    return error ? <Feedback error={error} /> : <div className="h-64 animate-pulse rounded-2xl" style={{ background: theme.bg }} />;
  }

  return (
    <>
      <SettingsCard title="Réponses Automatiques" description="Active ou met en pause les règles et l'assistant IA sur tous vos comptes.">
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

      <SettingsCard title="Apparence" description="Couleur d'accent et mode d'affichage de SuiteFlow.">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-0.5 text-[13px] font-semibold" style={{ color: theme.text }}>Thème</p>
            <p className="mb-2 text-xs" style={{ color: theme.textMuted }}>
              Automatique suit l'apparence de votre appareil (clair le jour, sombre la nuit si vous l'avez réglé ainsi). Ce choix vaut pour cet appareil.
            </p>
            <div className="max-w-md">
              <Segmented
                options={[
                  { value: "auto" as ThemePref, label: "Automatique", icon: Monitor },
                  { value: "light" as ThemePref, label: "Clair", icon: Sun },
                  { value: "dark" as ThemePref, label: "Sombre", icon: Moon },
                ]}
                value={themePref}
                onChange={chooseTheme}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold" style={{ color: theme.text }}>Couleur d'accent</p>
            <div className="grid grid-cols-2 gap-2">
              {ACCENTS.map((a) => {
                const active = profile.accentTheme === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    disabled={saving !== null}
                    onClick={() => !active && save({ accentTheme: a.value }, `Accent « ${a.label} » appliqué`)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium transition-all"
                    style={{
                      background: active ? theme.goldSoft : theme.bg,
                      border: `1px solid ${active ? theme.gold : theme.border}`,
                      color: active ? theme.goldDark : theme.text,
                    }}
                    aria-pressed={active}
                  >
                    <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ background: a.swatch }} />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Police du texte : réglage de cet appareil (comme sur Karama-Ko), appliqué aussitôt */}
          <div>
            <p className="mb-0.5 text-[13px] font-semibold" style={{ color: theme.text }}>Police du texte</p>
            <p className="mb-2 text-xs" style={{ color: theme.textMuted }}>Appliquée tout de suite et mémorisée sur cet appareil.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FONT_OPTIONS.map((f) => {
                const on = font === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      if (on) return;
                      setFont(f.value);
                      applyFont(f.value);
                      swal.toast({ title: `Police « ${f.label} » appliquée` });
                    }}
                    className="flex flex-col items-start gap-1 rounded-xl px-3.5 py-3 text-left transition-all"
                    style={{
                      background: on ? theme.goldSoft : theme.bg,
                      border: `1px solid ${on ? theme.gold : theme.border}`,
                      color: on ? theme.goldDark : theme.text,
                    }}
                    aria-pressed={on}
                  >
                    <span className="text-[26px] font-extrabold leading-none tracking-[-0.02em]" style={{ fontFamily: f.sample }}>Aa</span>
                    <span className="text-[13px] font-semibold" style={{ fontFamily: f.body }}>{f.label}</span>
                    <span className="text-[11.5px] font-normal leading-snug" style={{ color: theme.textMuted, fontFamily: f.body }}>{f.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Alertes et Notifications" description="Soyez prévenu quand des messages attendent votre validation.">
        <SettingRow
          label="Notifications du navigateur"
          description={
            <>
              Une notification apparaît quand de nouveaux messages attendent votre validation (suggestions, escalades),
              tant que SuiteFlow est ouvert dans un onglet. Le compteur de la cloche, lui, est toujours affiché.
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

      <Feedback error={error} />
    </>
  );
}
