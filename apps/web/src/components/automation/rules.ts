import type { LucideIcon } from "lucide-react";
import { Clock, Heart, MessageCircle, PencilLine, Sparkles, Tag, Truck } from "lucide-react";
import type { RuleInput, RuleLanguage } from "@/lib/automation.api";

export const EMPTY_RULE: RuleInput = {
  name: "",
  channel: "ALL",
  matchType: "CONTAINS",
  trigger: "",
  response: "",
  useAi: false,
  language: "ACCOUNT",
  aiKnowledge: null,
  privateReply: null,
  autoSend: false,
  isActive: true,
  priority: 0,
  accountId: null,
  postId: null,
  postLabel: null,
};

export const splitKeywords = (trigger: string) =>
  trigger.split(",").map((k) => k.trim()).filter(Boolean);

export const splitVariants = (response: string | null) =>
  (response ?? "").split("||").map((v) => v.trim()).filter(Boolean);

export type RuleLang = "fr" | "mg";

// Textes des modèles en malagasy (mêmes variables : {nom}, {page})
export const MG_PRESETS: Record<string, { label: string; desc: string; rule: Partial<RuleInput> }> = {
  price: {
    label: "Fangatahana vidiny",
    desc: "Valiana ny commentaire ary alefa amin'ny hafatra manokana ny vidiny.",
    rule: {
      name: "Fangatahana vidiny",
      response: "Salama {nom} 👋 Efa alefanay tamin'ny hafatra manokana ny vidiny ! || Misaotra {nom} ! Ao amin'ny hafatrao ny vidiny 📩",
      privateReply: "Salama {nom}, misaotra tamin'ny fahalianao ! Ireto ny vidiny : …",
    },
  },
  delivery: {
    label: "Fanaterana",
    desc: "Manome toky momba ny fanaterana ary manasa hanoratra manokana.",
    rule: {
      name: "Fanaterana",
      trigger: "fanaterana, mandefa, entana, livraison, frais",
      response: "Eny {nom}, manatera izahay ! Soraty amin'ny hafatra manokana ny antsipiriany 🚚",
    },
  },
  hours: {
    label: "Ora sy adiresy",
    desc: "Manome ny ora fisokafana sy ny adiresy.",
    rule: {
      name: "Ora sy adiresy",
      trigger: "ora, misokatra, fisokafana, adiresy, aiza, toerana",
      response: "Salama {nom} 😊 Misokatra isan'andro amin'ny … ka hatramin'ny … izahay, ao amin'ny … Soraty manokana raha mila fanazavana.",
    },
  },
  thanks: {
    label: "Fisaorana",
    desc: "Misaotra ny fiderana sy ny hevitra tsara.",
    rule: {
      name: "Fisaorana",
      trigger: "misaotra, tsara, bravo, mahafinaritra, top",
      response: "Misaotra betsaka {nom} 💚 || Tsyisy fisaorana {nom} ! Mandra-pihaona any amin'ny {page} 🙏",
    },
  },
  welcome: {
    label: "Fandraisana Messenger",
    desc: "Hafatra fandraisana alefa indray mandeha isan'andro isaky ny olona.",
    rule: {
      name: "Hafatra fandraisana",
      response: "Salama {nom} 👋 Misaotra tamin'ny hafatrao ! Hamaly anao faingana izahay. — Ny ekipan'ny {page}",
    },
  },
  ai: {
    label: "Valiny amin'ny IA",
    desc: "Ny IA no manoratra ny valiny araka ny fampahalalana momba ny pejinao.",
    rule: {
      name: "Valin'ny IA amin'ny fanontaniana",
      trigger: "vidiny, misy, mbola misy, haben'ny, loko, stock",
      aiKnowledge: "Vokatra : …\nVidiny : … Ar\nHabe / loko : …\nFanaterana Tana : … Ar ao anatin'ny 48 ora",
    },
  },
  custom: { label: "Lalàna manokana", desc: "Manomboka amin'ny pejy fotsy.", rule: {} },
};

export const presetFor = (m: RulePreset, lang: RuleLang): RulePreset => {
  const mg = lang === "mg" ? MG_PRESETS[m.id] : null;
  return mg ? { ...m, label: mg.label, desc: mg.desc, rule: { ...m.rule, ...mg.rule } } : m;
};

export interface RulePreset {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  rule: Partial<RuleInput>;
}

// Modèles de départ (validation manuelle par défaut) : choisis à la création d'une règle
export const RULE_PRESETS: RulePreset[] = [
  {
    id: "price",
    label: "Demande de prix",
    desc: "Répond au commentaire et envoie les tarifs en message privé.",
    icon: Tag,
    rule: {
      name: "Demande de prix",
      channel: "COMMENT",
      trigger: "prix, combien, tarif, ohatrinona, vidiny",
      response:
        "Bonjour {nom} 👋 Nous vous avons envoyé le prix en message privé ! || Merci {nom} ! Le tarif vous attend dans vos messages 📩",
      privateReply: "Bonjour {nom}, merci pour votre intérêt ! Voici nos tarifs : …",
    },
  },
  {
    id: "delivery",
    label: "Livraison",
    desc: "Rassure sur la livraison et invite à écrire en privé.",
    icon: Truck,
    rule: {
      name: "Livraison",
      trigger: "livraison, livrer, livrez, frais de port",
      response: "Oui {nom}, nous livrons ! Écrivez-nous en message privé pour les détails 🚚",
    },
  },
  {
    id: "hours",
    label: "Horaires et adresse",
    desc: "Donne vos horaires d'ouverture et votre adresse.",
    icon: Clock,
    rule: {
      name: "Horaires et adresse",
      trigger: "horaire, ouvert, ouverture, adresse, où, localisation",
      response: "Bonjour {nom} 😊 Nous sommes ouverts de … à … , au … Écrivez-nous en message privé pour plus de détails.",
    },
  },
  {
    id: "thanks",
    label: "Remerciement",
    desc: "Remercie les compliments et avis positifs.",
    icon: Heart,
    rule: {
      name: "Remerciement",
      channel: "COMMENT",
      trigger: "merci, super, bravo, magnifique, top",
      response: "Merci beaucoup {nom} 💚 || Avec plaisir {nom} ! À très vite chez {page} 🙏",
    },
  },
  {
    id: "welcome",
    label: "Accueil Messenger",
    desc: "Message d'accueil envoyé une fois par jour à chaque personne.",
    icon: MessageCircle,
    rule: {
      name: "Message d'accueil",
      channel: "DIRECT",
      matchType: "ANY",
      response: "Bonjour {nom} 👋 Merci pour votre message ! Nous vous répondons très vite. — L'équipe {page}",
    },
  },
  {
    id: "ai",
    label: "Réponse par IA",
    desc: "L'IA rédige chaque réponse d'après le contexte de votre compte.",
    icon: Sparkles,
    rule: {
      name: "Réponse IA aux questions",
      trigger: "prix, dispo, disponible, info, taille, couleur, stock",
      useAi: true,
      response: "",
      aiKnowledge: "Produit : …\nPrix : … Ar\nTailles / couleurs : …\nLivraison Tana : … Ar sous 48 h",
    },
  },
  {
    id: "custom",
    label: "Règle personnalisée",
    desc: "Partez d'une page blanche.",
    icon: PencilLine,
    rule: {},
  },
];

// Langue de la réponse d'une règle
export const RULE_LANGUAGES: Array<{ value: RuleLanguage; flag: string; label: string; short: string }> = [
  { value: "ACCOUNT", flag: "⚙️", label: "Comme le compte", short: "" },
  { value: "MG", flag: "🇲🇬", label: "Malagasy", short: "MG" },
  { value: "FR", flag: "🇫🇷", label: "Français", short: "FR" },
  { value: "AUTO", flag: "🌐", label: "Langue du client", short: "AUTO" },
];

// Connaissances de la règle (mini base de connaissances donnée à l'IA) : trames à compléter
export const KNOWLEDGE_MAX = 500;
export const KNOWLEDGE_TEMPLATES: Record<RuleLang, Array<{ label: string; text: string }>> = {
  fr: [
    { label: "Produit et prix", text: "Produit : …\nPrix : … Ar\nTailles / couleurs : …\nStock : …" },
    { label: "Livraison", text: "Livraison Tana : … Ar, sous … h\nProvinces : … Ar, par …\nRetrait en boutique : …" },
    { label: "Paiement", text: "Paiement : MVola (034 …), Orange Money, espèces à la livraison" },
    { label: "Horaires et adresse", text: "Ouvert du … au …, de … h à … h\nAdresse : …" },
  ],
  mg: [
    { label: "Vokatra sy vidiny", text: "Vokatra : …\nVidiny : … Ar\nHabe / loko : …\nIsa misy : …" },
    { label: "Fanaterana", text: "Fanaterana Tana : … Ar, ao anatin'ny … ora\nFaritany : … Ar, amin'ny …\nFakana eny amin'ny toeram-pivarotana : …" },
    { label: "Fandoavam-bola", text: "Fandoavana : MVola (034 …), Orange Money, vola rehefa tonga ny entana" },
    { label: "Ora sy adiresy", text: "Misokatra … ka hatramin'ny …, amin'ny … ka hatramin'ny …\nAdiresy : …" },
  ],
};
