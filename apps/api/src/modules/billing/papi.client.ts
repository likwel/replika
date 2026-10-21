import axios, { AxiosError } from "axios";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

// Client de l'API Papi.mg (liens de paiement) — https://docs.papi.mg/fr/docs/overview

export type LinkStatus = "ACTIVE" | "EXPIRED" | "PAID" | "DISABLED";
export type PapiPaymentStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface CreateLinkInput {
  amount: number;
  reference: string;
  clientName: string;
  description: string;
  successUrl: string;
  failureUrl: string;
  notificationUrl?: string; // facultatif : sans adresse publique, le paiement est confirmé par interrogation
  payerEmail?: string;
  payerPhone?: string; // numéro saisi par le client (Papi le préremplit)
}

export interface PaymentLink {
  paymentLink: string;
  shortLink?: string;
  notificationToken: string;
  paymentReference: string;
  linkExpirationDateTime?: number; // epoch ms
}

export interface LinkStatusResult {
  linkStatus: LinkStatus;
  paymentStatus: PapiPaymentStatus | null;
  paymentMethod: string | null;
  currency?: string;
  amount?: number;
  merchantPaymentReference?: string;
  papiPaymentReference: string | null;
  message: string | null;
  payerPhone?: string | null;
  linkExpirationDateTime?: number;
}

// Corps de la notification envoyée par Papi après un paiement
export interface PapiNotification {
  paymentStatus?: PapiPaymentStatus;
  paymentMethod?: string;
  currency?: string;
  amount?: number | string;
  fee?: number | string;
  merchantPaymentReference?: string;
  paymentReference?: string;
  notificationToken?: string;
  message?: string;
  payerEmail?: string;
  payerPhone?: string;
}

export function isPapiConfigured(): boolean {
  return Boolean(env.papi.apiKey && env.papi.secretKey);
}

const http = axios.create({ baseURL: env.papi.baseUrl, timeout: 15_000 });

function headers() {
  return { Token: env.papi.apiKey, "Content-Type": "application/json" };
}

// Erreur Papi { error: { code, message } } → message lisible, sans jamais reprendre la clé API
function papiError(e: unknown): AppError {
  const ax = e as AxiosError<{ error?: { code?: string; message?: string } }>;
  const msg = ax.response?.data?.error?.message;
  if (msg) return new AppError(`Papi : ${msg}`, 502, "PAPI_ERROR");
  if (ax.code === "ECONNABORTED") return new AppError("Papi ne répond pas, réessayez dans un instant.", 502, "PAPI_ERROR");
  return new AppError("Service de paiement Papi indisponible, réessayez dans un instant.", 502, "PAPI_ERROR");
}

export async function createPaymentLink(input: CreateLinkInput): Promise<PaymentLink> {
  try {
    const { data } = await http.post(
      "/payment-links",
      {
        amount: input.amount,
        reference: input.reference,
        clientName: input.clientName.slice(0, 120),
        description: input.description.slice(0, 255),
        successUrl: input.successUrl,
        failureUrl: input.failureUrl,
        ...(input.notificationUrl ? { notificationUrl: input.notificationUrl } : {}),
        validDuration: Math.min(596, Math.max(1, env.papi.linkHours)),
        ...(input.payerEmail ? { payerEmail: input.payerEmail } : {}),
        ...(input.payerPhone ? { payerPhone: input.payerPhone } : {}),
        isTestMode: env.papi.testMode,
        ...(env.papi.testMode ? { testReason: "Tests SuiteFlow" } : {}),
      },
      { headers: headers() },
    );
    return data.data as PaymentLink;
  } catch (e) {
    throw papiError(e);
  }
}

// null : référence inconnue de Papi
export async function getPaymentLinkStatus(reference: string): Promise<LinkStatusResult | null> {
  try {
    const { data } = await http.get(`/payment-links/${encodeURIComponent(reference)}`, { headers: { Token: env.papi.apiKey } });
    return data.data as LinkStatusResult;
  } catch (e) {
    if ((e as AxiosError).response?.status === 404) return null;
    throw papiError(e);
  }
}

const SIGNATURE_TOLERANCE_S = 300;

// En-tête X-Papi-Signature : "t=<unix>,v1=<hex>" ; v1 = HMAC-SHA256(secret complet, `${t}.${corps brut}`)
export function verifySignature(rawBody: Buffer, header: string | undefined, secret: string, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = new Map<string, string>();
  for (const chunk of header.split(",")) {
    const i = chunk.indexOf("=");
    if (i > 0) parts.set(chunk.slice(0, i).trim(), chunk.slice(i + 1).trim());
  }
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !/^\d+$/.test(t) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > SIGNATURE_TOLERANCE_S) return false;

  const expected = createHmac("sha256", Buffer.from(secret, "utf8")).update(`${t}.`).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(v1, "hex"));
}

// Comparaison à temps constant de deux chaînes (jeton de notification)
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
