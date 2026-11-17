import axios from "axios";
import { env } from "../../config/env.js";
import { recordAiUsage } from "./ai.usage.js";
import { usageFromResponse } from "./ai.usage.logic.js";

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
  if (url.includes("api.openai.com")) return "OpenAI";
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
    if (e.response?.status === 429) return "limite de requêtes ou quota du fournisseur atteint, réessayez plus tard";
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

const isOpenAi = () => env.ai.baseUrl.includes("api.openai.com");

// Les modèles récents d'OpenAI n'acceptent que la température par défaut : on ne l'envoie pas, et un refus explicite
// du paramètre (400) est réessayé sans lui chez les autres fournisseurs.
async function post(messages: ChatMessage[], json: boolean, withTemperature = !isOpenAi()): Promise<string> {
  try {
    const { data } = await axios.post(
      `${env.ai.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        model: env.ai.model,
        messages,
        ...(withTemperature ? { temperature: 0.4 } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
      },
      {
        headers: env.ai.apiKey ? { Authorization: `Bearer ${env.ai.apiKey}` } : {},
        timeout: 60_000, // un modèle local (Ollama sur CPU) peut être lent
      }
    );
    // Tokens consommés : enregistrés pour le suivi de la page Administration (sans jamais retarder ni faire échouer la réponse)
    const usage = usageFromResponse(data);
    if (usage) void recordAiUsage((data?.model as string | undefined) ?? env.ai.model, usage);
    return (data?.choices?.[0]?.message?.content as string | undefined) ?? "";
  } catch (e) {
    const msg = axios.isAxiosError(e) ? JSON.stringify(e.response?.data ?? "") : "";
    if (withTemperature && axios.isAxiosError(e) && e.response?.status === 400 && /temperature/i.test(msg)) return post(messages, json, false);
    throw e;
  }
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
