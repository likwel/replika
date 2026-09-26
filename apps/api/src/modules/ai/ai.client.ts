import axios from "axios";
import { env } from "../../config/env.js";

// Client minimal pour toute API compatible OpenAI (/chat/completions) :
// Groq, Google Gemini, OpenRouter, Ollama… Changer de fournisseur = changer 3 variables d'env.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const isLocal = (url: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url);

// Ollama en local n'a pas besoin de clé
export const isAiConfigured = () => Boolean(env.ai.apiKey) || isLocal(env.ai.baseUrl);

export function aiProviderName(): string {
  const url = env.ai.baseUrl;
  if (url.includes("groq.com")) return "Groq";
  if (url.includes("generativelanguage.googleapis.com")) return "Google Gemini";
  if (url.includes("openrouter.ai")) return "OpenRouter";
  if (url.includes(":11434")) return "Ollama (local)";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function aiErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 429) return "quota gratuit du modèle atteint, réessayez plus tard";
    if (e.response?.status === 401 || e.response?.status === 403) return "clé API refusée (AI_API_KEY)";
    const data = e.response?.data as
      | { error?: { message?: string } | string }
      | Array<{ error?: { message?: string } }>
      | undefined;
    const msg = Array.isArray(data)
      ? data[0]?.error?.message
      : typeof data?.error === "string"
        ? data.error
        : data?.error?.message;
    if (msg) return msg;
    if (e.code === "ECONNABORTED") return "le modèle n'a pas répondu à temps";
    if (e.code === "ECONNREFUSED") return `serveur IA injoignable (${env.ai.baseUrl})`;
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

async function post(messages: ChatMessage[], json: boolean): Promise<string> {
  const { data } = await axios.post(
    `${env.ai.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      model: env.ai.model,
      messages,
      temperature: 0.4,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    },
    {
      headers: env.ai.apiKey ? { Authorization: `Bearer ${env.ai.apiKey}` } : {},
      timeout: 60_000, // un modèle local (Ollama sur CPU) peut être lent
    }
  );
  return (data?.choices?.[0]?.message?.content as string | undefined) ?? "";
}

// Demande une sortie JSON ; si le fournisseur refuse response_format (400), on réessaie sans
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  try {
    return await post(messages, true);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 400) return post(messages, false);
    throw e;
  }
}
