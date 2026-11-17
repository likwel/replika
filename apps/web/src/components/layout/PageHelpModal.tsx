import { Check } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PAGE_HELP } from "@/data/pageHelp";

// « Comment fonctionne cette page » : repères courts sur le module ouvert
export function PageHelpModal({ menuId, onClose }: { menuId: string; onClose: () => void }) {
  const help = PAGE_HELP[menuId] ?? PAGE_HELP.dash;
  return (
    <Modal title={`Comment fonctionne cette page`} subtitle={help.title} onClose={onClose} footer={<Button icon={Check} onClick={onClose}>Compris</Button>}>
      <p className="mb-4 text-[14px] leading-relaxed" style={{ color: theme.text }}>{help.intro}</p>
      <ul className="stagger flex flex-col gap-2">
        {help.points.map((p) => (
          <li key={p} className="row-s items-start">
            <span className="tr-ico ok !h-6 !w-6"><Check /></span>
            <span className="text-[13.5px] leading-snug" style={{ color: theme.text }}>{p}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
