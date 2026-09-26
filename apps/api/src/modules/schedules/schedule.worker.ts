import type { Schedule, ScheduleTarget, SocialAccount } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { graphClient, graphErrorDetails, graphErrorMessage } from "../facebook/graph.client.js";
import { isPublicAddress, localUploadName, publicImageUrl, readUpload } from "../uploads/upload.service.js";

// Au-delà, une publication restée « en cours » vient d'un arrêt du serveur pendant l'envoi
const STUCK_MS = 10 * 60 * 1000;

const isOwn = (acc: SocialAccount, p: { id: string; username?: string }) =>
  p.id === acc.externalId || (p.username !== undefined && `@${p.username}` === acc.name);

// Traduit les refus fréquents de Meta en action à mener
export function explainFailure(e: unknown): string {
  const raw = graphErrorMessage(e).replace(/\s+/g, " ").trim();
  if (/outside of allowed window/i.test(raw)) {
    return "Plus de 24 h depuis le dernier message de cette personne : choisissez une étiquette (Messenger) ou attendez qu'elle vous écrive.";
  }
  if (/impersonat/i.test(raw)) return "Page non autorisée : reconnectez Facebook en cochant cette Page (menu Connexions).";
  if (/pages_manage_posts|instagram_content_publish|\(#(200|10)\)|permission/i.test(raw)) {
    return `Autorisation de publication manquante : reconnectez Facebook depuis Connexions et acceptez toutes les autorisations. (${raw})`;
  }
  // Sans explication de Facebook : on garde tout ce qu'il renvoie (code, trace) pour pouvoir diagnostiquer
  const d = graphErrorDetails(e);
  const ref = [d.code !== null && `code ${d.code}${d.subcode ? `/${d.subcode}` : ""}`, d.trace && `trace ${d.trace}`].filter(Boolean).join(", ");
  const text = d.userMessage ?? raw;
  if (d.code === 1 || d.code === 2) {
    return `Facebook a refusé sans donner de raison (« ${raw} »${ref ? `, ${ref}` : ""}). Déjà réessayé automatiquement : relancez dans quelques minutes. Si l'erreur persiste, vérifiez que votre profil a le rôle « Créer du contenu » sur la Page (Meta Business Suite → Paramètres → Accès à la Page).`;
  }
  return ref ? `${text} (${ref})` : text;
}

// Erreurs passagères de Facebook (« unknown error », indisponibilité) : nouvelle tentative après une pause
const RETRY_DELAYS_MS = [4000, 10000];
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= RETRY_DELAYS_MS.length || !graphErrorDetails(e).transient) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

type Result = { id: string | null; permalink: string | null };

async function publishPost(s: Schedule, acc: SocialAccount): Promise<Result> {
  if (acc.platform === "INSTAGRAM") {
    if (!s.imageUrl) throw new Error("Instagram exige une image pour publier.");
    const imageUrl = publicImageUrl(s.imageUrl);
    if (!isPublicAddress(imageUrl)) {
      throw new Error(
        `Instagram doit télécharger l'image lui-même, mais ${new URL(imageUrl).origin} n'est pas accessible depuis Internet. ` +
          "Mettez l'API en ligne (PUBLIC_API_URL) ou utilisez l'adresse d'une image publique."
      );
    }
    const { id } = await graphClient.publishInstagramImage(acc.externalId, acc.accessToken, imageUrl, s.text);
    return { id, permalink: await graphClient.getInstagramPermalink(id, acc.accessToken).catch(() => null) };
  }

  if (s.imageUrl) {
    // Image téléversée sur ReplyKA : envoyée directement, sans que Facebook ait besoin de la télécharger
    const local = localUploadName(s.imageUrl);
    const res = await graphClient.publishPagePhoto(acc.externalId, acc.accessToken, {
      caption: s.link ? `${s.text}\n\n${s.link}` : s.text,
      ...(local ? { file: await readUpload(local) } : { url: s.imageUrl }),
    });
    const id = res.post_id ?? res.id;
    return { id, permalink: `https://www.facebook.com/${id}` };
  }

  const { id } = await graphClient.publishPagePost(acc.externalId, acc.accessToken, { message: s.text, link: s.link });
  return { id, permalink: `https://www.facebook.com/${id}` };
}

async function publishTarget(s: Schedule, t: ScheduleTarget, acc: SocialAccount): Promise<Result> {
  if (s.kind === "POST") return publishPost(s, acc);

  if (s.kind === "COMMENT") {
    const res =
      acc.platform === "INSTAGRAM"
        ? await graphClient.commentOnInstagramMedia(t.refId!, s.text, acc.accessToken)
        : await graphClient.replyToComment(t.refId!, s.text, acc.accessToken);
    return { id: (res as { id?: string }).id ?? null, permalink: null };
  }

  // Message privé : le destinataire est relu dans la conversation au moment de l'envoi
  const convo = await graphClient.getConversationMessages(t.refId!, acc.accessToken);
  const recipient = convo.participants?.data.find((p) => !isOwn(acc, p));
  if (!recipient) throw new Error("Destinataire introuvable dans cette conversation.");
  const tag = acc.platform === "FACEBOOK" ? (s.messageTag ?? undefined) : undefined;
  const res = await graphClient.sendMessage(recipient.id, s.text, acc.accessToken, tag);
  return { id: res.message_id ?? null, permalink: null };
}

export async function executeSchedule(id: string) {
  // Réservation atomique : une seule instance publie (plusieurs serveurs possibles)
  const claimed = await prisma.schedule.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "PUBLISHING" } });
  if (!claimed.count) return;

  const s = await prisma.schedule.findUniqueOrThrow({ where: { id }, include: { targets: { include: { account: true } } } });
  for (const t of s.targets.filter((x) => x.status !== "DONE")) {
    try {
      if (!t.account.isActive) throw new Error("Compte désactivé dans Connexions.");
      const r = await withRetry(() => publishTarget(s, t, t.account));
      await prisma.scheduleTarget.update({
        where: { id: t.id },
        data: { status: "DONE", externalId: r.id, permalink: r.permalink, error: null, doneAt: new Date() },
      });
    } catch (e) {
      await prisma.scheduleTarget.update({ where: { id: t.id }, data: { status: "FAILED", error: explainFailure(e) } });
    }
  }

  const targets = await prisma.scheduleTarget.findMany({ where: { scheduleId: id }, include: { account: { select: { name: true } } } });
  const failed = targets.filter((t) => t.status === "FAILED");
  const status = failed.length === 0 ? "DONE" : failed.length === targets.length ? "FAILED" : "PARTIAL";
  await prisma.schedule.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "FAILED" ? null : new Date(),
      error: failed.length ? failed.map((t) => `${t.account.name} : ${t.error}`).join("\n") : null,
    },
  });
  await prisma.activityLog.create({
    data: {
      userId: s.userId,
      action: status === "FAILED" ? "SCHEDULE_FAILED" : "SCHEDULE_PUBLISHED",
      meta: { scheduleId: id, kind: s.kind, done: targets.length - failed.length, failed: failed.length },
    },
  });
}

let running = false;
let again = false;

// Publie tout ce qui est arrivé à échéance ; un appel pendant un passage relance un tour à la fin
export async function runDueSchedules() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      const due = await prisma.schedule.findMany({
        where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: 20,
        select: { id: true },
      });
      for (const { id } of due) {
        await executeSchedule(id).catch((e) => console.error(`❌ Planification ${id} :`, e));
      }
      if (due.length === 20) again = true;
    } while (again);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (env.schedulerSeconds <= 0) {
    console.log("🗓️  Planification : robot désactivé (SCHEDULER_SECONDS=0)");
    return () => {};
  }
  // Envois interrompus par un arrêt du serveur : signalés plutôt que relancés (risque de doublon)
  void prisma.schedule
    .updateMany({
      where: { status: "PUBLISHING", updatedAt: { lt: new Date(Date.now() - STUCK_MS) } },
      data: { status: "FAILED", error: "Envoi interrompu par un redémarrage du serveur : vérifiez sur Facebook avant de relancer." },
    })
    .catch(() => {});
  const timer = setInterval(() => void runDueSchedules(), env.schedulerSeconds * 1000);
  void runDueSchedules();
  console.log(`🗓️  Planification : vérification toutes les ${env.schedulerSeconds} s`);
  return () => clearInterval(timer);
}
