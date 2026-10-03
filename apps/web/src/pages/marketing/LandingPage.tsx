import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bot, MessageCircle, BarChart3, CalendarDays, Radio, Check,
  ArrowRight, Menu, X, Star, ShieldCheck, Target, Instagram, Facebook,
  Plug, ChevronDown, Megaphone, Sparkles,
} from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/marketing/Reveal";
import { ChatDemo } from "@/components/marketing/ChatDemo";

const features = [
  { icon: Bot, t: "Réponses IA automatiques", d: "L'IA répond aux commentaires et messages selon l'intention détectée, sans jamais inventer un prix ou un stock absent de vos infos." },
  { icon: Target, t: "Règles ciblées par publication", d: "Créez une règle valable pour tout le compte, ou uniquement sur une publication précise — mot-clé fixe ou réponse générée par l'IA." },
  { icon: MessageCircle, t: "Détection de leads", d: "Score automatiquement chaque échange (chaud / tiède / froid) et classe vos clients potentiels dans un pipeline." },
  { icon: Radio, t: "Modération des Lives", d: "Détecte les commandes « JP » en direct et répond normalement aux autres commentaires (prix, questions…)." },
  { icon: CalendarDays, t: "Planification multi-réseaux", d: "Programmez vos publications Facebook et Instagram depuis un seul calendrier." },
  { icon: BarChart3, t: "Statistiques & historique", d: "Engagement, performance par compte et par règle, et l'historique complet de chaque action automatisée." },
];

const steps = [
  {
    t: "Connectez vos pages",
    d: "Facebook et Instagram se connectent en quelques clics via l'autorisation officielle de Meta — ReplyKA n'a jamais accès à votre mot de passe.",
    icon: Plug,
  },
  {
    t: "Configurez vos règles et l'IA",
    d: "Mots-clés avec réponses fixes, ou réponses générées par l'IA à partir de votre contexte produit — pour tout le compte ou une seule publication.",
    icon: Bot,
  },
  {
    t: "ReplyKA répond pour vous",
    d: "Commentaires, messages privés et lives, 24h/24. Envoi automatique ou validation manuelle avant publication, règle par règle.",
    icon: Megaphone,
  },
];

const faqs = [
  { q: "Dois-je donner mon mot de passe Facebook ?", a: "Non. La connexion passe par l'autorisation officielle de Meta (OAuth) : ReplyKA n'a jamais accès à votre mot de passe et vous pouvez révoquer l'accès à tout moment depuis Facebook." },
  { q: "L'IA peut-elle inventer un prix ou une information fausse ?", a: "Non. Elle ne répond qu'à partir des informations que vous lui fournissez. S'il manque une info, elle le dit poliment et escalade la conversation pour qu'un humain valide, au lieu d'improviser." },
  { q: "Est-ce que je garde le contrôle sur les réponses ?", a: "Oui. Chaque règle — à mots-clés ou par IA — peut être configurée en « envoi automatique » ou en « validation manuelle » avant publication." },
  { q: "Ça fonctionne aussi sur Instagram ?", a: "Oui, Facebook et Instagram sont tous les deux pris en charge, pour les commentaires comme pour les messages privés." },
  { q: "Puis-je limiter une règle à une seule publication ?", a: "Oui. Chaque règle peut s'appliquer à tout le compte, ou être ciblée sur une publication précise — utile pour une promo ou un lancement ponctuel." },
  { q: "Que se passe-t-il pendant un live ?", a: "ReplyKA détecte automatiquement les commandes (« JP » + code produit) en direct, et répond normalement aux autres commentaires comme les questions de prix." },
];

const PLAN_DEFS = [
  {
    name: "Starter",
    base: 49000,
    tagline: "Pour démarrer l'automatisation",
    feats: ["1 compte Facebook ou Instagram", "Réponses automatiques par mots-clés", "Planification des publications", "Statistiques de base", "Validation manuelle avant envoi"],
    hl: false,
  },
  {
    name: "Pro",
    base: 129000,
    tagline: "Le plus choisi par les vendeurs actifs",
    feats: ["Jusqu'à 5 comptes connectés", "Réponses par IA (commentaires + messages)", "Règles IA ciblées par publication", "Détection & pipeline de leads", "Modération des lives (commandes JP)", "Statistiques avancées + historique"],
    hl: true,
  },
  {
    name: "Agence",
    base: null,
    tagline: "Pour les équipes qui gèrent plusieurs marques",
    feats: ["Comptes illimités", "Toutes les fonctionnalités Pro", "Mise en place accompagnée", "Support prioritaire"],
    hl: false,
  },
] as const;

function fmt(n: number) {
  return n.toLocaleString("fr-FR").replace(/,/g, " ");
}

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function Em({ children }: { children: ReactNode }) {
  return <em style={{ color: theme.gold, fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>{children}</em>;
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolled();

  return (
    <div style={{ background: theme.bg }}>
      <header
        className="sticky top-0 z-50 backdrop-blur transition-shadow"
        style={{ background: "rgba(242,239,233,0.85)", borderBottom: `1px solid ${theme.border}`, boxShadow: scrolled ? "0 4px 16px rgba(28,24,19,0.06)" : "none" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: theme.text }}>
            <a href="#features" className="hover:opacity-70">Fonctionnalités</a>
            <a href="#pricing" className="hover:opacity-70">Tarifs</a>
            <a href="#faq" className="hover:opacity-70">FAQ</a>
            <Link to="/guide" className="hover:opacity-70">Guide</Link>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Connexion</Button></Link>
            <Link to="/register"><Button variant="primary" size="sm">Essai gratuit</Button></Link>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X /> : <Menu />}</button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-2">
            <a href="#features" onClick={() => setMenuOpen(false)} className="py-2 text-sm" style={{ color: theme.text }}>Fonctionnalités</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="py-2 text-sm" style={{ color: theme.text }}>Tarifs</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="py-2 text-sm" style={{ color: theme.text }}>FAQ</a>
            <Link to="/guide" className="py-2 text-sm" style={{ color: theme.text }}>Guide</Link>
            <Link to="/login"><Button variant="ghost" size="sm" className="w-full justify-center">Connexion</Button></Link>
            <Link to="/register"><Button variant="primary" size="sm" className="w-full justify-center">Essai gratuit</Button></Link>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:gap-6">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6" style={{ background: theme.goldSoft, color: theme.goldDark }}>
            <Star size={13} fill={theme.gold} color={theme.gold} /> Conçu pour les vendeurs malgaches
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.08] tracking-tight" style={{ color: theme.text }}>
            Automatisez vos réseaux sur Facebook & Instagram avec <Em>l'IA</Em>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg lg:mx-0" style={{ color: theme.textMuted }}>
            ReplyKA répond automatiquement aux commentaires et messages, détecte vos leads, modère vos lives et gère toutes vos pages depuis un seul endroit.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 lg:justify-start">
            <Link to="/register"><Button variant="primary" size="lg" icon={ArrowRight}>Commencer gratuitement</Button></Link>
            <Link to="/login"><Button variant="ghost" size="lg">J'ai déjà un compte</Button></Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
            {[
              { icon: Facebook, label: "Facebook" },
              { icon: Instagram, label: "Instagram" },
              { icon: Sparkles, label: "IA Groq" },
            ].map((b) => (
              <span key={b.label} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.textMuted }}>
                <b.icon size={15} style={{ color: theme.goldDark }} /> {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ChatDemo />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.goldDark }}>Comment ça marche</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold" style={{ color: theme.text }}>
              Trois étapes, et c'est <Em>parti</Em>
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 120}>
              <div className="relative h-full rounded-2xl p-6" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
                <span className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold" style={{ background: theme.bgDark, color: theme.goldLight }}>
                  {i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4" style={{ background: theme.goldSoft }}>
                  <s.icon size={20} style={{ color: theme.goldDark }} />
                </div>
                <h3 className="font-semibold text-lg mb-1.5" style={{ color: theme.text }}>{s.t}</h3>
                <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: theme.text }}>
              Tout ce qu'il vous <Em>faut</Em>
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 100}>
              <div
                className="group h-full rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
                  style={{ background: theme.goldSoft }}
                >
                  <f.icon size={22} style={{ color: theme.goldDark }} />
                </div>
                <h3 className="font-semibold text-lg mb-1.5" style={{ color: theme.text }}>{f.t}</h3>
                <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <PricingSection />

      <section id="faq" className="mx-auto max-w-3xl px-5 py-16">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: theme.text }}>
              Questions <Em>fréquentes</Em>
            </h2>
          </div>
        </Reveal>
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <FaqItem q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20">
        <Reveal>
          <div className="rounded-3xl px-6 py-12 text-center sm:px-16" style={{ background: theme.bgDark }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Prêt à libérer du temps sur vos réseaux ?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "#ffffffb3" }}>
              Connectez votre première page en quelques minutes, sans engagement.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register"><Button variant="primary" size="lg" icon={ArrowRight}>Commencer gratuitement</Button></Link>
              <Link to="/guide"><Button variant="ghost" size="lg" className="!text-white !border-white/25">Voir le guide</Button></Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer style={{ background: theme.bgDark2 }}>
        <div className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo dark />
            <p className="mt-3 text-sm" style={{ color: "#ffffff80" }}>L'IA qui répond pour vous, à Madagascar et au-delà.</p>
          </div>
          {[
            { t: "Produit", l: [{ label: "Fonctionnalités", href: "#features" }, { label: "Tarifs", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
            { t: "Ressources", l: [{ label: "Guide de démarrage", to: "/guide" }] },
            { t: "Légal", l: [{ label: "Confidentialité", to: "/confidentialite" }, { label: "CGU", to: "/cgu" }] },
          ].map((c, i) => (
            <div key={i}>
              <p className="font-semibold text-sm mb-3 text-white">{c.t}</p>
              <ul className="flex flex-col gap-2">
                {c.l.map((x) =>
                  "to" in x ? (
                    <li key={x.label}><Link to={x.to} className="text-sm hover:opacity-80" style={{ color: "#ffffff80" }}>{x.label}</Link></li>
                  ) : (
                    <li key={x.label}><a href={x.href} className="text-sm hover:opacity-80" style={{ color: "#ffffff80" }}>{x.label}</a></li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-5 py-5 text-sm" style={{ borderTop: `1px solid ${theme.bgDark}`, color: "#ffffff66" }}>© 2026 ReplyKA. Tous droits réservés.</div>
      </footer>
    </div>
  );
}

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
      <Reveal>
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: theme.text }}>
            Des tarifs <Em>simples</Em>
          </h2>
          <p className="mt-3 text-sm" style={{ color: theme.textMuted }}>Changez ou annulez votre formule à tout moment.</p>
        </div>

        <div className="mb-10 flex items-center justify-center gap-3">
          <span className="text-sm font-medium" style={{ color: annual ? theme.textMuted : theme.text }}>Mensuel</span>
          <button
            type="button"
            onClick={() => setAnnual((v) => !v)}
            className="relative h-7 w-13 rounded-full transition-colors"
            style={{ background: annual ? theme.gold : theme.border, width: 52 }}
            aria-label="Basculer facturation annuelle"
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: annual ? "translateX(27px)" : "translateX(4px)" }}
            />
          </button>
          <span className="text-sm font-medium" style={{ color: annual ? theme.text : theme.textMuted }}>
            Annuel <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>-15%</span>
          </span>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {PLAN_DEFS.map((pl, i) => {
          const monthly = pl.base ? (annual ? Math.round((pl.base * 0.85) / 1000) * 1000 : pl.base) : null;
          return (
            <Reveal key={pl.name} delay={i * 100}>
              <div
                className="rounded-2xl p-6 relative h-full transition-transform hover:-translate-y-1"
                style={{ background: pl.hl ? theme.bgDark : theme.bgCard, border: `1px solid ${pl.hl ? theme.bgDark : theme.border}` }}
              >
                {pl.hl && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.gold, color: "#1A1410" }}>
                    POPULAIRE
                  </span>
                )}
                <h3 className="font-semibold text-lg" style={{ color: pl.hl ? "#fff" : theme.text }}>{pl.name}</h3>
                <p className="mt-1 text-xs" style={{ color: pl.hl ? "#ffffff99" : theme.textMuted }}>{pl.tagline}</p>
                <div className="mt-4 mb-5">
                  {monthly ? (
                    <>
                      <span className="text-3xl font-extrabold" style={{ color: pl.hl ? theme.goldLight : theme.text }}>{fmt(monthly)}</span>
                      <span className="text-sm" style={{ color: pl.hl ? "#ffffff99" : theme.textMuted }}> Ar/mois</span>
                      {annual && <p className="mt-0.5 text-[11px]" style={{ color: pl.hl ? "#ffffff80" : theme.textMuted }}>facturé annuellement</p>}
                    </>
                  ) : (
                    <span className="text-3xl font-extrabold" style={{ color: pl.hl ? theme.goldLight : theme.text }}>Sur devis</span>
                  )}
                </div>
                <ul className="flex flex-col gap-2.5 mb-6">
                  {pl.feats.map((ft) => (
                    <li key={ft} className="flex items-start gap-2 text-sm" style={{ color: pl.hl ? "#ffffffcc" : theme.text }}>
                      <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: theme.gold }} /> {ft}
                    </li>
                  ))}
                </ul>
                <Link to="/register"><Button variant={pl.hl ? "primary" : "ghost"} className="w-full justify-center">Choisir</Button></Link>
              </div>
            </Reveal>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs" style={{ color: theme.textMuted }}>
        <ShieldCheck size={13} className="mr-1 inline align-text-bottom" style={{ color: theme.goldDark }} />
        Vous gardez la main : chaque règle, IA comprise, peut être réglée en validation manuelle.
      </p>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: theme.text }}>{q}</span>
        <ChevronDown size={18} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      <div
        className="grid transition-all duration-300"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: theme.textMuted }}>{a}</p>
        </div>
      </div>
    </div>
  );
}
