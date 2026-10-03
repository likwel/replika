import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import {
  candidateRules,
  parseKeywords,
  renderReply,
  ruleMatchesText,
} from "../autoreply/autoreply.matcher.js";
import { pollAccounts } from "../autoreply/autoreply.poller.js";
import { aiProviderName, isAiConfigured } from "../ai/ai.client.js";
import type { RuleInput, RuleUpdateInput, TestInput } from "./automation.schema.js";

// Une règle à mots-clés sans mot-clé ne déclencherait jamais
function assertKeywords(matchType: string | undefined, trigger: string | undefined) {
  if ((matchType ?? "CONTAINS") !== "ANY" && parseKeywords(trigger ?? "").length === 0) {
    throw new AppError("Ajoutez au moins un mot-clé, ou choisissez « Tout message »", 422);
  }
}

// Sans réponse IA, il faut un texte de réponse fixe
function assertResponse(useAi: boolean | undefined, response: string | undefined | null) {
  if (!useAi && !(response ?? "").trim()) {
    throw new AppError("Écrivez la réponse à envoyer, ou activez la réponse par IA", 422);
  }
}

async function assertAccountOwned(userId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const acc = await prisma.socialAccount.findFirst({ where: { id: accountId, userId } });
  if (!acc) throw new AppError("Compte introuvable", 404);
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const automationService = {
  list: (userId: string) =>
    prisma.automationRule.findMany({
      where: { userId },
      include: { account: { select: { name: true, platform: true, isActive: true, syncError: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),

  async create(userId: string, data: RuleInput) {
    assertKeywords(data.matchType, data.trigger);
    assertResponse(data.useAi, data.response);
    await assertAccountOwned(userId, data.accountId);
    return prisma.automationRule.create({ data: { ...data, trigger: data.trigger ?? "", userId } });
  },

  async update(userId: string, id: string, data: RuleUpdateInput) {
    const rule = await prisma.automationRule.findFirst({ where: { id, userId } });
    if (!rule) throw new AppError("Règle introuvable", 404);
    assertKeywords(data.matchType ?? rule.matchType, data.trigger ?? rule.trigger);
    assertResponse(data.useAi ?? rule.useAi, data.response ?? rule.response);
    await assertAccountOwned(userId, data.accountId);
    return prisma.automationRule.update({ where: { id }, data });
  },

  async remove(userId: string, id: string) {
    const rule = await prisma.automationRule.findFirst({ where: { id, userId } });
    if (!rule) throw new AppError("Règle introuvable", 404);
    await prisma.automationRule.delete({ where: { id } });
  },

  async getSettings(userId: string) {
    const [user, repliedToday, autoRepliedToday, pending, suggested, escalated, failed, syncIssues] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { autoReplyEnabled: true } }),
      prisma.socialMessage.count({
        where: { account: { userId }, status: "REPLIED", repliedAt: { gte: startOfToday() } },
      }),
      prisma.activityLog.count({
        where: { userId, action: "AUTO_REPLY_SENT", createdAt: { gte: startOfToday() } },
      }),
      prisma.socialMessage.count({ where: { account: { userId }, status: "PENDING" } }),
      prisma.socialMessage.count({
        where: { account: { userId }, status: "PENDING", aiReply: { not: null } },
      }),
      prisma.socialMessage.count({ where: { account: { userId }, status: "ESCALATED" } }),
      prisma.socialMessage.count({
        where: { account: { userId }, status: "PENDING", error: { not: null } },
      }),
      // Comptes dont la relève échoue (permission manquante, jeton expiré…)
      prisma.socialAccount.findMany({
        where: { userId, isActive: true, syncError: { not: null } },
        select: { id: true, name: true, platform: true, syncError: true },
      }),
    ]);
    return {
      autoReplyEnabled: user?.autoReplyEnabled ?? false,
      pollSeconds: env.autoReply.pollSeconds,
      webhookConfigured: Boolean(env.fb.webhookVerifyToken),
      ai: { configured: isAiConfigured(), provider: aiProviderName(), model: env.ai.model },
      stats: { repliedToday, autoRepliedToday, pending, suggested, escalated, failed },
      syncIssues,
    };
  },

  async updateSettings(userId: string, autoReplyEnabled: boolean) {
    await prisma.user.update({ where: { id: userId }, data: { autoReplyEnabled } });
    await prisma.activityLog.create({
      data: { userId, action: autoReplyEnabled ? "AUTO_REPLY_ENABLED" : "AUTO_REPLY_DISABLED" },
    });
    return this.getSettings(userId);
  },

  // Relève immédiatement les nouveaux commentaires / messages des comptes de l'utilisateur
  sync: (userId: string) => pollAccounts(userId),

  // Simule l'arrivée d'un message : quelle règle répondrait, et avec quel texte (rien n'est envoyé)
  async test(userId: string, input: TestInput) {
    const rules = await prisma.automationRule.findMany({ where: { userId, isActive: true } });
    const account = input.accountId
      ? await prisma.socialAccount.findFirst({ where: { id: input.accountId, userId } })
      : null;

    // Sans compte choisi, seules les règles « tous les comptes » sont candidates
    const rule = candidateRules(rules, {
      kind: input.kind,
      accountId: account?.id ?? "",
      postId: input.postId ?? null,
    }).find((r) => ruleMatchesText(r, input.text));

    if (!rule) return { matched: false as const };
    const vars = { nom: "Rakoto", page: account?.name ?? "Votre page" };
    return {
      matched: true as const,
      rule: { id: rule.id, name: rule.name, autoSend: rule.autoSend, useAi: rule.useAi },
      reply: rule.useAi
        ? "(réponse générée par l'IA au moment de l'envoi, selon le contexte du compte)"
        : renderReply(rule.response ?? "", vars),
      privateReply:
        rule.privateReply && input.kind === "COMMENT" ? renderReply(rule.privateReply, vars) : null,
    };
  },
};
