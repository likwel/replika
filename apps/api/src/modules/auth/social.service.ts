import axios from "axios";
import { env } from "../../config/env.js";
import { graphClient } from "../facebook/graph.client.js";

export const SOCIAL_PROVIDERS = ["facebook", "google"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const PROVIDER_LABEL: Record<SocialProvider, string> = { facebook: "Facebook", google: "Google" };

export interface SocialProfile {
  provider: SocialProvider;
  providerId: string;
  email: string | null;
  emailVerified: boolean; // le fournisseur garantit que l'adresse appartient à la personne
  name: string;
}

// Adresse de retour à déclarer chez le fournisseur (Meta : « URI de redirection OAuth valides » ; Google : « URI de redirection autorisés »)
export const callbackUrl = (provider: SocialProvider) => `${env.apiUrl}/api/auth/${provider}/callback`;

export const isConfigured = (provider: SocialProvider) =>
  provider === "facebook" ? Boolean(env.fb.appId && env.fb.appSecret) : Boolean(env.google.clientId && env.google.clientSecret);

export function authorizeUrl(provider: SocialProvider, state: string): string {
  if (provider === "facebook") {
    const params = new URLSearchParams({
      client_id: env.fb.appId,
      redirect_uri: callbackUrl("facebook"),
      state,
      scope: "email,public_profile",
      response_type: "code",
    });
    return `https://www.facebook.com/${env.fb.apiVersion}/dialog/oauth?${params}`;
  }
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: callbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Échange le code de retour contre le profil de la personne (serveur à serveur, avec le secret de l'app)
export async function fetchProfile(provider: SocialProvider, code: string): Promise<SocialProfile> {
  if (provider === "facebook") {
    const token = await graphClient.exchangeCodeForToken(code, callbackUrl("facebook"));
    const me = await graphClient.getProfile(token);
    // Facebook ne transmet que des adresses confirmées sur le compte
    return { provider, providerId: me.id, email: me.email ?? null, emailVerified: Boolean(me.email), name: me.name };
  }

  const { data: tokens } = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: callbackUrl("google"),
      grant_type: "authorization_code",
    })
  );
  const { data: me } = await axios.get("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  return {
    provider,
    providerId: String(me.sub),
    email: me.email ?? null,
    emailVerified: me.email_verified === true,
    name: me.name ?? me.email ?? "Utilisateur Google",
  };
}
