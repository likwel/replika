import { Facebook, Instagram } from "lucide-react";
import type { Platform } from "@/types";

export function PlatIcon({ p, size = 16 }: { p: Platform; size?: number }) {
  return p === "fb"
    ? <Facebook size={size} color="#1877F2" />
    : <Instagram size={size} color="#E4405F" />;
}