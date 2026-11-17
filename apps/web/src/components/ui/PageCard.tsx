import type { ReactNode } from "react";

// Une page = une seule carte : l'en-tête (titre, description, onglets) en haut, puis le contenu qui défile à l'intérieur.
// Sur bureau, la carte prend la hauteur de l'écran ; sur mobile, elle suit le contenu.
export function PageCard({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <section className="card-x flex flex-col overflow-hidden rounded-2xl lg:h-[calc(100dvh-10rem)] lg:min-h-[560px]">
      {header}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t p-3 sm:p-5" style={{ borderColor: "var(--line)" }}>
        {children}
      </div>
    </section>
  );
}
