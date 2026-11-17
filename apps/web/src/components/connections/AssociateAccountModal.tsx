import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, Facebook, Instagram, Music2, Plug, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ReconnectDialog } from "@/components/connections/ReconnectDialog";
import { accountApi, type SocialAccount } from "@/lib/account.api";
import { isPermissionError } from "@/lib/meta";
import { ASSOCIATE_EVENT } from "@/lib/associate";
import { plural } from "@/lib/format";

type Platform = SocialAccount["platform"];

interface Net {
  id: Platform;
  name: string;
  text: string;
  icon: LucideIcon;
  a: string; // dégradé de la tuile (haut → bas)
  b: string;
  soon?: boolean;
}

// Pastille ronde d'état : coche verte pour un compte associé et en ordre, alerte pour un compte à vérifier
function StatusDot({ tone }: { tone: State["tone"] }) {
  if (tone === "ok") return <span className="tr-ico ok-solid" title="Associé"><Check strokeWidth={3} /></span>;
  if (tone === "warn" || tone === "bad") return <span className="tr-ico warn md" title="À vérifier"><AlertTriangle /></span>;
  return null;
}

const NETS: Net[] = [
  { id: "FACEBOOK", name: "Facebook", text: "Pages, commentaires, Messenger, lives, publication", icon: Facebook, a: "#5aa2ff", b: "#1877f2" },
  { id: "INSTAGRAM", name: "Instagram", text: "Compte pro lié à une Page · commentaires, messages, publication", icon: Instagram, a: "#fa7e1e", b: "#c13584" },
  { id: "TIKTOK", name: "TikTok", text: "Vidéos et commentaires (limité)", icon: Music2, a: "#3a3d48", b: "#0e1014", soon: true },
];

// État d'un compte : ce que l'utilisateur doit savoir pour savoir s'il doit agir
type State = { label: string; tone: "ok" | "warn" | "off" | "bad" };
function stateOf(a: SocialAccount): State {
  if (!a.isActive) return { label: "Désactivé", tone: "off" };
  if (a.syncError) return isPermissionError(a.syncError) ? { label: "À reconnecter", tone: "warn" } : { label: "Erreur de relève", tone: "bad" };
  return { label: "Actif", tone: "ok" };
}

// Fenêtre « Associer un compte » : les plateformes avec leur état (associée, à reconnecter, bientôt), puis les comptes déjà associés
export function AssociateAccountModal({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [connect, setConnect] = useState(false);

  useEffect(() => {
    accountApi.list().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const of = (p: Platform) => (accounts ?? []).filter((a) => a.platform === p);

  const netState = (n: Net): { label: string; tone: State["tone"] } => {
    if (n.soon) return { label: "Bientôt", tone: "off" };
    if (accounts === null) return { label: "…", tone: "off" };
    const list = of(n.id);
    if (list.length === 0) return { label: "Non associé", tone: "off" };
    if (list.some((a) => stateOf(a).tone === "warn" || stateOf(a).tone === "bad")) return { label: "À vérifier", tone: "warn" };
    return { label: plural(list.length, "compte associé", "comptes associés"), tone: "ok" };
  };

  if (connect) return <ReconnectDialog connect onClose={() => setConnect(false)} />;

  return (
    <Modal
      title="Associer un compte"
      subtitle="Choisissez la plateforme à relier à SuiteFlow : ses commentaires et messages arrivent dans « À traiter »."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" icon={Plug} onClick={() => { onClose(); nav("/app/connexions"); }}>Gérer mes connexions</Button>
          <Button icon={X} size="sm" onClick={onClose}>Fermer</Button>
        </>
      }
    >
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Plateformes</p>
      <ul className="stagger flex flex-col gap-2">
        {NETS.map((n) => {
          const st = netState(n);
          const tile = { "--a": n.a, "--b": n.b } as CSSProperties;
          return (
            <li key={n.id}>
              <button className="row-s w-full text-left disabled:cursor-not-allowed disabled:opacity-70" disabled={n.soon} onClick={() => setConnect(true)}>
                <span className="ico-tile" style={{ ...tile, color: "#fff" }}><n.icon size={20} strokeWidth={2.1} /></span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] font-bold" style={{ color: theme.text }}>{n.name}</b>
                  <small className="block text-[12px] leading-snug" style={{ color: theme.textMuted }}>{n.text}</small>
                </span>
                <span className={`chip ${st.tone} flex-shrink-0`}>{st.label}</span>
                {st.tone === "ok" || st.tone === "warn" ? <StatusDot tone={st.tone} /> : !n.soon && <ChevronRight size={16} style={{ color: theme.textMuted }} className="flex-shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mb-2 mt-5 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Comptes associés</p>
      {accounts === null ? (
        <div className="flex flex-col gap-2">{[0, 1].map((i) => <span key={i} className="sk h-[58px] !rounded-[14px]" />)}</div>
      ) : accounts.length === 0 ? (
        <p className="row-s text-[13px]" style={{ color: theme.textMuted }}>Aucun compte associé pour l'instant. Choisissez une plateforme ci-dessus pour commencer.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => {
            const st = stateOf(a);
            return (
              <li key={a.id} className="row-s">
                {a.platform === "TIKTOK" ? null : <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={36} />}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] font-semibold" style={{ color: theme.text }}>{a.name}</b>
                  <small className="block truncate text-[12px]" style={{ color: theme.textMuted }}>
                    {a.platform === "FACEBOOK" ? "Page Facebook" : a.platform === "INSTAGRAM" ? "Compte Instagram" : "TikTok"}
                    {a.syncError && st.tone !== "ok" ? ` · ${st.tone === "warn" ? "autorisations à renouveler" : "relève impossible"}` : ""}
                  </small>
                </span>
                <span className={`chip ${st.tone} flex-shrink-0`}>{st.label}</span>
                <StatusDot tone={st.tone} />
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

// Monté une fois dans AppLayout : s'ouvre quand un bouton appelle openAssociate()
export function AssociateAccountHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(ASSOCIATE_EVENT, on);
    return () => window.removeEventListener(ASSOCIATE_EVENT, on);
  }, []);
  return open ? <AssociateAccountModal onClose={() => setOpen(false)} /> : null;
}
