import type { RuleInput } from "@/lib/automation.api";

export const EMPTY_RULE: RuleInput = {
  name: "",
  channel: "ALL",
  matchType: "CONTAINS",
  trigger: "",
  response: "",
  useAi: false,
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

// Modèles de départ proposés quand aucune règle n'existe (validation manuelle par défaut)
export const RULE_PRESETS: Array<{ label: string; rule: Partial<RuleInput> }> = [
  {
    label: "Demande de prix",
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
    label: "Livraison",
    rule: {
      name: "Livraison",
      trigger: "livraison, livrer, livrez, frais de port",
      response: "Oui {nom}, nous livrons ! Écrivez-nous en message privé pour les détails 🚚",
    },
  },
  {
    label: "Accueil Messenger",
    rule: {
      name: "Message d'accueil",
      channel: "DIRECT",
      matchType: "ANY",
      response: "Bonjour {nom} 👋 Merci pour votre message ! Nous vous répondons très vite. — L'équipe {page}",
    },
  },
];
