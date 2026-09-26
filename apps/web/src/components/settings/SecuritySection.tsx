import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, LogIn, KeyRound, Mail, UserPlus, MonitorSmartphone, ShieldCheck, Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { describeDevice, formatDateTime } from "@/lib/format";
import { profileApi, type SecurityEvent } from "@/lib/profile.api";
import { useAuth } from "@/context/AuthContext";
import { Feedback, SettingsCard, TextField } from "./SettingsUi";

const errorOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

// Adresses de la machine elle-même (serveur en local) : plus parlant qu'un « ::1 »
const displayIp = (ip: string) =>
  /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip) ? "cet ordinateur" : ip.replace(/^::ffff:/, "");

const EVENT_META: Record<SecurityEvent["action"], { label: string; icon: LucideIcon }> = {
  LOGIN: { label: "Connexion", icon: LogIn },
  REGISTER: { label: "Création du compte", icon: UserPlus },
  PASSWORD_CHANGED: { label: "Mot de passe modifié", icon: KeyRound },
  PASSWORD_RESET: { label: "Mot de passe réinitialisé", icon: KeyRound },
  EMAIL_CHANGED: { label: "Adresse e-mail modifiée", icon: Mail },
  LOGOUT_ALL: { label: "Autres appareils déconnectés", icon: MonitorSmartphone },
};

export function SecuritySection() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshActivity = () => setRefreshKey((k) => k + 1);
  return (
    <>
      <PasswordCard onDone={refreshActivity} />
      <SessionsCard refreshKey={refreshKey} onDone={refreshActivity} />
      <DeleteAccountCard />
    </>
  );
}

function PasswordCard({ onDone }: { onDone: () => void }) {
  const empty = { current: "", next: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const valid = form.current && form.next.length >= 8 && form.next === form.confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await profileApi.changePassword(form.current, form.next);
      setForm(empty);
      setOk(res.message);
      onDone();
    } catch (err) {
      setError(errorOf(err, "Modification impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Mot de Passe" description="Changer de mot de passe déconnecte vos autres appareils ; vous restez connecté ici.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
            hint="8 caractères minimum ; une phrase courte est plus sûre qu'un mot compliqué."
          />
          <TextField
            label="Confirmation"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            hint={mismatch ? "Les deux mots de passe ne correspondent pas." : undefined}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Feedback ok={ok} error={error} />
          <Button type="submit" size="sm" disabled={!valid || busy}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function SessionsCard({ refreshKey, onDone }: { refreshKey: number; onDone: () => void }) {
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profileApi.activity().then(setEvents).catch(() => setEvents([]));
  }, [refreshKey]);

  const logoutOthers = async () => {
    if (!window.confirm("Déconnecter tous vos autres appareils ? Vous resterez connecté sur celui-ci.")) return;
    setBusy(true);
    setError(null);
    try {
      setOk((await profileApi.logoutOthers()).message);
      onDone();
    } catch (err) {
      setError(errorOf(err, "Action impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Sessions et Activité" description="Les 10 derniers événements de sécurité de votre compte.">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl p-3.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
        <ShieldCheck size={18} style={{ color: theme.gold }} />
        <p className="flex-1 text-xs" style={{ color: theme.textMuted }}>
          Un appareil inconnu dans la liste ? Déconnectez-le, puis changez votre mot de passe.
        </p>
        <Button size="sm" variant="ghost" icon={MonitorSmartphone} onClick={logoutOthers} disabled={busy}>
          Déconnecter les autres appareils
        </Button>
      </div>
      <Feedback ok={ok} error={error} />

      {events === null ? (
        <div className="h-24 animate-pulse rounded-xl" style={{ background: theme.bg }} />
      ) : events.length === 0 ? (
        <p className="text-sm" style={{ color: theme.textMuted }}>Aucun événement enregistré.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: theme.border }}>
          {events.map((ev) => {
            const meta = EVENT_META[ev.action];
            const Icon = meta?.icon ?? LogIn;
            return (
              <li key={ev.id} className="flex items-start gap-3 py-2.5" style={{ borderColor: theme.border }}>
                <span className="mt-0.5 rounded-lg p-1.5" style={{ background: theme.goldSoft }}>
                  <Icon size={14} style={{ color: theme.goldDark }} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: theme.text }}>
                    {meta?.label ?? ev.action}
                    {ev.action === "EMAIL_CHANGED" && ev.meta?.to && (
                      <span className="font-normal" style={{ color: theme.textMuted }}> → {ev.meta.to}</span>
                    )}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: theme.textMuted }}>
                    {formatDateTime(ev.createdAt)}
                    {ev.meta?.ua !== undefined && ` · ${describeDevice(ev.meta?.ua)}`}
                    {ev.meta?.ip && ` · ${displayIp(ev.meta.ip)}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
}

function DeleteAccountCard() {
  const { clearUser } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await profileApi.remove(password, confirm);
      clearUser();
      nav("/", { replace: true });
    } catch (err) {
      setError(errorOf(err, "Suppression impossible."));
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      danger
      title="Supprimer mon compte"
      description="Suppression définitive de votre compte ReplyKA : Pages liées, règles, messages et historique. Vos Pages Facebook et Instagram elles-mêmes ne sont pas touchées."
    >
      {!open ? (
        <Button size="sm" variant="danger" icon={Trash2} onClick={() => setOpen(true)}>Supprimer mon compte…</Button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Mot de passe" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <TextField label="Tapez SUPPRIMER pour confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Feedback error={error} />
            <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null); }}>Annuler</Button>
            <Button type="submit" size="sm" variant="danger" disabled={busy || !password || confirm !== "SUPPRIMER"}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              Supprimer définitivement
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
