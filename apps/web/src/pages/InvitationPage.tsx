import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Eye, Loader2, LogOut, Pencil, Users } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { ACCESS_LABEL, teamApi, type InvitationPreview } from "@/lib/team.api";

// Lien reçu par e-mail : rejoindre l'espace d'une équipe (connexion ou inscription avec l'adresse invitée)
export function InvitationPage() {
  const { token = "" } = useParams();
  const { user, loading, logout } = useAuth();
  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    teamApi
      .invitation(token)
      .then(setInvite)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const q = invite ? `?invitation=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.email)}` : "";
  const sameEmail = Boolean(user && invite && user.email.toLowerCase() === invite.email.toLowerCase());

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      await teamApi.acceptToken(token);
      window.location.assign("/app"); // l'espace rejoint est ouvert
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de rejoindre l'équipe.");
      setJoining(false);
    }
  };

  if (!invite) {
    return (
      <AuthShell title="Invitation" subtitle="Rejoindre une équipe sur SuiteFlow">
        {error ? (
          <>
            <Alert variant="error" className="mb-5">{error}</Alert>
            <Link to="/connexion"><Button className="w-full justify-center">Aller à la connexion</Button></Link>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: theme.textMuted }}>
            <Loader2 size={16} className="animate-spin" /> Chargement de l'invitation…
          </p>
        )}
      </AuthShell>
    );
  }

  const granted = invite.modules.filter((m) => invite.permissions[m.id]);

  return (
    <AuthShell title={`Rejoindre « ${invite.space} »`} subtitle={`${invite.ownerName} vous invite dans son équipe SuiteFlow.`}>
      <div className="mb-5 rounded-2xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-3">
          <Avatar name={invite.space} src={invite.ownerAvatarUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold" style={{ color: theme.text }}>{invite.space}</p>
            <p className="flex items-center gap-1 text-[12.5px]" style={{ color: theme.textMuted }}>
              <Users size={12} /> Rôle : {invite.roleLabel} · pour {invite.email}
            </p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1">
          {granted.map((m) => {
            const a = invite.permissions[m.id]!;
            return (
              <li key={m.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="min-w-0 truncate" style={{ color: theme.text }}>{m.label}</span>
                <span className="flex flex-shrink-0 items-center gap-1 font-medium" style={{ color: a === "write" ? theme.goldDark : theme.textMuted }}>
                  {a === "write" ? <Pencil size={11} /> : <Eye size={11} />} {ACCESS_LABEL[a]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {invite.expired ? (
        <Alert variant="warning">Cette invitation a expiré : demandez à {invite.ownerName} de vous en renvoyer une.</Alert>
      ) : loading ? (
        <p className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: theme.textMuted }} /></p>
      ) : !user ? (
        <div className="flex flex-col gap-2">
          <Link to={`/connexion${q}`}><Button className="w-full justify-center">J'ai déjà un compte : me connecter</Button></Link>
          <Link to={`/register${q}`}><Button variant="ghost" className="w-full justify-center">Créer mon compte</Button></Link>
          <p className="text-center text-[12px]" style={{ color: theme.textMuted }}>Utilisez l'adresse {invite.email} pour rejoindre l'espace.</p>
        </div>
      ) : sameEmail ? (
        <Button className="w-full justify-center" icon={joining ? Loader2 : Check} onClick={join} disabled={joining}>
          Rejoindre l'espace {invite.space}
        </Button>
      ) : (
        <>
          <Alert variant="warning" className="mb-3">
            Cette invitation est destinée à {invite.email}, mais vous êtes connecté avec {user.email}.
          </Alert>
          <Button
            variant="ghost"
            className="w-full justify-center"
            icon={LogOut}
            onClick={async () => {
              await logout();
              window.location.assign(`/connexion${q}`);
            }}
          >
            Changer de compte
          </Button>
        </>
      )}
    </AuthShell>
  );
}
