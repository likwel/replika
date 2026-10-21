import dotenv from "dotenv";
dotenv.config();

// Adresse de l'API vue par le navigateur : base des adresses de retour OAuth (connexion Facebook / Google).
// Distincte de PUBLIC_API_URL, qui peut être un tunnel réservé au téléchargement des images par Meta.
function apiUrl(): string {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/+$/, "");
  try {
    if (process.env.FB_REDIRECT_URI) return new URL(process.env.FB_REDIRECT_URI).origin;
  } catch {
    // adresse invalide : valeur par défaut
  }
  return `http://localhost:${process.env.PORT ?? 4000}`;
}

// Adresse publique de l'API : Instagram télécharge les images à publier depuis cette adresse
function publicApiUrl(): string {
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/+$/, "");
  try {
    if (process.env.FB_REDIRECT_URI) return new URL(process.env.FB_REDIRECT_URI).origin;
  } catch {
    // adresse invalide : valeur par défaut
  }
  return `http://localhost:${process.env.PORT ?? 4000}`;
}

// Expéditeur : MAIL_FROM, sinon SMTP_FROM (+ SMTP_FROM_NAME) comme factura.mg, sinon le compte SMTP
function mailFrom(): string {
  const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "") || "";
  if (clean(process.env.MAIL_FROM)) return clean(process.env.MAIL_FROM);
  const address = clean(process.env.SMTP_FROM).replace(/^<|>$/g, "") || clean(process.env.SMTP_USER);
  if (!address) return "SuiteFlow <no-reply@suiteflow.mg>";
  return `${clean(process.env.SMTP_FROM_NAME) || "SuiteFlow"} <${address}>`;
}

// Cloudflare Turnstile : les deux clés doivent venir du même site Turnstile. Une seule renseignée = configuration
// incomplète (le widget de test produirait des jetons refusés par la vraie clé secrète).
function turnstileKeys() {
  const site = process.env.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (site && secret) return { siteKey: site, secretKey: secret, incomplete: false };
  const incomplete = Boolean(site || secret);
  if (process.env.NODE_ENV !== "production") {
    // Clés de test Cloudflare : le widget s'affiche et valide toujours
    return { siteKey: "1x00000000000000000000AA", secretKey: "1x0000000000000000000000000000000AA", incomplete };
  }
  return { siteKey: "", secretKey: "", incomplete };
}

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Variable d'environnement manquante : ${key}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  fb: {
    appId: process.env.FB_APP_ID ?? "",
    appSecret: process.env.FB_APP_SECRET ?? "",
    redirectUri: process.env.FB_REDIRECT_URI ?? "",
    apiVersion: process.env.FB_API_VERSION ?? "v21.0", // ← ajouté
    graphUrl: process.env.FB_GRAPH_URL ?? "https://graph.facebook.com", // remplaçable (tests, proxy)
    webhookVerifyToken: process.env.FB_WEBHOOK_VERIFY_TOKEN ?? "",
    scopes: process.env.FB_SCOPES ?? "", // surcharge optionnelle des permissions OAuth (séparées par des virgules)
  },
  // Modèle IA : toute API compatible OpenAI (Groq, Gemini, OpenRouter, Ollama…)
  ai: {
    baseUrl: process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1",
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
    // Coût estimé d'une réponse IA en ariary (tableau de bord administrateur) ; ~1 Ar avec gpt-oss-20b
    costPerReply: Number(process.env.AI_COST_PER_REPLY ?? 1),
  },
  publicApiUrl: publicApiUrl(),
  apiUrl: apiUrl(),
  // Connexion avec Google (console.cloud.google.com → Identifiants → ID client OAuth « Application Web »)
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  uploadsDir: process.env.UPLOADS_DIR ?? "uploads", // images des publications programmées
  // Robot de publication : intervalle de vérification (secondes) ; 0 = désactivé
  schedulerSeconds: Number(process.env.SCHEDULER_SECONDS ?? 30),
  // Lives : intervalle de lecture des commentaires des sessions actives (secondes) ; 0 = désactivé
  livePollSeconds: Number(process.env.LIVE_POLL_SECONDS ?? 5),
  autoReply: {
    // intervalle du polling de secours (secondes) ; 0 = désactivé, webhooks uniquement
    pollSeconds: Number(process.env.AUTOREPLY_POLL_SECONDS ?? 30),
  },
  // Paiement des abonnements : Papi.mg (MVola, Orange Money, Airtel Money, carte)
  papi: {
    baseUrl: (process.env.PAPI_BASE_URL ?? "https://app.papi.mg/engine/api").replace(/\/+$/, ""),
    apiKey: process.env.PAPI_API_KEY ?? "",
    secretKey: process.env.PAPI_SECRET_KEY ?? "", // pwhsec_… : signe les notifications de paiement
    // Paiements de test (numéros sandbox) : par défaut hors production
    testMode: process.env.PAPI_TEST_MODE ? process.env.PAPI_TEST_MODE === "true" : process.env.NODE_ENV !== "production",
    linkHours: Number(process.env.PAPI_LINK_HOURS ?? 24), // validité d'un lien de paiement (1 à 596 h)
    // Commission Papi quand la notification ne la donne pas : mode du compte Papi (papi.mg/pricing),
    // ou un pourcentage unique qui remplace les taux par moyen de paiement
    feeMode: (process.env.PAPI_FEE_MODE === "direct" ? "direct" : "transit") as "direct" | "transit",
    feePercent: process.env.PAPI_FEE_PERCENT ? Number(process.env.PAPI_FEE_PERCENT) : null,
  },
  // E-mails (codes de validation en deux étapes) : SMTP, par ex. Gmail avec un mot de passe d'application
  mail: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Number(process.env.SMTP_PORT ?? 465) === 465,
    user: process.env.SMTP_USER ?? "",
    // Gmail affiche le mot de passe d'application par groupes de 4 : les espaces ne font pas partie du mot de passe
    pass: /gmail|google/i.test(process.env.SMTP_HOST ?? "") ? (process.env.SMTP_PASS ?? "").replace(/\s/g, "") : (process.env.SMTP_PASS ?? ""),
    from: mailFrom(),
  },
  // Cloudflare Turnstile (anti-robot) sur la connexion et l'inscription. Sans clés : clés de test Cloudflare
  // hors production (le widget s'affiche et valide toujours), désactivé en production.
  turnstile: turnstileKeys(),
  // Destinataire(s) du formulaire « Nous contacter » (séparés par des virgules) ; par défaut les administrateurs
  contactEmail: process.env.CONTACT_EMAIL ?? "",
  // Chiffrement des secrets Google Authenticator (par défaut dérivé de JWT_SECRET)
  twoFactorKey: process.env.TWO_FACTOR_KEY ?? process.env.JWT_SECRET ?? "",
  // Live Manager à l'unité : prix d'une heure (Ar)
  liveHourPrice: Number(process.env.LIVE_HOUR_PRICE ?? 2500),
  // Crédits de réponses automatiques : vendus par packs (réponses par pack, prix d'un pack en Ar)
  replyPack: { size: Number(process.env.REPLY_PACK_SIZE ?? 1000), price: Number(process.env.REPLY_PACK_PRICE ?? 9900) },
  // Vérification des paiements en attente auprès de Papi (secondes) ; 0 = désactivé
  billingReconcileSeconds: Number(process.env.BILLING_RECONCILE_SECONDS ?? 120),
  isProd: process.env.NODE_ENV === "production",
} as const;

