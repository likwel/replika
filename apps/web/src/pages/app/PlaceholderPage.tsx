import { useParams } from "react-router-dom";
import { theme } from "@/theme";
import { MENUS } from "@/data/menus";
import { Title } from "@/components/ui/Title";

const SEG_TO_ID: Record<string, string> = {
  lives: "live", automatisation: "auto", parametres: "set",
};

export function PlaceholderPage() {
  const { section } = useParams();
  const id = SEG_TO_ID[section || ""] || "hub";
  const m = MENUS.find((x) => x.id === id) || MENUS[0];
  const Icon = m.icon;
  return (
    <div className="rounded-2xl p-10 text-center" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.goldSoft }}>
        <Icon size={26} style={{ color: theme.gold }} />
      </div>
      <Title className="text-xl">{m.label}</Title>
      <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>Cette vue est prête à recevoir le module correspondant.</p>
    </div>
  );
}