import { useParams } from "react-router-dom";
import { MENUS } from "@/data/menus";
import { StateCard } from "@/components/ui/StateCard";

const SEG_TO_ID: Record<string, string> = {
  lives: "live", automatisation: "auto", parametres: "set",
};

export function PlaceholderPage() {
  const { section } = useParams();
  const id = SEG_TO_ID[section || ""] || "hub";
  const m = MENUS.find((x) => x.id === id) || MENUS[0];
  return (
    <StateCard icon={m.icon} title={m.label}>
      Cette vue est prête à recevoir le module correspondant.
    </StateCard>
  );
}
