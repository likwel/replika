import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StateCard } from "@/components/ui/StateCard";
import { Button } from "@/components/ui/Button";

interface Props {
  title: string;
  children: string;
  icon?: LucideIcon;
  className?: string;
}

// Module non inclus dans la formule : explique ce qu'il apporte et mène aux formules
export function UpgradeCard({ title, children, icon = Sparkles, className }: Props) {
  const nav = useNavigate();
  return (
    <StateCard
      icon={icon}
      title={title}
      badge="Formule Pro et plus"
      className={className}
      action={<Button icon={Sparkles} onClick={() => nav("/app/facturation")}>Voir les formules</Button>}
    >
      {children}
    </StateCard>
  );
}
