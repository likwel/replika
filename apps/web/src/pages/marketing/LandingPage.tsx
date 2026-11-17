import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bot, MessageCircle, BarChart3, CalendarDays, Radio, Check, ArrowRight, Menu, X, Star, ShieldCheck, Target, Instagram, Facebook, Plug, ChevronDown, Megaphone, Sparkles, Clock, Lock, Languages, Store, BookOpen, LogIn, Mail, Workflow, Users, Minus } from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { Reveal } from "@/components/marketing/Reveal";
import { ChatDemo } from "@/components/marketing/ChatDemo";
import { AI_PACK, COMPARE_ROWS, MOBILE_MONEY, PLAN_DEFS } from "@/data/plans";
import { PeriodSwitch, PlanTile, catalogPrice, type Period } from "@/components/billing/PlanTile";

// Même palette que les menus de l'application : chaque fonctionnalité garde sa couleur
const features = [
  { icon: Bot, c: "#00A884", t: "Réponses IA automatiques", d: "L'IA répond aux commentaires et messages selon l'intention détectée, sans jamais inventer un prix ou un stock absent de vos infos." },
  { icon: Target, c: "#F59E0B", t: "Règles ciblées par publication", d: "Créez une règle valable pour tout le compte, ou uniquement sur une publication précise — mot-clé fixe ou réponse générée par l'IA." },
  { icon: MessageCircle, c: "#8B5CF6", t: "Détection de leads", d: "Score automatiquement chaque échange (chaud / tiède / froid) et classe vos clients potentiels dans un pipeline." },
  { icon: Radio, c: "#EF4444", t: "Modération des Lives", d: "Détecte les commandes « JP » en direct et répond normalement aux autres commentaires (prix, questions…)." },
  { icon: Store, c: "#10B981", t: "Gestion commerciale", d: "Importe les produits publiés sur Marketplace depuis votre catalogue Facebook et suit les commandes de chaque acheteur." },
  { icon: CalendarDays, c: "#06B6D4", t: "Planification multi-réseaux", d: "Programmez vos publications Facebook et Instagram depuis un seul calendrier." },
  { icon: Workflow, c: "#00A884", t: "Pipelines d'automatisation", d: "Un déclencheur, des conditions sur vos règles, des actions enchaînées : message privé, statut de lead, escalade. Chaque exécution est tracée." },
  { icon: Users, c: "#6366F1", t: "Travail en équipe", d: "Invitez vos collaborateurs avec des droits par module, et passez d'un espace de travail à l'autre. Chaque action porte le nom de son auteur." },
  { icon: BarChart3, c: "#0EA5E9", t: "Statistiques & historique", d: "Engagement, performance par compte et par règle, et l'historique complet de chaque action automatisée." },
  { icon: Plug, c: "#3B82F6", t: "Toutes vos Pages réunies", d: "Publications, messages privés et file « à traiter » de chaque Page Facebook et compte Instagram, au même endroit." },
];

const steps = [
  {
    t: "Connectez vos pages",
    d: "Facebook et Instagram se connectent en quelques clics via l'autorisation officielle de Meta — SuiteFlow n'a jamais accès à votre mot de passe.",
    icon: Plug,
    c: "#3B82F6",
  },
  {
    t: "Configurez vos règles et l'IA",
    d: "Mots-clés avec réponses fixes, ou réponses générées par l'IA à partir de votre contexte produit — pour tout le compte ou une seule publication.",
    icon: Bot,
    c: "#00A884",
  },
  {
    t: "SuiteFlow répond pour vous",
    d: "Commentaires, messages privés et lives, 24h/24. Envoi automatique ou validation manuelle avant publication, règle par règle.",
    icon: Megaphone,
    c: "#10B981",
  },
];

// Arguments vérifiables : comportements du produit, pas de chiffres marketing
const trust = [
  { icon: Clock, t: "24h/24", d: "Répond même la nuit" },
  { icon: Lock, t: "Sans mot de passe", d: "Connexion officielle Meta" },
  { icon: Languages, t: "FR & Malagasy", d: "Répond dans la langue du client" },
  { icon: ShieldCheck, t: "Vous gardez la main", d: "Validation manuelle au choix" },
];

const faqs = [
  { q: "Dois-je donner mon mot de passe Facebook ?", a: "Non. La connexion passe par l'autorisation officielle de Meta (OAuth) : SuiteFlow n'a jamais accès à votre mot de passe et vous pouvez révoquer l'accès à tout moment depuis Facebook." },
  { q: "L'IA peut-elle inventer un prix ou une information fausse ?", a: "Non. Elle ne répond qu'à partir des informations que vous lui fournissez. S'il manque une info, elle le dit poliment et escalade la conversation pour qu'un humain valide, au lieu d'improviser." },
  { q: "Est-ce que je garde le contrôle sur les réponses ?", a: "Oui. Chaque règle — à mots-clés ou par IA — peut être configurée en « envoi automatique » ou en « validation manuelle » avant publication." },
  { q: "Ça fonctionne aussi sur Instagram ?", a: "Oui, Facebook et Instagram sont tous les deux pris en charge, pour les commentaires comme pour les messages privés." },
  { q: "Puis-je limiter une règle à une seule publication ?", a: "Oui. Chaque règle peut s'appliquer à tout le compte, ou être ciblée sur une publication précise — utile pour une promo ou un lancement ponctuel." },
  { q: "Que fait un pipeline ?", a: "Il enchaîne des étapes à partir d'un événement (nouveau commentaire, message ou lead) : vérifier une règle ou le score d'un lead, puis envoyer un message privé, changer le statut, vous alerter ou escalader. Tout est visible dans l'historique des exécutions, et l'interrupteur général des réponses automatiques le met en pause." },
  { q: "Puis-je travailler à plusieurs ?", a: "Oui, avec les formules Business et Agence : vous invitez des membres par e-mail et choisissez, module par module, lecture ou écriture. Vous pouvez aussi être invité dans l'espace d'un autre utilisateur et basculer d'un espace à l'autre." },
  { q: "Que se passe-t-il à la fin de l'essai ou de l'abonnement ?", a: "Votre compte et vos données restent accessibles, et les nouveaux messages arrivent dans « À traiter » pour que vous répondiez à la main. Les automatisations reprennent dès le paiement d'une nouvelle période, sans prélèvement automatique." },
  { q: "Que se passe-t-il pendant un live ?", a: "SuiteFlow détecte automatiquement les commandes (« JP » + code produit) en direct, et répond normalement aux autres commentaires comme les questions de prix." },
];

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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.goldDark }}>
      {children}
    </span>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolled();

  return (
    <div style={{ background: theme.bg }}>
      <header
        className="sticky top-0 z-50 backdrop-blur transition-shadow"
        style={{ background: "color-mix(in srgb, var(--color-bg) 88%, transparent)", borderBottom: `1px solid ${theme.border}`, boxShadow: scrolled ? "0 4px 16px rgba(28,24,19,0.06)" : "none" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-semibold" style={{ color: theme.text }}>
            <a href="#features" className="transition-opacity hover:opacity-60">Fonctionnalités</a>
            <a href="#how" className="transition-opacity hover:opacity-60">Comment ça marche</a>
            <a href="#pricing" className="transition-opacity hover:opacity-60">Tarifs</a>
            <a href="#faq" className="transition-opacity hover:opacity-60">FAQ</a>
            <Link to="/guide" className="transition-opacity hover:opacity-60">Guide</Link>
            <Link to="/contact" className="transition-opacity hover:opacity-60">Contact</Link>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitch className="mr-1" />
            <Link to="/connexion"><Button icon={LogIn} variant="ghost" size="sm">Connexion</Button></Link>
            <Link to="/register"><Button icon={Sparkles} variant="primary" size="sm">Essai gratuit</Button></Link>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeSwitch />
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-1.5">
            <a href="#features" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium" style={{ color: theme.text }}>Fonctionnalités</a>
            <a href="#how" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium" style={{ color: theme.text }}>Comment ça marche</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium" style={{ color: theme.text }}>Tarifs</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium" style={{ color: theme.text }}>FAQ</a>
            <Link to="/guide" className="py-2 text-sm font-medium" style={{ color: theme.text }}>Guide</Link>
            <Link to="/contact" className="py-2 text-sm font-medium" style={{ color: theme.text }}>Contact</Link>
            <Link to="/connexion"><Button icon={LogIn} variant="ghost" size="sm" className="w-full justify-center">Connexion</Button></Link>
            <Link to="/register"><Button icon={Sparkles} variant="primary" size="sm" className="w-full justify-center">Essai gratuit</Button></Link>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden">
        {/* Halo décoratif derrière le titre */}
        <div
          className="pointer-events-none absolute -top-28 left-1/2 h-[380px] w-[680px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(229,172,95,0.22) 0%, rgba(242,239,233,0) 70%)" }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-9 px-5 py-12 sm:py-16 lg:grid-cols-2 lg:gap-8">
          <div className="text-center lg:text-left">
            <div className="mb-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                <Star size={12} fill={theme.gold} color={theme.gold} /> Conçu pour les vendeurs malgaches
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.greenSoft, color: theme.green }}>
                <StatusDot color={theme.green} size={7} pulse /> Assistant en ligne 24h/24
              </span>
            </div>
            <h1 className="text-[2.1rem] sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.07] tracking-tight" style={{ color: theme.text }}>
              Automatisez vos réseaux sur Facebook & Instagram avec <Em>l'IA</Em>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed sm:text-base lg:mx-0" style={{ color: theme.textMuted }}>
              SuiteFlow répond automatiquement aux commentaires et messages, détecte vos leads, modère vos lives et gère toutes vos pages depuis un seul endroit.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-2.5 lg:justify-start">
              <Link to="/register"><Button variant="primary" size="lg" icon={ArrowRight}>Commencer gratuitement</Button></Link>
              <Link to="/connexion"><Button icon={LogIn} variant="ghost" size="lg">J'ai déjà un compte</Button></Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start">
              {[
                { icon: Facebook, label: "Facebook", c: "#1877F2" },
                { icon: Instagram, label: "Instagram", c: "#E4405F" },
                { icon: Sparkles, label: "IA Groq", c: theme.goldDark },
              ].map((b) => (
                <span key={b.label} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.textMuted }}>
                  <b.icon size={14} style={{ color: b.c }} /> {b.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <ChatDemo />
          </div>
        </div>
      </section>

      {/* Bandeau d'arguments : compact, 4 colonnes */}
      <section className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl md:grid-cols-4" style={{ background: theme.border, border: `1px solid ${theme.border}` }}>
            {trust.map((t) => (
              <div key={t.t} className="flex items-center gap-2.5 px-4 py-3.5" style={{ background: theme.bgCard }}>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: theme.goldSoft }}>
                  <t.icon size={15} style={{ color: theme.goldDark }} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold" style={{ color: theme.text }}>{t.t}</span>
                  <span className="block truncate text-[11px]" style={{ color: theme.textMuted }}>{t.d}</span>
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-5 py-14">
        <Reveal>
          <div className="mb-8 text-center">
            <SectionLabel>Comment ça marche</SectionLabel>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold" style={{ color: theme.text }}>
              Trois étapes, et c'est <Em>parti</Em>
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 110}>
              <div className="relative h-full rounded-2xl p-5 card-x">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${s.c}1A`, border: `1px solid ${s.c}33` }}>
                    <s.icon size={19} style={{ color: s.c }} />
                  </span>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: theme.textMuted }}>Étape {i + 1}</span>
                </div>
                <h3 className="mb-1 text-[15px] font-bold" style={{ color: theme.text }}>{s.t}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: theme.textMuted }}>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-14">
        <Reveal>
          <div className="mb-8 text-center">
            <SectionLabel>Fonctionnalités</SectionLabel>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold" style={{ color: theme.text }}>
              Tout ce qu'il vous <Em>faut</Em>
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={(i % 4) * 90}>
              <div
                className="group h-full rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md card-x">
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                  style={{ background: `${f.c}1A`, border: `1px solid ${f.c}33` }}
                >
                  <f.icon size={19} style={{ color: f.c }} />
                </div>
                <h3 className="mb-1 text-[14.5px] font-bold leading-snug" style={{ color: theme.text }}>{f.t}</h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: theme.textMuted }}>{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <PricingSection />

      <section id="faq" className="mx-auto max-w-3xl px-5 py-14">
        <Reveal>
          <div className="mb-7 text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold" style={{ color: theme.text }}>
              Questions <Em>fréquentes</Em>
            </h2>
          </div>
        </Reveal>
        <div className="flex flex-col gap-2">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 50}>
              <FaqItem q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-16" style={{ background: theme.bgDark }}>
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(229,172,95,0.28) 0%, rgba(28,24,19,0) 70%)" }}
              aria-hidden
            />
            <span className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "rgba(34,197,94,0.14)", color: theme.greenLight }}>
              <StatusDot color={theme.greenLight} size={7} pulse /> Mise en route en quelques minutes
            </span>
            <h2 className="relative mt-4 text-2xl sm:text-3xl font-bold text-white">Prêt à libérer du temps sur vos réseaux ?</h2>
            <p className="relative mx-auto mt-2.5 max-w-md text-sm" style={{ color: "#ffffffb3" }}>
              Connectez votre première page en quelques minutes, sans engagement.
            </p>
            <div className="relative mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Link to="/register"><Button variant="primary" size="lg" icon={ArrowRight}>Commencer gratuitement</Button></Link>
              <Link to="/guide">
                {/* Bandeau toujours sombre : bouton clair sur fond sombre, quel que soit le thème */}
                <Button icon={BookOpen}
                  variant="ghost"
                  size="lg"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)" }}
                >
                  Voir le guide
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer style={{ background: theme.bgDark2 }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-7 px-5 py-9 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo dark />
            <p className="mt-2.5 text-[13px]" style={{ color: "#ffffff80" }}>L'IA qui répond pour vous, à Madagascar et au-delà.</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: theme.greenLight }}>
              <StatusDot color={theme.greenLight} size={6} pulse /> Facebook & Instagram pris en charge
            </span>
          </div>
          {[
            { t: "Produit", l: [{ label: "Fonctionnalités", href: "#features" }, { label: "Comment ça marche", href: "#how" }, { label: "Tarifs", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
            { t: "Ressources", l: [{ label: "Guide de démarrage", to: "/guide" }, { label: "Nous contacter", to: "/contact" }] },
            { t: "Légal", l: [{ label: "Mentions légales", to: "/mentions-legales" }, { label: "Confidentialité", to: "/confidentialite" }, { label: "CGU", to: "/cgu" }] },
          ].map((c, i) => (
            <div key={i}>
              <p className="mb-2.5 text-[13px] font-bold text-white">{c.t}</p>
              <ul className="flex flex-col gap-1.5">
                {c.l.map((x) =>
                  "to" in x ? (
                    <li key={x.label}><Link to={x.to} className="text-[13px] hover:opacity-80" style={{ color: "#ffffff80" }}>{x.label}</Link></li>
                  ) : (
                    <li key={x.label}><a href={x.href} className="text-[13px] hover:opacity-80" style={{ color: "#ffffff80" }}>{x.label}</a></li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-5 py-4 text-[13px]" style={{ borderTop: `1px solid ${theme.bgDark}`, color: "#ffffff66" }}>© 2026 SuiteFlow. Tous droits réservés.</div>
      </footer>
    </div>
  );
}

function PricingSection() {
  const [period, setPeriod] = useState<Period>("MONTHLY");

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-14">
      <Reveal>
        <div className="mb-6 text-center">
          <SectionLabel>Tarifs</SectionLabel>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold" style={{ color: theme.text }}>
            Des tarifs <Em>simples</Em>
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: theme.textMuted }}>
            Sans engagement : payez au mois ou à l'année par {MOBILE_MONEY}.
          </p>
        </div>

        <PeriodSwitch value={period} onChange={setPeriod} className="mx-auto mb-8" />
      </Reveal>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_DEFS.map((pl, i) => (
          <Reveal key={pl.id} delay={i * 90}>
            <PlanTile
              def={pl}
              price={catalogPrice(pl)}
              period={period}
              action={
                pl.base ? (
                  <Link to="/register"><Button icon={Sparkles} variant={pl.hl ? "primary" : "ghost"} size="sm" className="w-full justify-center">Essai gratuit 14 jours</Button></Link>
                ) : (
                  <Link to="/contact?sujet=agence"><Button icon={Mail} variant="ghost" size="sm" className="w-full justify-center">Nous contacter</Button></Link>
                )
              }
            />
          </Reveal>
        ))}
      </div>
      <CompareTable />
      <div className="mx-auto mt-6 flex max-w-3xl flex-col gap-1.5 text-center text-[12.5px]" style={{ color: theme.textMuted }}>
        <p>
          <Sparkles size={13} className="mr-1 inline align-text-bottom" style={{ color: theme.goldDark }} />
          Besoin de plus ? Rechargez {fmt(AI_PACK.replies)} réponses automatiques pour <strong style={{ color: theme.text }}>{fmt(AI_PACK.price)} Ar</strong>, sans expiration.
          Les réponses par mots-clés sont illimitées et ne comptent pas dans le volume IA.
        </p>
        <p>
          <ShieldCheck size={13} className="mr-1 inline align-text-bottom" style={{ color: theme.goldDark }} />
          Vous gardez la main : chaque règle, IA comprise, peut être réglée en validation manuelle.
        </p>
      </div>
    </section>
  );
}

// Comparatif détaillé : une colonne par formule, première colonne figée sur mobile, formule Pro mise en avant
function CompareTable() {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(COMPARE_ROWS.map((r) => r.group))];

  return (
    <div className="mx-auto mt-8 max-w-5xl">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="compare-table"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.text }}
        >
          {open ? "Masquer le comparatif" : "Comparer les formules en détail"}
          <ChevronDown size={15} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </button>
      </div>
      <div id="compare-table" className="grid transition-all duration-300" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="mt-5 overflow-x-auto rounded-2xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ background: theme.bgCard, color: theme.textMuted }}>Formule</th>
                  {PLAN_DEFS.map((p) => (
                    <th key={p.id} className="px-3 py-3 text-center" style={p.hl ? { background: theme.goldSoft } : undefined}>
                      <span className="block text-[14px] font-bold" style={{ color: theme.text }}>{p.name}</span>
                      <span className="block text-[11.5px] font-medium" style={{ color: theme.textMuted }}>{p.base ? `${fmt(p.base)} Ar/mois` : "Sur devis"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g} group={g} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupRows({ group }: { group: string }) {
  return (
    <>
      <tr>
        <th colSpan={5} className="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: theme.goldDark, borderTop: `1px solid ${theme.border}` }}>
          {group}
        </th>
      </tr>
      {COMPARE_ROWS.filter((r) => r.group === group).map((r) => (
        <tr key={r.label}>
          <th scope="row" className="sticky left-0 z-10 w-[150px] min-w-[150px] px-3 py-2 text-[12.5px] font-medium sm:w-auto sm:px-4 sm:text-[13px]" style={{ background: theme.bgCard, color: theme.text }}>{r.label}</th>
          {r.values.map((v, i) => (
            <td key={PLAN_DEFS[i].id} className="px-3 py-2 text-center font-medium" style={{ color: theme.text, background: PLAN_DEFS[i].hl ? theme.goldSoft : undefined }}>
              {v === true ? (
                <Check size={16} className="mx-auto" style={{ color: theme.green }} aria-label="Inclus" />
              ) : v === false ? (
                <Minus size={16} className="mx-auto" style={{ color: theme.textMuted }} aria-label="Non inclus" />
              ) : (
                v
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl" style={{ background: theme.bgCard, border: `1px solid ${open ? `${theme.gold}66` : theme.border}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="text-[13.5px] font-semibold" style={{ color: theme.text }}>{q}</span>
        <ChevronDown size={17} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      <div className="grid transition-all duration-300" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <p className="px-4 pb-3.5 text-[13px] leading-relaxed" style={{ color: theme.textMuted }}>{a}</p>
        </div>
      </div>
    </div>
  );
}
