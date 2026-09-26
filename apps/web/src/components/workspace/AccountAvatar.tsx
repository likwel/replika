import { Avatar } from "@/components/ui/Avatar";
import { PlatIcon } from "@/components/ui/PlatIcon";
import type { MetaPlatform } from "@/lib/workspace.api";

interface Props {
  name: string;
  src?: string | null;
  platform: MetaPlatform;
  size?: number;
}

// Avatar d'une Page / d'un compte, avec le logo de sa plateforme en pastille
export function AccountAvatar({ name, src, platform, size = 32 }: Props) {
  return (
    <span className="relative inline-flex flex-shrink-0">
      <Avatar name={name.replace(/^@/, "")} src={src} size={size} />
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-[2px] leading-none">
        <PlatIcon p={platform === "INSTAGRAM" ? "ig" : "fb"} size={Math.max(10, Math.round(size * 0.34))} />
      </span>
    </span>
  );
}
