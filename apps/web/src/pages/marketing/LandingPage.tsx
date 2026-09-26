import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot, MessageCircle, BarChart3, CalendarDays, Radio, Check,
  ArrowRight, Menu, X, Star, ShieldCheck,
} from "lucide-react";
import { theme } from "@/theme";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

const features = [
  { icon: Bot, t: "Réponses IA automatiques", d: "L'IA répond aux commentaires et messages selon l'intention détectée, 24h/24." },
  { icon: MessageCircle, t: "Détection de leads", d: "Repère automatiquement les clients potentiels et les escalade à votre équipe." },
  { icon: CalendarDays, t: "Planification multi-réseaux", d: "Programmez vos publications Facebook et Instagram depuis un seul calendrier." },
  { icon: Radio, t: "Modération des Lives", d: "Filtrez les spams et répondez aux questions en direct pendant vos lives." },
  { icon: BarChart3, t: "Statistiques unifiées", d: "Suivez l'engagement de toutes vos pages au même endroit." },
  { icon: ShieldCheck, t: "Validation humaine", d: "Gardez le contrôle : l'IA propose, vous validez d'un clic si besoin." },
];

const plans = [
  { name: "Starter", price: "49 000", per: "Ar/mois", feats: ["2 comptes connectés", "500 réponses IA/mois", "Planification", "Statistiques de base"], hl: false },
  { name: "Pro", price: "129 000", per: "Ar/mois", feats: ["10 comptes connectés", "Réponses IA illimitées", "Détection de leads", "Modération Lives", "Support prioritaire"], hl: true },
  { name: "Agence", price: "Sur devis", per: "", feats: ["Comptes illimités", "Multi-équipes", "API & intégrations", "Accompagnement dédié"], hl: false },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ background: theme.bg }}>
      <header className="sticky top-0 z-50 backdrop-blur" style={{ background: "rgba(242,239,233,0.85)", borderBottom: `1px solid ${theme.border}` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: theme.text }}>
            <a href="#features" className="hover:opacity-70">Fonctionnalités</a>
            <a href="#pricing" className="hover:opacity-70">Tarifs</a>
            <Link to="/guide" className="hover:opacity-70">Guide</Link>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Connexion</Button></Link>
            <Link to="/register"><Button variant="primary" size="sm">Essai gratuit</Button></Link>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-2">
            <a href="#features" className="py-2 text-sm" style={{ color: theme.text }}>Fonctionnalités</a>
            <a href="#pricing" className="py-2 text-sm" style={{ color: theme.text }}>Tarifs</a>
            <Link to="/guide" className="py-2 text-sm" style={{ color: theme.text }}>Guide</Link>
            <Link to="/login"><Button variant="ghost" size="sm" className="w-full justify-center">Connexion</Button></Link>
            <Link to="/register"><Button variant="primary" size="sm" className="w-full justify-center">Essai gratuit</Button></Link>
          </div>
        )}
      </header>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6" style={{ background: theme.goldSoft, color: theme.goldDark }}>
          <Star size={13} fill={theme.gold} color={theme.gold} /> Conçu pour les vendeurs malgaches
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight" style={{ color: theme.text }}>
          Automatisez vos réseaux sur Facebook & Instagram avec{" "}
          <em style={{ color: theme.gold, fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>l'IA</em>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg" style={{ color: theme.textMuted }}>
          ReplyKA répond automatiquement aux commentaires et messages, détecte vos leads, et gère toutes vos pages depuis un seul endroit.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/register"><Button variant="primary" size="lg" icon={ArrowRight}>Commencer gratuitement</Button></Link>
          <Link to="/login"><Button variant="ghost" size="lg">J'ai déjà un compte</Button></Link>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: theme.text }}>
            Tout ce qu'il vous <em style={{ color: theme.gold, fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>faut</em>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl p-6 transition-all hover:shadow-md" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4" style={{ background: theme.goldSoft }}>
                <f.icon size={22} style={{ color: theme.goldDark }} />
              </div>
              <h3 className="font-semibold text-lg mb-1.5" style={{ color: theme.text }}>{f.t}</h3>
              <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: theme.text }}>
            Des tarifs <em style={{ color: theme.gold, fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>simples</em>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {plans.map((pl, i) => (
            <div key={i} className="rounded-2xl p-6 relative" style={{ background: pl.hl ? theme.bgDark : theme.bgCard, border: `1px solid ${pl.hl ? theme.bgDark : theme.border}` }}>
              {pl.hl && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.gold, color: "#1A1410" }}>POPULAIRE</span>}
              <h3 className="font-semibold text-lg" style={{ color: pl.hl ? "#fff" : theme.text }}>{pl.name}</h3>
              <div className="mt-3 mb-5">
                <span className="text-3xl font-extrabold" style={{ color: pl.hl ? theme.goldLight : theme.text }}>{pl.price}</span>
                <span className="text-sm" style={{ color: pl.hl ? "#ffffff99" : theme.textMuted }}> {pl.per}</span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-6">
                {pl.feats.map((ft, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm" style={{ color: pl.hl ? "#ffffffcc" : theme.text }}>
                    <Check size={16} style={{ color: theme.gold }} /> {ft}
                  </li>
                ))}
              </ul>
              <Link to="/register"><Button variant={pl.hl ? "primary" : "ghost"} className="w-full justify-center">Choisir</Button></Link>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ background: theme.bgDark2 }}>
        <div className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo dark />
            <p className="mt-3 text-sm" style={{ color: "#ffffff80" }}>L'IA qui répond pour vous, à Madagascar et au-delà.</p>
          </div>
          {[
            { t: "Produit", l: [{ label: "Fonctionnalités", href: "#features" }, { label: "Tarifs", href: "#pricing" }] },
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