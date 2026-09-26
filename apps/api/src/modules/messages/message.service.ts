import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { graphErrorMessage } from "../facebook/graph.client.js";
import { sendPrivateFollowUp, sendReply } from "../autoreply/autoreply.engine.js";
import { aiErrorMessage, isAiConfigured } from "../ai/ai.client.js";
import { generateReplyForMessage, type AiReply } from "../ai/ai.service.js";
import type { ListQuery } from "./message.schema.js";

async function findOwned(userId: string, id: string) {
  const msg = await prisma.socialMessage.findFirst({
    where: { id, account: { userId } },
    include: { account: true, rule: true },
  });
  if (!msg) throw new AppError("Message introuvable", 404);
  return msg;
}

export const messageService = {
  // récupère les messages des comptes appartenant à l'utilisateur
  list(userId: string, filters: ListQuery) {
    return prisma.socialMessage.findMany({
      where: {
        account: { userId },
        ...(filters.accounts?.length ? { accountId: { in: filters.accounts } } : {}),
        ...(filters.status ? { status: { in: filters.status } } : {}),
        ...(filters.kind === "COMMENT"
          ? { kind: { in: ["COMMENT", "LIVE_COMMENT"] } }
          : filters.kind
            ? { kind: filters.kind }
            : {}),
      },
      include: {
        account: { select: { name: true, platform: true, avatarUrl: true } },
        rule: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async reply(userId: string, id: string, reply: string) {
    const msg = await findOwned(userId, id);
    if (msg.status === "REPLIED") throw new AppError("Ce message a déjà reçu une réponse", 409);

    try {
      await sendReply(msg.account, msg, reply);
    } catch (e) {
      const error = graphErrorMessage(e);
      await prisma.socialMessage.update({ where: { id }, data: { error: `Envoi échoué : ${error}` } });
      throw new AppError(`Envoi impossible : ${error}`, 502);
    }

    // Validation d'une suggestion : on envoie aussi le message privé prévu par la règle
    const followUpError = await sendPrivateFollowUp(msg.account, msg, msg.rule);
    const updated = await prisma.socialMessage.update({
      where: { id },
      data: {
        aiReply: reply,
        // Une suggestion IA retouchée devient une réponse manuelle
        aiGenerated: msg.aiGenerated && reply.trim() === msg.aiReply?.trim(),
        status: "REPLIED",
        repliedAt: new Date(),
        error: followUpError,
      },
    });
    await prisma.activityLog.create({
      data: { userId, action: "REPLY_SENT", meta: { messageId: id } },
    });
    return updated;
  },

  // Propose une réponse rédigée par l'IA, sans l'envoyer
  async aiSuggest(userId: string, id: string) {
    if (!isAiConfigured()) {
      throw new AppError("Aucun modèle IA configuré : renseignez AI_API_KEY dans apps/api/.env", 503);
    }
    const msg = await findOwned(userId, id);

    let ai: AiReply;
    try {
      ai = await generateReplyForMessage(msg.account, msg);
    } catch (e) {
      throw new AppError(`IA indisponible : ${aiErrorMessage(e)}`, 502);
    }

    const updated = await prisma.socialMessage.update({
      where: { id },
      data: {
        intent: ai.intent,
        ...(ai.reply ? { aiReply: ai.reply, aiGenerated: true } : {}),
      },
    });
    return { ...updated, suggestion: ai };
  },

  async escalate(userId: string, id: string) {
    await findOwned(userId, id);
    return prisma.socialMessage.update({ where: { id }, data: { status: "ESCALATED" } });
  },

  async ignore(userId: string, id: string) {
    await findOwned(userId, id);
    return prisma.socialMessage.update({ where: { id }, data: { status: "IGNORED" } });
  },
};
