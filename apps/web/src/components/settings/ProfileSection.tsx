import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Trash2, Loader2, Mail } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ApiError } from "@/lib/api";
import { toAvatarDataUrl } from "@/lib/image";
import { profileApi, type Profile } from "@/lib/profile.api";
import { useAuth } from "@/context/AuthContext";
import { Feedback, SettingsCard, TextField } from "./SettingsUi";

const errorOf = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

export function ProfileSection() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    profileApi.get().then(setProfile).catch(() => setLoadError(true));
  }, []);

  if (loadError) return <SettingsCard title="Profil">Impossible de charger votre profil.</SettingsCard>;
  if (!profile) return <div className="h-64 animate-pulse rounded-2xl" style={{ background: theme.bgCard }} />;

  return (
    <>
      <IdentityCard profile={profile} onChange={setProfile} />
      <EmailCard profile={profile} onChange={setProfile} />
    </>
  );
}

function IdentityCard({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const { updateUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = { name: profile.name, phone: profile.phone ?? "", companyName: profile.companyName ?? "" };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState<"save" | "photo" | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setOk(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const updated = await profileApi.update(form);
      onChange(updated);
      updateUser({ name: updated.name });
      setSaved(form);
      setOk("Profil enregistré");
    } catch (err) {
      setError(errorOf(err, "Enregistrement impossible."));
    } finally {
      setBusy(null);
    }
  };

  const setPhoto = async (avatarUrl: string | null) => {
    setBusy("photo");
    setError(null);
    setOk(null);
    try {
      const updated = await profileApi.update({ avatarUrl });
      onChange(updated);
      updateUser({ avatarUrl: updated.avatarUrl });
      setOk(avatarUrl ? "Photo mise à jour" : "Photo retirée");
    } catch (err) {
      setError(errorOf(err, "Photo non enregistrée."));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      await setPhoto(await toAvatarDataUrl(file));
    } catch (err) {
      setError(errorOf(err, "Image non prise en charge."));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <SettingsCard title="Informations du Profil" description="Visibles par vous uniquement : vos clients ne voient que le nom de vos Pages.">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="relative">
          <Avatar name={form.name || profile.name} src={profile.avatarUrl} size={72} />
          {busy === "photo" && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.35)" }}>
              <Loader2 size={20} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" icon={Camera} onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {profile.avatarUrl ? "Changer la photo" : "Ajouter une photo"}
            </Button>
            {profile.avatarUrl && (
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setPhoto(null)} disabled={busy !== null}>
                Retirer
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: theme.textMuted }}>
            JPG ou PNG, recadrée en carré · membre depuis{" "}
            {new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>

      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Nom complet" value={form.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={80} />
          <TextField label="Téléphone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+261 34 00 000 00" maxLength={30} />
          <TextField label="Entreprise" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Nom de votre activité" maxLength={100} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Feedback ok={ok} error={error} />
          <Button type="submit" size="sm" disabled={!dirty || busy !== null}>
            {busy === "save" && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function EmailCard({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const { updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setEditing(false);
    setEmail("");
    setPassword("");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await profileApi.changeEmail(email.trim(), password);
      onChange(updated);
      updateUser({ email: updated.email });
      cancel();
      setOk("Adresse e-mail modifiée : utilisez-la désormais pour vous connecter");
    } catch (err) {
      setError(errorOf(err, "Modification impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Adresse E-mail" description="Elle sert d'identifiant de connexion.">
      {!editing ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm" style={{ color: theme.text }}>
            <Mail size={15} className="flex-shrink-0" style={{ color: theme.textMuted }} />
            <span className="truncate">{profile.email}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setOk(null); }}>Modifier</Button>
          {ok && <div className="w-full"><Feedback ok={ok} /></div>}
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Nouvelle adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <TextField label="Mot de passe actuel" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" hint="Pour confirmer que c'est bien vous." />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Feedback error={error} />
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy || !email.trim() || !password}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              Changer l'e-mail
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
