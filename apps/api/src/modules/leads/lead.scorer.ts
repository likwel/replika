// Notation d'un message : signaux d'achat (français, malgache, anglais), coordonnées partagées, intention IA

export interface Scored {
  score: number; // 0 à 100
  signals: string[];
  intent: string | null;
  phone: string | null;
  email: string | null;
}

export const LEAD_THRESHOLD = 30; // en dessous : simple conversation, pas un lead
export const temperature = (score: number) => (score >= 70 ? "hot" : score >= 45 ? "warm" : "cold");

// Texte normalisé : minuscules, sans accents, apostrophes droites
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’`]/g, "'");

const RULES: Array<{ intent: string; label: string; points: number; re: RegExp }> = [
  {
    intent: "commande",
    label: "Intention d'achat",
    points: 40,
    re: /\b(je (le |la |les )?(prends|veux|commande)|j'?prends|jprends|jp|commander|commandes?|reserver|acheter|j'?achete|mila|maka|hividy|haka|order|buy|i want|i'?ll take)\b/,
  },
  { intent: "prix", label: "Demande de prix", points: 30, re: /\b(prix|combien|tarifs?|coute|ohatrinona|hoatrinona|vidiny|how much|price|cost)\b/ },
  {
    intent: "disponibilite",
    label: "Disponibilité",
    points: 20,
    re: /\b(dispo|disponibles?|en stock|il en reste|il reste|encore dispo|(vous avez|avez-vous|tu as|as-tu) encore|mbola misy|misy ve|mbola ao|available|in stock|do you (still )?have)\b/,
  },
  {
    intent: "livraison",
    label: "Livraison",
    points: 20,
    re: /\b(livraison|livrez|livrer|livrons|expedi\w*|frais de port|delivery|shipping|alefa|fandefasana|fanaterana)\b/,
  },
  { intent: "commande", label: "Paiement", points: 25, re: /\b(mvola|orange money|airtel money|paiement|payer|virement|acompte|payment)\b/ },
  { intent: "question", label: "Détails produit", points: 10, re: /\b(taille|pointure|couleur|modele|quantite|qte|size|colou?r|loko|habe)\b/ },
  { intent: "question", label: "Demande de contact", points: 15, re: /\b(mp|inbox|message prive|contactez|appelez|numero|whatsapp|call me|dm)\b/ },
];

// Réclamation ou méfiance : ce n'est pas une opportunité de vente
const NEGATIVE = /\b(arnaque|escroc|rembourse\w*|voleur|nul|scam|fake|spam)\b/;

const PHONE_MG = /(?:\+\s?261|00\s?261|\b0)\s?3[2-9](?:[\s.-]?\d){7}\b/;
const PHONE_INTL = /\+\d[\d\s.-]{7,14}\d/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// Intention renvoyée par l'IA (si configurée) : renforce les signaux lexicaux
const AI_INTENT: Record<string, { label: string; points: number }> = {
  commande: { label: "Intention d'achat (IA)", points: 25 },
  prix: { label: "Demande de prix (IA)", points: 15 },
  livraison: { label: "Livraison (IA)", points: 10 },
  disponibilite: { label: "Disponibilité (IA)", points: 10 },
};

function formatPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("261")) digits = `0${digits.slice(3)}`;
  return /^03\d{8}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}` : raw.trim();
}

export function scoreMessage(text: string, opts: { direct?: boolean; aiIntent?: string | null } = {}): Scored {
  const norm = normalize(text);
  const signals: string[] = [];
  let score = 0;
  let intent: string | null = null;

  for (const r of RULES) {
    if (!r.re.test(norm) || signals.includes(r.label)) continue;
    signals.push(r.label);
    score += r.points;
    intent ??= r.intent;
  }

  const phoneMatch = PHONE_MG.exec(text) ?? PHONE_INTL.exec(text);
  const phone = phoneMatch ? formatPhone(phoneMatch[0]) : null;
  if (phone) {
    signals.push("Téléphone partagé");
    score += 30;
  }
  const email = EMAIL.exec(text)?.[0] ?? null;
  if (email) {
    signals.push("E-mail partagé");
    score += 20;
  }

  const ai = opts.aiIntent ? AI_INTENT[opts.aiIntent] : undefined;
  if (ai) {
    signals.push(ai.label);
    score += ai.points;
    intent = opts.aiIntent!;
  }
  if (opts.aiIntent === "spam" || opts.aiIntent === "reclamation" || NEGATIVE.test(norm)) {
    return { score: 0, signals: [], intent: opts.aiIntent ?? "reclamation", phone, email };
  }
  // Un message privé montre plus d'intérêt qu'un commentaire public
  if (score > 0 && opts.direct) {
    signals.push("Message privé");
    score += 10;
  }
  return { score: Math.min(100, score), signals, intent, phone, email };
}
