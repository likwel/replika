import { useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Mail, Pencil, Users } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { FloatingMenu, MenuSeparator } from "@/components/ui/FloatingMenu";
import { openSpace } from "@/lib/team.api";
import { swal } from "@/lib/swal";

interface Props {
  compact?: boolean; // rail d'icônes : seul l'avatar de l'espace ouvert
  onOpenTeam: () => void;
  onOpenProfile: () => void; // Profil › Entreprise : c'est là que se renomme son espace
}

// Espace de travail : le sien, ou celui d'une équipe rejointe. Toujours affiché, pour situer l'espace ouvert
// et accéder à la gestion de l'équipe, même sans autre espace à choisir.
// Le nom de son propre espace est l'entreprise du profil (sinon son nom) : plus de « Mon espace » générique.
export function WorkspaceSwitcher({ compact, onOpenTeam, onOpenProfile }: Props) {
  const { user } = useAuth();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const w = user?.workspace;
  if (!user || !w) return null;

  const ownName = w.own?.space ?? user.name;
  const currentName = w.current?.space ?? ownName;
  const go = async (ownerId: string | null) => {
    setBusy(ownerId ?? "self");
    try {
      await openSpace(ownerId);
    } catch (e) {
      setBusy(null);
      swal.toast({ variant: "error", title: "Espace inaccessible", text: (e as Error).message });
    }
  };

  const Item = ({ id, name, detail, active }: { id: string | null; name: string; detail: string; active: boolean }) => (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={() => (active ? setOpen(false) : go(id))}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/5"
      style={active ? { background: "rgb(var(--color-gold-rgb) / 0.1)" } : undefined}
    >
      <Avatar name={name} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold" style={{ color: theme.text }}>{name}</span>
        <span className="block truncate text-[11.5px]" style={{ color: theme.textMuted }}>{detail}</span>
      </span>
      {busy === (id ?? "self") ? (
        <Loader2 size={15} className="animate-spin" style={{ color: theme.textMuted }} />
      ) : (
        active && <span className="tr-ico ok-solid" aria-label="Espace ouvert"><Check size={13} strokeWidth={3} /></span>
      )}
    </button>
  );

  const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 pb-1">
      <p className="px-2 pb-0.5 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: theme.textMuted }}>{label}</p>
      {children}
    </div>
  );

  const action = (Icon: typeof Users, label: string, onClick: () => void, badge?: number) => (
    <button
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[13px] font-medium transition-colors hover:bg-black/5"
      style={{ color: theme.text }}
    >
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg" style={{ background: "var(--surface-2)", color: theme.textMuted }}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!badge && <span className="cnt hot">{badge}</span>}
    </button>
  );

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        className={`mb-1.5 flex items-center rounded-[14px] text-left transition-all hover:brightness-[0.98] ${compact ? "mx-auto h-11 w-11 justify-center" : "mx-2.5 gap-2.5 px-2 py-1.5"}`}
        style={{ border: "1px solid var(--line)", background: open || w.current ? "var(--surface-2)" : "var(--surface)" }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={compact ? `${currentName} · changer d'espace de travail` : "Changer d'espace de travail"}
        aria-label="Changer d'espace de travail"
      >
        <span className="relative flex-shrink-0">
          <Avatar name={currentName} size={30} />
          {w.invitations > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2" style={{ background: theme.red, ["--tw-ring-color" as string]: "var(--surface)" }} aria-hidden />}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight" style={{ color: theme.text }}>{currentName}</span>
              <span className="block truncate text-[11px] leading-tight" style={{ color: theme.textMuted }}>
                {w.current ? `Équipe · ${w.current.roleLabel}` : "Votre espace · Propriétaire"}
              </span>
            </span>
            <ChevronsUpDown size={14} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: open ? "scale(1.1)" : undefined }} />
          </>
        )}
      </button>

      {open && (
        <FloatingMenu anchor={btn.current} onClose={() => setOpen(false)} width={264} align="left" rich>
          <Group label="Votre espace">
            <Item id={null} name={ownName} detail="Votre espace · Propriétaire" active={!w.current} />
          </Group>
          <Group label={w.spaces.length ? "Équipes rejointes" : "Équipes"}>
            {w.spaces.map((s) => (
              <Item key={s.ownerId} id={s.ownerId} name={s.space} detail={`Équipe · ${s.roleLabel}`} active={w.current?.ownerId === s.ownerId} />
            ))}
            {!w.spaces.length && (
              <p className="mx-1 rounded-xl px-2.5 py-2 text-[11.5px] leading-snug" style={{ background: "var(--surface-2)", color: theme.textMuted }}>
                Aucune équipe rejointe. Quand quelqu'un vous invite dans son espace, il apparaît ici.
              </p>
            )}
          </Group>
          <MenuSeparator />
          {action(w.invitations > 0 ? Mail : Users, w.invitations > 0 ? `${w.invitations} invitation${w.invitations > 1 ? "s" : ""} en attente` : w.current ? "Équipe et espaces" : "Gérer mon équipe", onOpenTeam, w.invitations)}
          {action(Pencil, "Renommer mon espace", onOpenProfile)}
        </FloatingMenu>
      )}
    </>
  );
}
