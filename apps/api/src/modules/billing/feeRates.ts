import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { PAPI_FEE_RATES } from "./billing.logic.js";

// Commissions Papi par opérateur (en %), réglables par l'administrateur. Elles servent à estimer la
// commission quand Papi ne la transmet pas ; une commission transmise par Papi n'est jamais recalculée.

export const FEE_METHODS = ["MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY", "BRED"] as const;
export type FeeMethod = (typeof FEE_METHODS)[number];
export type FeeRates = Record<FeeMethod, number>;

const KEY = "papiFeeRates";
const CACHE_MS = 60_000;
let cache: { at: number; rates: FeeRates } | null = null;

// Valeurs par défaut : tarifs publics Papi selon le mode du compte (.env), ou un taux unique
export function defaultFeeRates(mode = env.papi.feeMode): FeeRates {
  const base = PAPI_FEE_RATES[mode];
  const one = env.papi.feePercent;
  return {
    MVOLA: one ?? base.MVOLA,
    ORANGE_MONEY: one ?? base.ORANGE_MONEY,
    AIRTEL_MONEY: one ?? base.AIRTEL_MONEY,
    BRED: one ?? base.BRED,
  };
}

export async function getFeeRates(): Promise<{ rates: FeeRates; custom: boolean; updatedAt: Date | null }> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } });
  const saved = (row?.value ?? null) as Partial<FeeRates> | null;
  const rates = { ...defaultFeeRates(), ...(saved ?? {}) };
  cache = { at: Date.now(), rates };
  return { rates, custom: Boolean(saved), updatedAt: row?.updatedAt ?? null };
}

export async function feeRates(): Promise<FeeRates> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rates;
  return (await getFeeRates()).rates;
}

export async function setFeeRates(rates: FeeRates | null) {
  if (rates === null) await prisma.platformSetting.deleteMany({ where: { key: KEY } });
  else await prisma.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: rates }, update: { value: rates } });
  cache = null;
  return getFeeRates();
}

// Moyen de paiement inconnu : le taux le plus élevé (estimation prudente du bénéfice)
export function rateFor(rates: FeeRates, method: string | null | undefined): number {
  return (method && method in rates ? rates[method as FeeMethod] : Math.max(...Object.values(rates)));
}

export const feeWith = (rates: FeeRates, amount: number, method: string | null | undefined) => Math.round((amount * rateFor(rates, method)) / 100);
