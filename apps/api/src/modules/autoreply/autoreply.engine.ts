import { Prisma, type SocialAccount, type SocialMessage, type AutomationRule } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { graphClient, graphErrorMessage } from "../facebook/graph.client.js";
import { aiErrorMessage, isAiConfigured } from "../ai/ai.client.js";
import { generateReplyForMessage, type AiReply } from "../ai/ai.service.js";
import { findActiveSessionForPost, handleLiveDirectMessage, ingestLiveComment } from "../lives/live.service.js";
import { detectLeadFromMessage } from "../leads/lead.service.js";
import {
  candidateRules,
  firstName,
  renderReply,
  ruleMatchesText,
  type IncomingKind,
} from "./autoreply.matcher.js";

// Événement normalisé, qu'il vienne d'un webhook ou du polling
export interface IncomingEvent {
  kind: IncomingKind;
  externalId: string;
  authorId?: string;
  authorName: string;
  content: string;
  postId?: string;
  createdAt?: Date;
}

// Un message d'accueil (« tout message ») n'est renvoyé à une même personne qu'une fois par 24 h
const GREETING_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Publie une réponse sur la plateforme d'origine. Lève une erreur si l'API Graph refuse.
export async function sendReply(account: SocialAccount, msg: SocialMessage, text: string) {
  if (msg.kind === "DIRECT") {
    if (!msg.authorId) throw new Error("Destinataire inconnu");
    await graphClient.sendMessage(msg.authorId, text, account.accessToken);
  } else if (account.platform === "INSTAGRAM") {
    await graphClient.replyToInstagramComment(msg.externalId, text, account.accessToken);
  } else {
    await graphClient.replyToComment(msg.externalId, text, account.accessToken);
  }
}

// Message privé complémentaire à l'auteur d'un commentaire — n'empêche pas la réponse publique
export async function sendPrivateFollowUp(
  account: SocialAccount,
  msg: SocialMessage,
  rule: Pick<AutomationRule, "privateReply"> | null
): Promise<string | null> {
  if (msg.kind === "DIRECT" || !rule?.privateReply) return null;
  const text = renderReply(rule.privateReply, { nom: firstName(msg.authorName), page: account.name });
  try {
    await graphClient.sendPrivateReply(msg.externalId, text, account.accessToken);
    return null;
  } catch (e) {
    return `Message privé non envoyé : ${graphErrorMessage(e)}`;
  }
}


// Réponse par défaut en message privé : une seule fois par 24 h et par personne
async function greetingOnCooldown(account: SocialAccount, msg: SocialMessage, ruleId: string) {
  if (!msg.authorId) return false;
  const recent = await prisma.socialMessage.findFirst({
    where: {
      accountId: account.id,
      authorId: msg.authorId,
      ruleId,
      createdAt: { gte: new Date(Date.now() - GREETING_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  return Boolean(recent);
}

interface Delivery {
  reply: string;
  autoSend: boolean;
  rule?: AutomationRule | null;
  aiGenerated?: boolean;
  intent?: string | null;
}

// Enregistre la réponse, et la publie si l'envoi automatique est actif
async function deliver(account: SocialAccount, msg: SocialMessage, d: Delivery) {
  const base = {
    aiReply: d.reply,
    ruleId: d.rule?.id ?? null,
    aiGenerated: d.aiGenerated ?? false,
    intent: d.intent ?? msg.intent,
    error: null as string | null,
  };
  // Validation manuelle : la réponse attend dans la file
  if (!d.autoSend) return prisma.socialMessage.update({ where: { id: msg.id }, data: base });

  try {
    await sendReply(account, msg, d.reply);
  } catch (e) {
    const error = `Envoi échoué : ${graphErrorMessage(e)}`;
    await prisma.activityLog.create({
      data: { userId: account.userId, action: "AUTO_REPLY_FAILED", meta: { messageId: msg.id, error } },
    });
    return prisma.socialMessage.update({ where: { id: msg.id }, data: { ...base, error } });
  }

  const followUpError = await sendPrivateFollowUp(account, msg, d.rule ?? null);
  await prisma.activityLog.create({
    data: {
      userId: account.userId,
      action: "AUTO_REPLY_SENT",
      meta: {
        messageId: msg.id,
        ruleId: d.rule?.id ?? null,
        source: d.aiGenerated ? "ai" : "rule",
        kind: msg.kind,
        platform: account.platform,
      },
    },
  });
  return prisma.socialMessage.update({
    where: { id: msg.id },
    data: { ...base, status: "REPLIED", repliedAt: new Date(), error: followUpError },
  });
}

async function applyRule(account: SocialAccount, msg: SocialMessage, rule: AutomationRule) {
  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { hitCount: { increment: 1 }, lastTriggeredAt: new Date() },
  });
  if (rule.useAi) return applyRuleAi(account, msg, rule);
  const reply = renderReply(rule.response ?? "", { nom: firstName(msg.authorName), page: account.name });
  return deliver(account, msg, { reply, autoSend: rule.autoSend, rule });
}

// Règle dont la réponse est générée par l'IA (contexte du compte), au lieu d'un texte fixe
async function applyRuleAi(account: SocialAccount, msg: SocialMessage, rule: AutomationRule) {
  if (!isAiConfigured()) {
    return prisma.socialMessage.update({
      where: { id: msg.id },
      data: { ruleId: rule.id, error: "IA non configurée" },
    });
  }

  let ai: AiReply;
  try {
    ai = await generateReplyForMessage(account, msg);
  } catch (e) {
    const error = `IA indisponible : ${aiErrorMessage(e)}`;
    await prisma.activityLog.create({
      data: { userId: account.userId, action: "AI_REPLY_FAILED", meta: { messageId: msg.id, ruleId: rule.id, error } },
    });
    return prisma.socialMessage.update({ where: { id: msg.id }, data: { ruleId: rule.id, error } });
  }

  // Spam ou message sans objet : on classe, sans répondre
  if (!ai.reply) {
    return prisma.socialMessage.update({
      where: { id: msg.id },
      data: { ruleId: rule.id, intent: ai.intent },
    });
  }

  // Réclamation, information manquante… : un humain valide avant tout envoi
  if (ai.needsHuman) {
    return prisma.socialMessage.update({
      where: { id: msg.id },
      data: { ruleId: rule.id, aiReply: ai.reply, aiGenerated: true, intent: ai.intent, status: "ESCALATED" },
    });
  }

  return deliver(account, msg, { reply: ai.reply, autoSend: rule.autoSend, aiGenerated: true, intent: ai.intent, rule });
}

const aiAppliesTo = (account: SocialAccount, kind: IncomingKind) =>
  account.aiEnabled && isAiConfigured() && (account.aiChannel === "ALL" || account.aiChannel === kind);

// Réponse rédigée par l'IA. handled = null si le modèle est indisponible.
async function applyAi(account: SocialAccount, msg: SocialMessage) {
  let ai: AiReply;
  try {
    ai = await generateReplyForMessage(account, msg);
  } catch (e) {
    const error = `IA indisponible : ${aiErrorMessage(e)}`;
    await prisma.activityLog.create({
      data: { userId: account.userId, action: "AI_REPLY_FAILED", meta: { messageId: msg.id, error } },
    });
    return { handled: null, error };
  }

  // Spam ou message sans objet : on classe, sans répondre
  if (!ai.reply) {
    return { handled: await prisma.socialMessage.update({ where: { id: msg.id }, data: { intent: ai.intent } }) };
  }

  // Réclamation, information manquante… : un humain valide avant tout envoi
  if (ai.needsHuman) {
    return {
      handled: await prisma.socialMessage.update({
        where: { id: msg.id },
        data: { aiReply: ai.reply, aiGenerated: true, intent: ai.intent, status: "ESCALATED" },
      }),
    };
  }

  return {
    handled: await deliver(account, msg, {
      reply: ai.reply,
      autoSend: account.aiAutoSend,
      aiGenerated: true,
      intent: ai.intent,
    }),
  };
}

// Point d'entrée unique : enregistre le message, y répond, puis cherche un signal d'achat (lead).
// Renvoie null si l'événement est ignoré ou déjà traité.
export async function handleIncoming(account: SocialAccount, ev: IncomingEvent) {
  const msg = await processIncoming(account, ev);
  // Après la réponse : l'intention détectée par l'IA renforce la note du lead
  if (msg) await detectLeadFromMessage(account, msg).catch((e) => console.error(`❌ Lead ${msg.externalId} :`, e));
  return msg;
}

// Réponse, dans cet ordre : règles à mots-clés → assistant IA du compte → réponse par défaut (« tout message »)
async function processIncoming(account: SocialAccount, ev: IncomingEvent) {
  if (!ev.content.trim()) return null;

  // Publication suivie par une session live : les JP deviennent des commandes ;
  // les autres commentaires (prix, questions…) reçoivent les réponses automatiques habituelles
  if (ev.kind !== "DIRECT" && ev.postId) {
    const session = await findActiveSessionForPost(account.id, ev.postId);
    if (session) {
      const createdAt = ev.createdAt ?? new Date();
      const live = await ingestLiveComment(session, {
        id: ev.externalId,
        text: ev.content,
        authorId: ev.authorId,
        authorName: ev.authorName,
        createdAt,
      });
      if (live.status !== "other") return null; // JP, doublon ou commentaire de la Page
      // Commentaire antérieur à la session (reprise de l'existant) : pas de réponse tardive
      if (createdAt < session.createdAt) return null;
    }
  }

  if (ev.authorId && ev.authorId === account.externalId) return null; // nos propres réponses

  let msg: SocialMessage;
  try {
    msg = await prisma.socialMessage.create({
      data: {
        accountId: account.id,
        externalId: ev.externalId,
        kind: ev.kind,
        authorId: ev.authorId ?? null,
        authorName: ev.authorName,
        content: ev.content,
        postId: ev.postId ?? null,
        ...(ev.createdAt ? { createdAt: ev.createdAt } : {}),
      },
    });
  } catch (e) {
    // Déjà reçu (webhook + polling, ou renvoi de Meta)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }

  // Réponse d'un client à une commande JP (coordonnées) : traitée par la session live
  if (ev.kind === "DIRECT") {
    const live = await handleLiveDirectMessage(account, msg).catch((e) => {
      console.error(`❌ Live, message ${msg.externalId} :`, e);
      return null;
    });
    if (live) {
      return prisma.socialMessage.update({
        where: { id: msg.id },
        data: live.reply
          ? { intent: "commande", aiReply: live.reply, status: "REPLIED", repliedAt: new Date() }
          : { intent: "commande", error: live.error ?? null },
      });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: { autoReplyEnabled: true },
  });
  if (!user?.autoReplyEnabled) return msg;

  const rules = await prisma.automationRule.findMany({
    where: { userId: account.userId, isActive: true },
  });
  const candidates = candidateRules(rules, { kind: ev.kind, accountId: account.id, postId: ev.postId ?? null });

  const keywordRule = candidates.find((r) => r.matchType !== "ANY" && ruleMatchesText(r, msg.content));
  if (keywordRule) return applyRule(account, msg, keywordRule);

  let aiError: string | undefined;
  if (aiAppliesTo(account, ev.kind)) {
    const ai = await applyAi(account, msg);
    if (ai.handled) return ai.handled;
    aiError = ai.error;
  }

  for (const rule of candidates.filter((r) => r.matchType === "ANY")) {
    if (ev.kind === "DIRECT" && (await greetingOnCooldown(account, msg, rule.id))) continue;
    return applyRule(account, msg, rule);
  }

  // Personne n'a répondu : reste en file d'attente, avec la raison si l'IA a échoué
  return aiError
    ? prisma.socialMessage.update({ where: { id: msg.id }, data: { error: aiError } })
    : msg;
}
