import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight, Check, Copy, Crown, Eye, Loader2, LogOut, Mail, MoreHorizontal, Pause, Pencil, Play, Send, ShieldCheck, Sparkles,
  Trash2, UserPlus, Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useAccess } from "@/hooks/useAccess";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StateCard } from "@/components/ui/StateCard";
import { FloatingMenu, MenuItem, MenuSeparator } from "@/components/ui/FloatingMenu";
import { SettingsCard } from "@/components/settings/SettingsUi";
import { swal } from "@/lib/swal";
import { timeAgo } from "@/lib/format";
import {
  ACCESS_LABEL, MODULE_SHORT, openSpace, teamApi,
  type Access, type InviteResult, type Membership, type Permissions, type RolePreset, type TeamMember, type TeamModule, type TeamOverview,
} from "@/lib/team.api";

const STATUS: Record<TeamMember["status"], { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Actif", color: theme.green, bg: theme.greenSoft },
  INVITED: { label: "Invitation envoyée", color: theme.amber, bg: theme.amberSoft },
  DISABLED: { label: "Suspendu", color: theme.textMuted, bg: theme.bg },
};

const card = { background: theme.bgCard, border: `1px solid ${theme.border}` };

// Paramètres → Équipe : mon équipe (propriétaire), espaces rejoints et invitations reçues
export function TeamSection() {
  const { current } = useAccess();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [spaces, setSpaces] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([teamApi.overview(), teamApi.memberships()])
      .then(([t, m]) => {
        setTeam(t);
        setSpaces(m);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!team || !spaces) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: theme.textMuted }}>
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {current ? <CurrentSpaceCard team={team} /> : <MyTeam team={team} onChange={load} />}
      <Spaces spaces={spaces} onChange={load} />
    </div>
  );
}

// ─── Membre dans l'espace d'un autre : ses droits ─────────────────────────────

function CurrentSpaceCard({ team }: { team: TeamOverview }) {
  const { current } = useAccess();
  const [busy, setBusy] = useState(false);
  if (!current) return null;
  return (
    <SettingsCard title={`Espace ${current.space}`} description={`Vous êtes membre de cette équipe avec le rôle ${current.roleLabel}. Pour gérer votre propre équipe, revenez à votre espace.`}>
      <PermissionSummary modules={team.modules} permissions={current.permissions} />
      <Button
        className="mt-4"
        variant="soft"
        icon={busy ? Loader2 : ArrowLeftRight}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void openSpace(null, "/app/parametres");
        }}
      >
        Revenir à mon espace
      </Button>
    </SettingsCard>
  );
}

// ─── Propriétaire : son équipe ───────────────────────────────────────────────

function MyTeam({ team, onChange }: { team: TeamOverview; onChange: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  const [invited, setInvited] = useState<InviteResult | null>(null);

  if (team.seats === 0) {
    return (
      <StateCard
        icon={Users}
        title="Travaillez en équipe"
        badge="Formule Business et plus"
        action={<Button icon={Sparkles} onClick={() => nav("/app/facturation")}>Voir les formules</Button>}
      >
        Invitez jusqu'à 5 collaborateurs avec la formule Business (illimité avec Agence) : chacun a ses propres accès, module par module, en
        consultation ou en modification, et l'historique indique qui a fait quoi. Votre formule actuelle : {team.planName}.
      </StateCard>
    );
  }

  const full = team.seats !== null && team.used >= team.seats;
  const pct = team.seats ? Math.min(100, (team.used / team.seats) * 100) : 0;

  return (
    <SettingsCard title="Mon équipe" description="Invitez des collaborateurs dans votre espace et choisissez ce que chacun peut voir ou modifier.">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm" style={{ color: theme.text }}>
            <strong className="text-base tabular-nums">{team.used}</strong>
            <span style={{ color: theme.textMuted }}> / {team.seats === null ? "illimité" : team.seats} membres · formule {team.planName}</span>
          </p>
          {team.seats !== null && (
            <div className="mt-1.5 h-1.5 max-w-xs overflow-hidden rounded-full" style={{ background: theme.border }}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(pct, team.used ? 4 : 0)}%`, background: full ? theme.amber : theme.gold }} />
            </div>
          )}
        </div>
        <Button icon={UserPlus} onClick={() => setEditing("new")} disabled={full} title={full ? "Toutes les places de la formule sont prises" : undefined}>
          Inviter un membre
        </Button>
      </div>
      {full && (
        <p className="mt-2 text-[12px]" style={{ color: theme.amber }}>
          Toutes les places de votre formule sont prises : retirez un membre{team.seats !== null ? " ou passez à la formule Agence" : ""}.
        </p>
      )}

      <ul className="mt-4 flex flex-col">
        {/* Le propriétaire, toujours en tête */}
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-1 py-3">
          <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={36} />
          <div className="min-w-0 flex-1 basis-48">
            <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: theme.text }}>
              {user?.name} <span className="text-[12px] font-normal" style={{ color: theme.textMuted }}>(vous)</span>
            </p>
            <p className="truncate text-xs" style={{ color: theme.textMuted }}>{user?.email}</p>
          </div>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
            <Crown size={11} /> Propriétaire · tous les droits
          </span>
        </li>
        {team.members.map((m) => (
          <MemberRow key={m.id} member={m} onEdit={() => setEditing(m)} onInvited={setInvited} onChange={onChange} />
        ))}
      </ul>
      {!team.members.length && (
        <p className="mt-1 rounded-xl px-4 py-6 text-center text-[13px]" style={{ background: theme.bg, color: theme.textMuted }}>
          Aucun membre pour l'instant. Invitez un collaborateur : il recevra un e-mail pour rejoindre votre espace.
        </p>
      )}

      {editing && (
        <MemberDialog
          team={team}
          member={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null);
            if (r) setInvited(r);
            onChange();
          }}
        />
      )}
      {invited && <InvitedDialog result={invited} onClose={() => setInvited(null)} />}
    </SettingsCard>
  );
}

function MemberRow({ member: m, onEdit, onInvited, onChange }: { member: TeamMember; onEdit: () => void; onInvited: (r: InviteResult) => void; onChange: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const s = m.inviteExpired ? { label: "Invitation expirée", color: theme.red, bg: theme.dangerBg } : STATUS[m.status];
  const modules = Object.keys(m.permissions).length;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setMenu(false);
    try {
      await fn();
      swal.toast({ title: done });
      onChange();
    } catch (e) {
      swal.toast({ variant: "error", title: "Action impossible", text: (e as Error).message });
    }
  };

  const remove = async () => {
    setMenu(false);
    const invite = m.status === "INVITED";
    const ok = await swal.confirm({
      title: invite ? `Annuler l'invitation de ${m.email} ?` : `Retirer ${m.name ?? m.email} de l'équipe ?`,
      text: invite ? "Le lien envoyé ne fonctionnera plus." : "Cette personne perd immédiatement l'accès à votre espace. Ce qu'elle a fait reste dans l'historique.",
      confirmText: invite ? "Annuler l'invitation" : "Retirer",
      variant: "danger",
    });
    if (ok) await act(() => teamApi.remove(m.id), invite ? "Invitation annulée" : "Membre retiré");
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-1 py-3" style={{ borderTop: `1px solid ${theme.border}`, opacity: m.status === "DISABLED" ? 0.65 : 1 }}>
      <Avatar name={m.name ?? m.email} src={m.avatarUrl} size={36} />
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium" style={{ color: theme.text }}>{m.name ?? m.email}</p>
        <p className="truncate text-xs" style={{ color: theme.textMuted }}>
          {m.name ? m.email : null}
          {m.name && " · "}
          {m.status === "ACTIVE"
            ? m.lastActiveAt
              ? `actif ${timeAgo(m.lastActiveAt)}`
              : "jamais connecté à votre espace"
            : m.status === "INVITED"
              ? `invité ${timeAgo(m.createdAt)}`
              : "accès suspendu"}
        </p>
      </div>
      <button onClick={onEdit} className="rounded-lg px-2 py-1 text-left hover:bg-black/5" title="Modifier les droits">
        <span className="block text-[13px] font-medium" style={{ color: theme.text }}>{m.roleLabel}</span>
        <span className="block text-[11.5px]" style={{ color: theme.textMuted }}>{modules} module{modules > 1 ? "s" : ""}</span>
      </button>
      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>{s.label}</span>
      <button ref={btn} onClick={() => setMenu((o) => !o)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label={`Actions sur ${m.email}`}>
        <MoreHorizontal size={16} style={{ color: theme.textMuted }} />
      </button>
      {menu && (
        <FloatingMenu anchor={btn.current} onClose={() => setMenu(false)}>
          <MenuItem icon={Pencil} label="Modifier les droits" onClick={() => { setMenu(false); onEdit(); }} />
          {m.status === "INVITED" && (
            <MenuItem
              icon={Send}
              label="Renvoyer l'invitation"
              onClick={async () => {
                setMenu(false);
                try {
                  onInvited(await teamApi.resend(m.id));
                  onChange();
                } catch (e) {
                  swal.toast({ variant: "error", title: "Envoi impossible", text: (e as Error).message });
                }
              }}
            />
          )}
          {m.status === "ACTIVE" && <MenuItem icon={Pause} label="Suspendre l'accès" onClick={() => act(() => teamApi.update(m.id, { status: "DISABLED" }), "Accès suspendu")} />}
          {m.status === "DISABLED" && <MenuItem icon={Play} label="Rétablir l'accès" onClick={() => act(() => teamApi.update(m.id, { status: "ACTIVE" }), "Accès rétabli")} />}
          <MenuSeparator />
          <MenuItem icon={Trash2} label={m.status === "INVITED" ? "Annuler l'invitation" : "Retirer de l'équipe"} danger onClick={remove} />
        </FloatingMenu>
      )}
    </li>
  );
}

// ─── Invitation et droits ────────────────────────────────────────────────────

const samePermissions = (a: Permissions, b: Permissions) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<TeamModule>;
  return [...keys].every((k) => a[k] === b[k]);
};

function MemberDialog({ team, member, onClose, onSaved }: { team: TeamOverview; member: TeamMember | null; onClose: () => void; onSaved: (r: InviteResult | null) => void }) {
  const [email, setEmail] = useState(member?.email ?? "");
  const [name, setName] = useState(member?.name ?? "");
  const initial = member?.permissions ?? team.presets[1]?.permissions ?? {};
  const [permissions, setPermissions] = useState<Permissions>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = team.presets.find((p) => samePermissions(p.permissions, permissions));
  const role = preset?.id ?? "CUSTOM";
  const count = Object.keys(permissions).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (member) {
        await teamApi.update(member.id, { role, permissions });
        swal.toast({ title: "Droits mis à jour", text: `${member.name ?? member.email} : ${preset?.label ?? "rôle personnalisé"}.` });
        onSaved(null);
      } else {
        onSaved(await teamApi.invite({ email: email.trim(), name: name.trim() || undefined, role, permissions }));
      }
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      title={member ? `Droits de ${member.name ?? member.email}` : "Inviter un membre"}
      subtitle={member ? "Les changements s'appliquent immédiatement, même si la personne est connectée." : "La personne reçoit un e-mail avec un lien pour rejoindre votre espace (valable 7 jours)."}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" icon={saving ? Loader2 : member ? Check : Send} onClick={save} disabled={saving || !count || (!member && !/^\S+@\S+\.\S+$/.test(email.trim()))}>
            {member ? "Enregistrer" : "Envoyer l'invitation"}
          </Button>
        </>
      }
    >
      {!member && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Adresse e-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborateur@exemple.com"
              autoFocus
              className="h-10 w-full rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-gold/30"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Nom (facultatif)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              maxLength={100}
              className="h-10 w-full rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-gold/30"
              style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
            />
          </label>
        </div>
      )}

      <p className="mb-2 text-[13px] font-semibold" style={{ color: theme.text }}>Rôle</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {team.presets.map((p) => (
          <PresetCard key={p.id} preset={p} active={role === p.id} onClick={() => setPermissions(p.permissions)} />
        ))}
      </div>
      {role === "CUSTOM" && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: theme.goldDark }}>
          <Pencil size={12} /> Rôle personnalisé : droits choisis module par module ci-dessous.
        </p>
      )}

      <div className="mb-2 mt-5 flex flex-wrap items-end justify-between gap-2">
        <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Droits par module</p>
        <span className="text-[11.5px]" style={{ color: theme.textMuted }}>Lecture : voir · Modification : voir, répondre, créer et modifier</span>
      </div>
      <PermissionMatrix modules={team.modules} value={permissions} onChange={setPermissions} />
      {!count && <p className="mt-2 text-[12px]" style={{ color: theme.red }}>Donnez accès à au moins un module.</p>}
      <p className="mt-3 flex items-start gap-1.5 text-[12px]" style={{ color: theme.textMuted }}>
        <ShieldCheck size={13} className="mt-px flex-shrink-0" style={{ color: theme.green }} />
        Un membre n'accède jamais à votre profil, votre mot de passe ni vos connexions personnelles, et ne peut pas gérer l'équipe.
      </p>
      {error && <Alert variant="error" className="mt-3">{error}</Alert>}
    </Modal>
  );
}

function PresetCard({ preset, active, onClick }: { preset: RolePreset; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 py-2.5 text-left transition-colors"
      style={{ background: active ? theme.goldSoft : theme.bg, border: `1.5px solid ${active ? theme.gold : theme.border}` }}
      aria-pressed={active}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold" style={{ color: active ? theme.goldDark : theme.text }}>{preset.label}</span>
        {active && <Check size={14} style={{ color: theme.goldDark }} />}
      </span>
      <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{preset.description}</span>
    </button>
  );
}

const LEVELS: Array<{ id: Access | null; label: string }> = [
  { id: null, label: "Aucun" },
  { id: "read", label: "Lecture" },
  { id: "write", label: "Modification" },
];

function PermissionMatrix({ modules, value, onChange }: { modules: TeamOverview["modules"]; value: Permissions; onChange: (p: Permissions) => void }) {
  const set = (m: TeamModule, level: Access | null) => {
    const next = { ...value };
    if (level) next[m] = level;
    else delete next[m];
    onChange(next);
  };
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${theme.border}` }}>
      {modules.map((m, i) => (
        <div key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2" style={{ borderTop: i ? `1px solid ${theme.border}` : undefined }}>
          <span className="min-w-0 flex-1 basis-48 text-[13px]" style={{ color: theme.text }}>{m.label}</span>
          <div className="flex rounded-lg p-0.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }} role="radiogroup" aria-label={m.label}>
            {LEVELS.map((l) => {
              const on = (value[m.id] ?? null) === l.id;
              return (
                <button
                  key={l.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set(m.id, l.id)}
                  className="rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors"
                  style={on ? { background: l.id === "write" ? theme.gold : theme.bgCard, color: l.id === "write" ? theme.onAccent : theme.text, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: theme.textMuted }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Lien d'invitation : envoyé par e-mail, et copiable (WhatsApp, SMS…) si l'e-mail n'est pas parti
function InvitedDialog({ result, onClose }: { result: InviteResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      swal.toast({ variant: "error", title: "Copie impossible", text: "Sélectionnez le lien et copiez-le à la main." });
    }
  };
  return (
    <Modal
      title="Invitation prête"
      subtitle={result.member.email}
      onClose={onClose}
      footer={<Button size="sm" onClick={onClose}>Terminé</Button>}
    >
      {result.emailSent ? (
        <Alert variant="success" className="mb-4">Un e-mail d'invitation a été envoyé à {result.member.email}.</Alert>
      ) : (
        <Alert variant="warning" className="mb-4">L'e-mail n'a pas pu être envoyé : partagez le lien ci-dessous avec la personne.</Alert>
      )}
      <p className="mb-1.5 text-[13px] font-semibold" style={{ color: theme.text }}>Lien d'invitation</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={result.inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-lg px-3 font-mono text-[12px] outline-none"
          style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
        />
        <Button size="sm" variant="soft" icon={copied ? Check : Copy} onClick={copy}>{copied ? "Copié" : "Copier"}</Button>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: theme.textMuted }}>
        Valable 7 jours. La personne se connecte (ou crée son compte) avec l'adresse {result.member.email}, puis rejoint votre espace en un clic.
      </p>
    </Modal>
  );
}

// ─── Espaces rejoints et invitations reçues ──────────────────────────────────

function Spaces({ spaces, onChange }: { spaces: Membership[]; onChange: () => void }) {
  const { refreshUser } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const invites = spaces.filter((s) => s.status === "INVITED");
  const joined = spaces.filter((s) => s.status !== "INVITED");
  if (!spaces.length) return null;

  const run = async (id: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(id);
    try {
      await fn();
      if (after) return after();
      await refreshUser();
      onChange();
    } catch (e) {
      swal.toast({ variant: "error", title: "Action impossible", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsCard title="Espaces où vous êtes membre" description="Les équipes que vous avez rejointes. Changez d'espace ici ou depuis le sélecteur en haut de la barre latérale.">
      <ul className="flex flex-col gap-2">
        {invites.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3" style={{ background: theme.goldSoft }}>
            <Mail size={18} className="flex-shrink-0" style={{ color: theme.goldDark }} />
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm font-semibold" style={{ color: theme.text }}>{s.ownerName} vous invite dans l'espace « {s.space} »</p>
              <p className="text-[12px]" style={{ color: theme.textMuted }}>Rôle : {s.roleLabel} · {Object.keys(s.permissions).length} modules</p>
            </div>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => run(s.id, () => teamApi.decline(s.id))}>Refuser</Button>
            <Button size="sm" icon={busy === s.id ? Loader2 : Check} disabled={busy !== null} onClick={() => run(s.id, () => teamApi.accept(s.id), () => window.location.assign("/app"))}>
              Rejoindre
            </Button>
          </li>
        ))}
        {joined.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3" style={card}>
            <Avatar name={s.space} src={s.ownerAvatarUrl} size={34} />
            <div className="min-w-0 flex-1 basis-56">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: theme.text }}>
                {s.space}
                {s.current && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: theme.greenSoft, color: theme.green }}>Ouvert</span>}
                {s.status === "DISABLED" && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: theme.bg, color: theme.textMuted }}>Accès suspendu</span>}
              </p>
              <p className="text-[12px]" style={{ color: theme.textMuted }}>{s.roleLabel} · propriétaire : {s.ownerName}</p>
              <div className="mt-1.5"><PermissionChips permissions={s.permissions} /></div>
            </div>
            {!s.current && s.status === "ACTIVE" && (
              <Button size="sm" variant="soft" icon={busy === s.id ? Loader2 : ArrowLeftRight} disabled={busy !== null} onClick={() => run(s.id, () => openSpace(s.ownerId), () => {})}>
                Ouvrir
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={LogOut}
              disabled={busy !== null}
              onClick={async () => {
                const ok = await swal.confirm({ title: `Quitter l'espace ${s.space} ?`, text: "Vous n'y aurez plus accès, sauf nouvelle invitation.", confirmText: "Quitter", variant: "danger" });
                if (ok) await run(s.id, () => teamApi.leave(s.ownerId), s.current ? () => window.location.assign("/app/parametres") : undefined);
              }}
            >
              Quitter
            </Button>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

function PermissionChips({ permissions }: { permissions: Permissions }) {
  const entries = Object.entries(permissions) as Array<[TeamModule, Access]>;
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([m, a]) => (
        <span
          key={m}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          style={{ background: a === "write" ? theme.goldSoft : theme.bg, color: a === "write" ? theme.goldDark : theme.textMuted, border: `1px solid ${theme.border}` }}
          title={ACCESS_LABEL[a]}
        >
          {a === "write" ? <Pencil size={10} /> : <Eye size={10} />} {MODULE_SHORT[m]}
        </span>
      ))}
    </span>
  );
}

function PermissionSummary({ modules, permissions }: { modules: TeamOverview["modules"]; permissions: Permissions }) {
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {modules.map((m) => {
        const a = permissions[m.id];
        return (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: theme.bg }}>
            <span className="min-w-0 truncate" style={{ color: a ? theme.text : theme.textMuted }}>{m.label}</span>
            <span className="flex-shrink-0 font-semibold" style={{ color: a === "write" ? theme.goldDark : a ? theme.text : theme.textMuted }}>
              {a ? ACCESS_LABEL[a] : "Aucun accès"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
