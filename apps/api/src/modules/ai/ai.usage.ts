import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { usageDay, usageMonth } from "../billing/billing.logic.js";
import { sendMail } from "../mail/mail.service.js";
import { costOf, nextAlertLevel, percentUsed, type AiUsageSettings, type MonthTotals, type TokenUsage } from "./ai.usage.logic.js";

// Suivi de la consommation du modèle IA : chaque appel ajoute ses tokens (entrée, sortie, cache, raisonnement) et son coût
// estimé au total du jour ; quand la part de la limite mensuelle atteint le seuil, les administrateurs reçoivent un e-mail.

const KEY = "aiUsageSettings";

export function defaultAiUsageSettings(): AiUsageSettings {
  return {
    inputPerM: env.ai.priceInputPerM,
    outputPerM: env.ai.priceOutputPerM,
    cachedPerM: env.ai.priceCachedPerM,
    usdToAr: env.ai.usdToAr,
    monthlyBudgetUsd: env.ai.monthlyBudgetUsd,
    monthlyTokenLimit: env.ai.monthlyTokenLimit,
    alertPercent: env.ai.alertPercent,
  };
}

let cache: { at: number; value: AiUsageSettings } | null = null;

export async function getAiUsageSettings(): Promise<{ settings: AiUsageSettings; custom: boolean }> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } });
  const saved = (row?.value ?? null) as Partial<AiUsageSettings> | null;
  const settings = { ...defaultAiUsageSettings(), ...(saved ?? {}) };
  cache = { at: Date.now(), value: settings };
  return { settings, custom: Boolean(saved) };
}

async function currentSettings(): Promise<AiUsageSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  return (await getAiUsageSettings()).settings;
}

export async function saveAiUsageSettings(s: AiUsageSettings | null) {
  if (s === null) await prisma.platformSetting.deleteMany({ where: { key: KEY } });
  else await prisma.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: s as never }, update: { value: s as never } });
  cache = null;
  return getAiUsageSettings();
}

// Totaux d'un mois (aaaa-mm, heure de Madagascar)
export async function monthTotals(month = usageMonth()): Promise<MonthTotals & { calls: number }> {
  const a = await prisma.aiTokenDaily.aggregate({
    where: { day: { startsWith: month } },
    _sum: { inputTokens: true, outputTokens: true, costUsd: true, calls: true },
  });
  return { inputTokens: a._sum.inputTokens ?? 0, outputTokens: a._sum.outputTokens ?? 0, costUsd: a._sum.costUsd ?? 0, calls: a._sum.calls ?? 0 };
}

// Enregistre un appel au modèle. Ne bloque jamais la réponse au client : toute erreur est seulement journalisée.
export async function recordAiUsage(model: string, usage: TokenUsage): Promise<void> {
  try {
    const settings = await currentSettings();
    const cost = costOf(usage, settings);
    await prisma.aiTokenDaily.upsert({
      where: { day_model: { day: usageDay(), model } },
      create: { day: usageDay(), model, calls: 1, ...usage, costUsd: cost },
      update: {
        calls: { increment: 1 },
        inputTokens: { increment: usage.inputTokens },
        outputTokens: { increment: usage.outputTokens },
        cachedTokens: { increment: usage.cachedTokens },
        reasoningTokens: { increment: usage.reasoningTokens },
        costUsd: { increment: cost },
      },
    });
    await checkAiBudget(settings);
  } catch (e) {
    console.error("❌ Suivi des tokens IA :", e instanceof Error ? e.message : e);
  }
}

const usd = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: n < 10 ? 2 : 0 })} $`;
const tok = (n: number) => n.toLocaleString("fr-FR");

// Prévient les administrateurs quand la limite mensuelle approche (seuil réglé, puis 100 %), une fois par seuil et par mois
export async function checkAiBudget(settings?: AiUsageSettings): Promise<{ percent: number | null; sent: number | null }> {
  const s = settings ?? (await currentSettings());
  const month = usageMonth();
  const totals = await monthTotals(month);
  const percent = percentUsed(totals, s);
  const key = `aiBudgetAlert:${month}`;
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  const last = ((row?.value ?? null) as { level?: number } | null)?.level ?? 0;
  const level = nextAlertLevel(percent, s.alertPercent, last);
  if (level === null) return { percent, sent: null };

  // Marqué avant l'envoi : deux appels simultanés n'envoient pas deux fois le même e-mail
  await prisma.platformSetting.upsert({ where: { key }, create: { key, value: { level, at: new Date().toISOString() } }, update: { value: { level, at: new Date().toISOString() } } });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null }, select: { id: true, email: true, name: true } });
  await Promise.all(
    admins.map((a) =>
      sendAiBudgetAlert(a.email, a.name, { level, percent: percent ?? level, month, totals, settings: s, model: env.ai.model }).catch((e) => console.error(`❌ Alerte IA vers ${a.email} :`, e instanceof Error ? e.message : e)),
    ),
  );
  if (admins[0]) await prisma.activityLog.create({ data: { userId: admins[0].id, action: "AI_BUDGET_ALERT", meta: { level, percent, month } } }).catch(() => undefined);
  return { percent, sent: level };
}

export interface AlertInfo { level: number; percent: number; month: string; totals: MonthTotals; settings: AiUsageSettings; model: string }

export function aiBudgetAlertMail(name: string, i: AlertInfo) {
  const over = i.level >= 100;
  const subject = over ? `Limite IA atteinte : ${Math.round(i.percent)} % du budget du mois` : `Consommation IA : ${Math.round(i.percent)} % de la limite du mois`;
  const lines = [
    `Modèle : ${i.model}`,
    `Mois : ${i.month}`,
    `Tokens d'entrée : ${tok(i.totals.inputTokens)}`,
    `Tokens de sortie : ${tok(i.totals.outputTokens)}`,
    `Coût estimé : ${usd(i.totals.costUsd)}${i.settings.monthlyBudgetUsd ? ` sur ${usd(i.settings.monthlyBudgetUsd)}` : ""}`,
    ...(i.settings.monthlyTokenLimit ? [`Limite de tokens : ${tok(i.settings.monthlyTokenLimit)}`] : []),
  ];
  const intro = over
    ? "La limite mensuelle de consommation du modèle IA est atteinte. Les réponses IA continuent tant que le fournisseur les accepte : relevez la limite ou vérifiez le plafond côté fournisseur."
    : `La consommation du modèle IA a atteint ${Math.round(i.percent)} % de la limite mensuelle.`;
  const text = `Bonjour ${name},\n\n${intro}\n\n${lines.join("\n")}\n\nDétail : Administration › IA & système.\n\nSuiteFlow`;
  const rows = lines.map((l) => `<li style="margin:2px 0">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</li>`).join("");
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111B21">
  <p style="font-size:15px;margin:0 0 6px">Bonjour ${name.replace(/</g, "&lt;")},</p>
  <p style="font-size:15px;margin:0 0 14px;padding:12px 14px;border-radius:10px;background:${over ? "#FDECEC" : "#FEF3C7"}">${intro}</p>
  <ul style="font-size:14px;padding-left:18px;margin:0 0 16px">${rows}</ul>
  <p style="font-size:13px;color:#54656F;margin:0">Détail : Administration › IA &amp; système.</p></div>`;
  return { subject, text, html };
}

function sendAiBudgetAlert(to: string, name: string, info: AlertInfo) {
  const m = aiBudgetAlertMail(name, info);
  return sendMail(to, m.subject, m.text, m.html);
}

// Données de la page admin : totaux du mois, série par jour, répartition par modèle, état de la limite
export async function aiUsageReport(days: number) {
  const since = usageDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const [rows, month, { settings, custom }] = await Promise.all([
    prisma.aiTokenDaily.findMany({ where: { day: { gte: since } }, orderBy: { day: "asc" } }),
    monthTotals(),
    getAiUsageSettings(),
  ]);
  const byDay = new Map<string, { inputTokens: number; outputTokens: number; costUsd: number; calls: number }>();
  const byModel = new Map<string, { calls: number; inputTokens: number; outputTokens: number; cachedTokens: number; reasoningTokens: number; costUsd: number }>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };
    d.inputTokens += r.inputTokens; d.outputTokens += r.outputTokens; d.costUsd += r.costUsd; d.calls += r.calls;
    byDay.set(r.day, d);
    const m = byModel.get(r.model) ?? { calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0, costUsd: 0 };
    m.calls += r.calls; m.inputTokens += r.inputTokens; m.outputTokens += r.outputTokens; m.cachedTokens += r.cachedTokens; m.reasoningTokens += r.reasoningTokens; m.costUsd += r.costUsd;
    byModel.set(r.model, m);
  }
  // Une entrée par jour, y compris les jours sans appel
  const daily = Array.from({ length: days }, (_, i) => {
    const day = usageDay(new Date(Date.now() - (days - 1 - i) * 86_400_000));
    return { day, ...(byDay.get(day) ?? { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 }) };
  });
  const alertRow = await prisma.platformSetting.findUnique({ where: { key: `aiBudgetAlert:${usageMonth()}` } });
  const percent = percentUsed(month, settings);
  return {
    days,
    provider: env.ai.baseUrl,
    model: env.ai.model,
    month: { key: usageMonth(), ...month, percent, alertLevelSent: ((alertRow?.value ?? null) as { level?: number } | null)?.level ?? 0 },
    totals: daily.reduce((t, d) => ({ calls: t.calls + d.calls, inputTokens: t.inputTokens + d.inputTokens, outputTokens: t.outputTokens + d.outputTokens, costUsd: t.costUsd + d.costUsd }), { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }),
    daily,
    byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.costUsd - a.costUsd),
    settings,
    customSettings: custom,
    pricesSet: settings.inputPerM > 0 || settings.outputPerM > 0,
  };
}
