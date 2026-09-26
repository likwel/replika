import dotenv from "dotenv";
dotenv.config();

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
  },
  publicApiUrl: publicApiUrl(),
  uploadsDir: process.env.UPLOADS_DIR ?? "uploads", // images des publications programmées
  // Robot de publication : intervalle de vérification (secondes) ; 0 = désactivé
  schedulerSeconds: Number(process.env.SCHEDULER_SECONDS ?? 30),
  // Lives : intervalle de lecture des commentaires des sessions actives (secondes) ; 0 = désactivé
  livePollSeconds: Number(process.env.LIVE_POLL_SECONDS ?? 5),
  autoReply: {
    // intervalle du polling de secours (secondes) ; 0 = désactivé, webhooks uniquement
    pollSeconds: Number(process.env.AUTOREPLY_POLL_SECONDS ?? 30),
  },
  isProd: process.env.NODE_ENV === "production",
} as const;

