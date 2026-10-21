import { useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Mail, Users } from "lucide-react";
import { theme } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { FloatingMenu, MenuSeparator } from "@/components/ui/FloatingMenu";
import { openSpace } from "@/lib/team.api";
import { swal } from "@/lib/swal";

// Espace de travail : le sien, ou celui d'une équipe rejointe. Toujours affiché, pour situer l'espace ouvert
// et accéder à la gestion de l'équipe, même sans autre espace à choisir.
export function WorkspaceSwitcher({ onOpenTeam }: { onOpenTeam: () => void }) {
  const { user } = useAuth();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const w = user?.workspace;
  if (!user || !w) return null;

  const currentName = w.current?.space ?? "Mon espace";
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
      role="menuitem"
      onClick={() => (active ? setOpen(false) : go(id))}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-black/5"
    >
      <Avatar name={name} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium" style={{ color: theme.text }}>{name}</span>
        <span className="block truncate text-[11.5px]" style={{ color: theme.textMuted }}>{detail}</span>
      </span>
      {busy === (id ?? "self") ? <Loader2 size={14} className="animate-spin" style={{ color: theme.textMuted }} /> : active && <Check size={15} style={{ color: theme.goldDark }} />}
    </button>
  );

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        className="mx-2 mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/5"
        style={{ border: `1px solid ${theme.border}`, background: w.current ? theme.goldSoft : theme.bgCard }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Changer d'espace de travail"
      >
        <Avatar name={currentName} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold" style={{ color: theme.text }}>{currentName}</span>
          <span className="block truncate text-[11px]" style={{ color: theme.textMuted }}>
            {w.current ? `Équipe · ${w.current.roleLabel}` : "Propriétaire"}
          </span>
        </span>
        {w.invitations > 0 && (
          <span className="rounded px-1.5 text-[10.5px] font-semibold leading-[17px]" style={{ background: theme.red, color: "#fff" }}>{w.invitations}</span>
        )}
        <ChevronsUpDown size={14} style={{ color: theme.textMuted }} />
      </button>

      {open && (
        <FloatingMenu anchor={btn.current} onClose={() => setOpen(false)} width={232}>
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Espaces de travail</p>
          <Item id={null} name={user.name} detail="Mon espace · propriétaire" active={!w.current} />
          {w.spaces.map((s) => (
            <Item key={s.ownerId} id={s.ownerId} name={s.space} detail={`Équipe · ${s.roleLabel}`} active={w.current?.ownerId === s.ownerId} />
          ))}
          {!w.spaces.length && (
            <p className="px-2 pb-1 pt-1.5 text-[11.5px] leading-snug" style={{ color: theme.textMuted }}>
              Aucune autre équipe rejointe : quand quelqu'un vous invite dans son espace, il apparaît ici.
            </p>
          )}
          <MenuSeparator />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenTeam();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-black/5"
            style={{ color: theme.text }}
          >
            {w.invitations > 0 ? <Mail size={14} /> : <Users size={14} />}
            {w.invitations > 0 ? `${w.invitations} invitation${w.invitations > 1 ? "s" : ""} en attente` : w.current ? "Équipe et espaces" : "Gérer mon équipe"}
          </button>
        </FloatingMenu>
      )}
    </>
  );
}
