import type { ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";

interface Props { children: ReactNode; delay?: number; className?: string; }

// Fait apparaître son contenu (fondu + léger glissement) au passage dans le viewport
export function Reveal({ children, delay = 0, className = "" }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
