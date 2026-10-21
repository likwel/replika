import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeftRight, Eye, Lock, LogOut, Users } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { StateCard } from "@/components/ui/StateCard";
import { MENUS } from "@/data/menus";
import { MENU_MODULE, menuModule, useAccess } from "@/hooks/useAccess";
import { WORKSPACE_UNAVAILABLE } from "@/lib/api";
import { openSpace } from "@/lib/team.api";

const back = () => void openSpace(null);

// Bandeau sous l'en-tête : espace d'une équipe ouvert (rôle du membre), ou devenu inaccessible
export function WorkspaceBanner() {
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const w = user?.workspace;

  // Accès retiré pendant la session : la session est relue pour afficher la raison
  useEffect(() => {
    const onGone = () => void refreshUser().catch(() => {});
    window.addEventListener(WORKSPACE_UNAVAILABLE, onGone);
    return () => window.removeEventListener(WORKSPACE_UNAVAILABLE, onGone);
  }, [refreshUser]);

  if (!w || (!w.current && !w.unavailable)) return null;
  const leave = () => {
    setBusy(true);
    back();
  };

  if (w.unavailable) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-[13px] sm:px-8 lg:px-12" style={{ background: theme.amberSoft, color: theme.amber, borderBottom: `1px solid ${theme.border}` }}>
        <Lock size={15} className="flex-shrink-0" />
        <p className="min-w-0 flex-1 font-medium">{w.unavailable}</p>
        <Button size="sm" variant="soft" icon={ArrowLeftRight} onClick={leave} disabled={busy}>Revenir à mon espace</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 text-[13px] sm:px-8 lg:px-12" style={{ background: theme.goldSoft, color: theme.goldDark, borderBottom: `1px solid ${theme.border}` }}>
      <Users size={15} className="flex-shrink-0" />
      <p className="min-w-0 flex-1">
        Espace de <strong>{w.current!.space}</strong>
        <span className="hidden sm:inline"> · vous êtes membre de l'équipe ({w.current!.roleLabel})</span>
      </p>
      <button onClick={leave} disabled={busy} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold hover:bg-black/5">
        <LogOut size={13} /> Revenir à mon espace
      </button>
    </div>
  );
}

// Page d'un module : refusée si le rôle ne le permet pas ; signalée « consultation seule » si besoin
export function WorkspaceGate({ menuId, sub, onNavigate, children }: { menuId: string; sub: number; onNavigate: (id: string, sub: number) => void; children: ReactNode }) {
  const { current, canMenu, readOnly } = useAccess();
  if (!current) return <>{children}</>;
  const module = menuModule(menuId, sub);

  if (!canMenu(menuId, sub)) {
    const allowed = MENUS.filter((m) => MENU_MODULE[m.id] && canMenu(m.id));
    return (
      <StateCard
        icon={Lock}
        title="Accès non autorisé"
        badge={current.roleLabel}
        action={
          allowed.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {allowed.map((m) => (
                <Button key={m.id} size="sm" variant="ghost" icon={m.icon} onClick={() => onNavigate(m.id, 0)}>{m.label}</Button>
              ))}
            </div>
          )
        }
      >
        Votre rôle dans l'espace {current.space} ne donne pas accès à cette page. Demandez à son propriétaire de modifier vos permissions si besoin.
      </StateCard>
    );
  }

  return (
    <>
      {readOnly(module) && (
        <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textMuted }}>
          <Eye size={14} className="flex-shrink-0" />
          Consultation seule : votre rôle ({current.roleLabel}) permet de voir cette page, sans rien modifier ni envoyer.
        </div>
      )}
      {children}
    </>
  );
}
