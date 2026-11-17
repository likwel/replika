import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowUp, CalendarCheck, FileText, Landmark, Lock, type LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";

interface Props {
  title: string;
  subtitle?: string;
  updatedAt?: string; // "26 septembre 2026"
  children: ReactNode;
}

// Documents juridiques : un onglet par page, pour passer de l'un à l'autre sans repasser par l'accueil
const DOCS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/cgu", label: "Conditions d'utilisation", icon: FileText },
  { to: "/confidentialite", label: "Confidentialité", icon: Lock },
  { to: "/mentions-legales", label: "Mentions légales", icon: Landmark },
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface TocItem { id: string; title: string }

// Habillage commun des pages CGU, confidentialité, mentions légales, guide et contact :
// en-tête collant, carte de titre, onglets entre documents, sommaire collant (bureau) avec section en cours, pied de page.
// Le sommaire est lu dans la page (les <Section>), il n'y a rien à déclarer.
export function LegalLayout({ title, subtitle, updatedAt, children }: Props) {
  const { pathname } = useLocation();
  const [toc, setToc] = useState<TocItem[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);
  const isDoc = DOCS.some((d) => d.to === pathname);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const sections = [...document.querySelectorAll<HTMLElement>("main section[data-toc]")];
    setToc(sections.map((s) => ({ id: s.id, title: s.dataset.toc ?? "" })));
    if (!sections.length) return;
    // Section en cours : la dernière dont le haut a passé le tiers supérieur de l'écran
    const onScroll = () => {
      setShowTop(window.scrollY > 600);
      const line = window.innerHeight * 0.3;
      let id = sections[0].id;
      for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
      setCurrent(id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <div style={{ background: theme.bg }}>
      <header className="sticky top-0 z-50 backdrop-blur" style={{ background: "color-mix(in srgb, var(--color-bg) 85%, transparent)", borderBottom: `1px solid ${theme.border}` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            <ThemeSwitch />
            <Link to="/" className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70" style={{ color: theme.text }}>
              <ArrowLeft size={15} /> Accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:pt-12">
        {/* Carte de titre */}
        <div className="rounded-3xl p-6 sm:p-8" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: theme.text }}>{title}</h1>
          {subtitle && <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: theme.textMuted }}>{subtitle}</p>}
          {updatedAt && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
              <CalendarCheck size={13} /> Dernière mise à jour : {updatedAt}
            </p>
          )}
          {isDoc && (
            <nav className="mt-6 flex flex-wrap gap-2" aria-label="Documents juridiques">
              {DOCS.map(({ to, label, icon: Icon }) => {
                const on = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={on ? "page" : undefined}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-80"
                    style={on ? { background: theme.bgDark, color: "#fff" } : { background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
                  >
                    <Icon size={14} /> {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className={`mt-6 grid gap-6 lg:items-start ${toc.length > 1 ? "lg:grid-cols-[250px_minmax(0,1fr)]" : ""}`}>
          {/* Sommaire */}
          {toc.length > 1 && (
            <aside className="hidden lg:sticky lg:top-24 lg:block">
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>Sommaire</p>
              <ol className="flex max-h-[calc(100vh-9rem)] flex-col gap-0.5 overflow-y-auto">
                {toc.map((t) => {
                  const on = current === t.id;
                  return (
                    <li key={t.id}>
                      <a
                        href={`#${t.id}`}
                        aria-current={on ? "location" : undefined}
                        className="block rounded-lg px-3 py-1.5 text-[13px] leading-snug transition-colors hover:opacity-80"
                        style={on ? { background: theme.goldSoft, color: theme.goldDark, fontWeight: 650 } : { color: theme.textMuted }}
                      >
                        {t.title}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </aside>
          )}

          <div className="prose-legal flex min-w-0 flex-col gap-4">{children}</div>
        </div>
      </main>

      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full shadow-lg transition-transform hover:-translate-y-0.5"
          style={{ background: theme.bgDark, color: "#fff" }}
          aria-label="Revenir en haut"
          title="Revenir en haut"
        >
          <ArrowUp size={18} />
        </button>
      )}

      <footer className="px-5 py-8 text-center text-xs" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textMuted }}>
        © 2026 SuiteFlow. Tous droits réservés. ·{" "}
        <Link to="/cgu" className="underline hover:opacity-70">CGU</Link> ·{" "}
        <Link to="/confidentialite" className="underline hover:opacity-70">Confidentialité</Link> ·{" "}
        <Link to="/mentions-legales" className="underline hover:opacity-70">Mentions légales</Link> ·{" "}
        <Link to="/guide" className="underline hover:opacity-70">Guide</Link> ·{" "}
        <Link to="/contact" className="underline hover:opacity-70">Contact</Link>
      </footer>
    </div>
  );
}

// Un bloc de section : titre + paragraphes/listes fournis par la page, dans sa propre carte.
// Le titre alimente le sommaire (data-toc) ; l'ancre est dérivée du titre.
export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id ?? slug(title)} data-toc={title} className="scroll-mt-24 rounded-2xl p-5 sm:p-6" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <h2 className="text-lg font-bold sm:text-xl" style={{ color: theme.text }}>{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed" style={{ color: theme.text }}>{children}</div>
    </section>
  );
}
