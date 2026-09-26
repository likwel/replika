import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { aiErrorMessage, aiProviderName, isAiConfigured } from "./ai.client.js";
import { generateReply } from "./ai.service.js";
import type { AiAccountInput, AiTestInput } from "./ai.schema.js";

const AI_FIELDS = {
  id: true,
  name: true,
  platform: true,
  avatarUrl: true,
  isActive: true,
  aiEnabled: true,
  aiAutoSend: true,
  aiChannel: true,
  aiContext: true,
  aiInstructions: true,
} as const;

async function findOwned(userId: string, id: string) {
  const acc = await prisma.socialAccount.findFirst({ where: { id, userId } });
  if (!acc) throw new AppError("Compte introuvable", 404);
  return acc;
}

export const aiSettingsService = {
  async overview(userId: string) {
    const [accounts, lastFailure] = await Promise.all([
      prisma.socialAccount.findMany({
        where: { userId, platform: { in: ["FACEBOOK", "INSTAGRAM"] } },
        select: AI_FIELDS,
        orderBy: { createdAt: "asc" },
      }),
      prisma.activityLog.findFirst({
        where: {
          userId,
          action: "AI_REPLY_FAILED",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const lastError = (lastFailure?.meta as { error?: string } | null)?.error;
    return {
      configured: isAiConfigured(),
      provider: aiProviderName(),
      model: env.ai.model,
      lastError: lastError ? { message: lastError, at: lastFailure!.createdAt } : null,
      accounts,
    };
  },

  async updateAccount(userId: string, id: string, data: AiAccountInput) {
    await findOwned(userId, id);
    return prisma.socialAccount.update({ where: { id }, data, select: AI_FIELDS });
  },

  // Génère une réponse sans rien publier, avec le brouillon de configuration s'il est fourni
  async test(userId: string, input: AiTestInput) {
    if (!isAiConfigured()) {
      throw new AppError("Aucun modèle IA configuré : renseignez AI_API_KEY dans apps/api/.env", 503);
    }
    const acc = await findOwned(userId, input.accountId);
    try {
      return await generateReply(
        {
          name: acc.name,
          platform: acc.platform,
          aiContext: input.aiContext !== undefined ? input.aiContext : acc.aiContext,
          aiInstructions: input.aiInstructions !== undefined ? input.aiInstructions : acc.aiInstructions,
        },
        { kind: input.kind, authorName: "Rakoto", content: input.text }
      );
    } catch (e) {
      throw new AppError(`IA indisponible : ${aiErrorMessage(e)}`, 502);
    }
  },
};
