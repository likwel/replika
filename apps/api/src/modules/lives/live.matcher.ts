// Détection des « JP » (j'prends) dans les commentaires d'un live et lecture des coordonnées des clients

export interface JpProduct {
  code: string;
  name: string;
  price: number | null;
  stock?: number | null;
}

export interface Detection {
  isJp: boolean;
  code: string | null; // code article (catalogue, ou jeton du type « 12 », « A3 »)
  label: string | null; // texte libre après le mot-clé, quand l'article n'est pas au catalogue
  quantity: number;
  product: JpProduct | null;
}

export const FIELDS = ["nom", "telephone", "adresse"] as const;
export type ContactField = (typeof FIELDS)[number];
export const FIELD_LABELS: Record<ContactField, string> = {
  nom: "votre nom complet",
  telephone: "votre numéro de téléphone",
  adresse: "votre adresse de livraison",
};

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const parseKeywords = (raw: string) => [...new Set(raw.split(/[,;\n]/).map(normalize).filter(Boolean))];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokenize = (s: string) => s.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
const QUANTITY = [/(?:^|\s)[x×*]\s?(\d{1,2})(?!\d)/u, /(?:^|\s)(\d{1,2})\s?(?:x|×|pcs?|pieces?)(?![\p{L}\p{N}])/u, /\bqte?\s*:?\s*(\d{1,2})\b/u];
const isQuantity = (t: string) => /^[x×]\d{1,2}$|^\d{1,2}(x|pcs?)$/.test(t);
// Mots sans valeur de code, en français et en malgache
const FILLER = new Set(
  "n no num numero nr code ref reference article art le la les l un une de du des pour moi svp stp merci please ilay ny aho azafady misaotra ity iny"
    .split(" ")
);
const looksLikeCode = (t: string) => /^(?=.*\d)[\p{L}\p{N}-]{1,8}$/u.test(t) || /^\p{L}$/u.test(t);
const compact = (s: string) => normalize(s).replace(/[\s-]+/g, "");

export function detectJp(text: string, keywords: string[], products: JpProduct[] = []): Detection {
  const none: Detection = { isJp: false, code: null, label: null, quantity: 1, product: null };
  const norm = normalize(text);

  // Mot-clé entier, le plus tôt dans le texte : « jp », « jp12 » (collé au numéro) oui ; « jpeg » non
  let found: { start: number; end: number } | null = null;
  for (const kw of keywords) {
    const m = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(kw)})(?=$|[^\\p{L}])`, "u").exec(norm);
    if (!m) continue;
    const start = m.index + m[1].length;
    if (!found || start < found.start) found = { start, end: start + m[2].length };
  }
  if (!found) return none;

  let quantity = 1;
  for (const re of QUANTITY) {
    const q = re.exec(norm);
    if (q) {
      quantity = Math.min(99, Math.max(1, Number(q[1])));
      break;
    }
  }

  const keywordTokens = new Set(keywords.flatMap(tokenize));
  const useful = (t: string) => !keywordTokens.has(t) && !FILLER.has(t) && !isQuantity(t);
  const after = tokenize(norm.slice(found.end)).filter(useful);
  const before = tokenize(norm.slice(0, found.start)).filter(useful).reverse();

  // Catalogue : le premier code connu, de préférence après le mot-clé
  if (products.length) {
    const byCode = new Map(products.map((p) => [compact(p.code), p]));
    const hit = [...after, ...before].map((t) => byCode.get(t)).find(Boolean);
    if (hit) return { isJp: true, code: hit.code, label: null, quantity, product: hit };
  }

  // Une lettre seule n'est un code que juste après le mot-clé (« jp A », mais pas « … taille M »)
  const code =
    (after[0] && looksLikeCode(after[0]) ? after[0] : undefined) ??
    after.find((t) => /\d/.test(t) && looksLikeCode(t)) ??
    before.find((t) => /^\d{1,4}$/.test(t)) ??
    null;
  const rest = text
    .slice(Math.min(text.length, found.end))
    .replace(/^[\s:#°.,-]+/, "")
    .trim()
    .slice(0, 80);
  return {
    isJp: true,
    code: code ? code.toUpperCase() : null,
    label: rest && !(code && compact(rest) === code) ? rest : null,
    quantity,
    product: null,
  };
}

// ============================================================
// Modèles de messages
// ============================================================

export function renderTemplate(template: string, vars: Record<string, string | null | undefined>) {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => vars[key.toLowerCase()] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}

export const formatAriary = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : `${n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} Ar`;

// ============================================================
// Coordonnées du client (réponse en message privé)
// ============================================================

export interface Contact {
  fullName?: string;
  phone?: string;
  address?: string;
}

// Numéros malgaches : 03X XX XXX XX, +261 3X XX XXX XX
const PHONE = /(?:\+\s?261|00\s?261|\b0)\s?3[2-9](?:[\s.-]?\d){7}\b/;
const GENERIC_PHONE = /(?:\+?\d[\s.-]?){8,15}/;
const GREETING = /^(bonjour|bonsoir|salut|salama|manao ahoana|merci|misaotra|ok|oui|eny|d'accord|voici|ity|ireto)\b[\s,!.:]*/i;
const NAME_INTRO = /(?:je m'appelle|je suis|moi c'est|mon nom est|mon nom c'est|izaho dia|izaho|anarako)\s*:?\s*([\p{L}' -]{3,60})/iu;
const ADDRESS_HINT =
  /\b(lot|rue|avenue|av|cit[eé]|quartier|pr[eè]s|en face|ambony|ambany|akaikin|immeuble|porte|villa|ville|commune|fokontany|arrondissement|antananarivo|tana|toamasina|tamatave|mahajanga|majunga|fianarantsoa|toliara|tul[eé]ar|antsiranana|di[eé]go|antsirabe)\b/i;
const LABELED: Array<[keyof Contact, RegExp]> = [
  ["fullName", /(?:^|[\n,;])\s*(?:nom(?:\s+complet)?|anarana|name)\s*[:=-]\s*([^\n,;]+)/i],
  ["phone", /(?:^|[\n,;])\s*(?:t[ée]l[ée]?(?:phone)?|num[ée]ro|contact|finday|laharana)\s*[:=-]\s*([^\n,;]+)/i],
  ["address", /(?:^|[\n,;])\s*(?:adresse|adiresy|address|lieu|toerana|quartier)(?:\s+de\s+livraison)?\s*[:=-]\s*([^\n;]+)/i],
];

export function formatPhone(raw: string): string | undefined {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("261")) digits = `0${digits.slice(3)}`;
  if (/^03\d{8}$/.test(digits)) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return digits.length >= 8 && digits.length <= 15 ? raw.trim() : undefined;
}

const looksLikeName = (s: string) =>
  /^[\p{L}' -]{3,60}$/u.test(s) && s.trim().split(/\s+/).length <= 5 && !ADDRESS_HINT.test(s) && !GREETING.test(s);

export function parseContact(text: string): Contact {
  const out: Contact = {};
  let rest = text;

  for (const [field, re] of LABELED) {
    const m = re.exec(rest);
    if (!m) continue;
    const value = m[1].trim();
    if (field === "phone") {
      const phone = formatPhone(value);
      if (phone) out.phone = phone;
    } else if (value) {
      out[field] = value;
    }
    rest = rest.replace(m[0], "\n");
  }

  if (!out.phone) {
    const m = PHONE.exec(rest) ?? GENERIC_PHONE.exec(rest);
    const phone = m ? formatPhone(m[0]) : undefined;
    if (m && phone) {
      out.phone = phone;
      rest = rest.replace(m[0], "\n");
    }
  }

  if (!out.fullName) {
    const m = NAME_INTRO.exec(rest);
    if (m) {
      out.fullName = m[1].trim().replace(/\s+/g, " ");
      rest = rest.replace(m[0], "\n");
    }
  }

  // Le reste, morceau par morceau : un nom (lettres seules) ou une adresse (chiffres, repères de lieu)
  const addressParts: string[] = [];
  for (const raw of rest.split(/[\n,;]/)) {
    const part = raw.replace(GREETING, "").trim();
    if (part.length < 3) continue;
    if (!out.fullName && looksLikeName(part)) out.fullName = part.replace(/\s+/g, " ");
    else if (ADDRESS_HINT.test(part) || /\d/.test(part) || part.split(/\s+/).length >= 3) addressParts.push(part);
  }
  if (!out.address && addressParts.length) out.address = addressParts.join(", ").slice(0, 300);
  return out;
}

const FIELD_OF: Record<ContactField, keyof Contact> = { nom: "fullName", telephone: "phone", adresse: "address" };

export const parseFields = (raw: string): ContactField[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ContactField => (FIELDS as readonly string[]).includes(s));

export const missingFields = (contact: Contact | { fullName: string | null; phone: string | null; address: string | null }, required: ContactField[]) =>
  required.filter((f) => !contact[FIELD_OF[f]]);
