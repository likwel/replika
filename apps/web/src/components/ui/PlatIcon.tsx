import { useId } from "react";
import type { Platform } from "@/types";

// Logos officiels : Facebook (rond bleu, « f » blanc) et Instagram (carré dégradé, objectif blanc)
export function PlatIcon({ p, size = 16 }: { p: Platform; size?: number }) {
  const gid = `ig${useId().replace(/:/g, "")}`; // identifiant sans « : » (valide dans url(#…))
  if (p === "fb") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Facebook" role="img" className="flex-shrink-0">
        <path
          fill="#1877F2"
          d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"
        />
        <path fill="#fff" d="M16.67 15.56l.53-3.49h-3.33V9.82c0-.94.47-1.87 1.96-1.87h1.51V5s-1.38-.24-2.69-.24c-2.74 0-4.53 1.66-4.53 4.67v2.64H7.08v3.49h3.05V24a12.1 12.1 0 003.74 0v-8.44h2.8z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Instagram" role="img" className="flex-shrink-0">
      <defs>
        <radialGradient id={gid} cx="0.3" cy="1.05" r="1.2">
          <stop offset="0" stopColor="#FFD600" />
          <stop offset="0.28" stopColor="#FF7A00" />
          <stop offset="0.55" stopColor="#FF0069" />
          <stop offset="0.8" stopColor="#D300C5" />
          <stop offset="1" stopColor="#7638FA" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.2" fill={`url(#${gid})`} />
      <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="4.4" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.4" cy="7.6" r="1.05" fill="#fff" />
    </svg>
  );
}
