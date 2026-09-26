import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { deleteUpload, isPublicAddress, localUploadName, publicImageUrl, readUpload } from "../uploads/upload.service.js";
import { runDueSchedules } from "./schedule.worker.js";
import { TEXT_LIMITS, type ListQuery, type ScheduleInput } from "./schedule.schema.js";

const include = {
  targets: {
    include: { account: { select: { id: true, name: true, platform: true, avatarUrl: true } } },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.ScheduleInclude;

const PAST_TOLERANCE_MS = 60 * 1000;
const LOCKED = ["PUBLISHING", "DONE", "PARTIAL"]; // déjà (en partie) publiées : on duplique au lieu de modifier

async function findOwned(userId: string, id: string) {
  const s = await prisma.schedule.findFirst({ where: { id, userId }, include });
  if (!s) throw new AppError("Programmation introuvable", 404);
  return s;
}

// Vérifie les destinations et renvoie les avertissements non bloquants
async function checkTargets(userId: string, input: ScheduleInput) {
  const ids = [...new Set(input.targets.map((t) => t.accountId))];
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: ids }, userId, platform: { in: ["FACEBOOK", "INSTAGRAM"] } },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const warnings: string[] = [];

  for (const t of input.targets) {
    const acc = byId.get(t.accountId);
    if (!acc) throw new AppError("Compte introuvable", 404);
    if (!acc.isActive) throw new AppError(`${acc.name} est désactivé : réactivez-le dans Connexions`, 422);
    if (input.kind === "COMMENT" && acc.platform === "FACEBOOK" && !t.refId!.startsWith(`${acc.externalId}_`)) {
      throw new AppError(`Cette publication n'appartient pas à ${acc.name}`, 422);
    }
    if (input.kind === "POST" && acc.platform === "INSTAGRAM") {
      if (!input.imageUrl) throw new AppError(`Instagram (${acc.name}) exige une image`, 422);
      if (input.text.length > TEXT_LIMITS.INSTAGRAM_CAPTION) {
        throw new AppError(`Légende Instagram trop longue (${TEXT_LIMITS.INSTAGRAM_CAPTION} caractères maximum)`, 422);
      }
    }
  }

  if (input.kind === "POST" && input.imageUrl) {
    const local = localUploadName(input.imageUrl);
    if (local) await readUpload(local); // image supprimée entre-temps : erreur immédiate plutôt qu'à l'envoi
    const hasInstagram = accounts.some((a) => a.platform === "INSTAGRAM");
    if (hasInstagram && !isPublicAddress(publicImageUrl(input.imageUrl))) {
      warnings.push(
        `Instagram ne pourra pas télécharger l'image depuis ${env.publicApiUrl} (adresse locale) : ` +
          "mettez l'API en ligne et renseignez PUBLIC_API_URL avant l'heure prévue."
      );
    }
  }
  return warnings;
}

function resolveTiming(input: ScheduleInput) {
  if (input.publishNow) return { status: "SCHEDULED" as const, scheduledAt: new Date() };
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.status === "SCHEDULED") {
    if (!scheduledAt) throw new AppError("Choisissez la date et l'heure d'envoi", 422);
    if (scheduledAt.getTime() < Date.now() - PAST_TOLERANCE_MS) throw new AppError("Cette date est déjà passée", 422);
  }
  return { status: input.status, scheduledAt };
}

const targetRows = (input: ScheduleInput) => {
  // Une publication n'est envoyée qu'une fois par compte
  const seen = new Set<string>();
  return input.targets
    .filter((t) => {
      const key = `${t.accountId}:${t.refId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({ accountId: t.accountId, refId: t.refId ?? null, label: t.label ?? null }));
};

// Supprime l'image téléversée si plus aucune programmation ne l'utilise
async function releaseImage(url: string | null) {
  const name = localUploadName(url);
  if (!name) return;
  const used = await prisma.schedule.count({ where: { imageUrl: { endsWith: `/uploads/${name}` } } });
  if (!used) await deleteUpload(name);
}

const content = (input: ScheduleInput) => ({
  kind: input.kind,
  text: input.text,
  imageUrl: input.kind === "POST" ? (input.imageUrl ?? null) : null,
  link: input.kind === "POST" ? (input.link ?? null) : null,
  messageTag: input.kind === "MESSAGE" ? (input.messageTag ?? null) : null,
});

export const scheduleService = {
  list(userId: string, q: ListQuery) {
    return prisma.schedule.findMany({
      where: {
        userId,
        ...(q.status ? { status: { in: q.status } } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.from || q.to
          ? { scheduledAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(q.to) } : {}) } }
          : {}),
      },
      include,
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 500,
    });
  },

  get: findOwned,

  async create(userId: string, input: ScheduleInput) {
    const warnings = await checkTargets(userId, input);
    const timing = resolveTiming(input);
    const schedule = await prisma.schedule.create({
      data: { userId, ...content(input), ...timing, targets: { create: targetRows(input) } },
      include,
    });
    await prisma.activityLog.create({
      data: { userId, action: "SCHEDULE_CREATED", meta: { scheduleId: schedule.id, kind: input.kind, status: timing.status } },
    });
    if (input.publishNow) void runDueSchedules();
    return { schedule, warnings };
  },

  async update(userId: string, id: string, input: ScheduleInput) {
    const existing = await findOwned(userId, id);
    if (LOCKED.includes(existing.status)) {
      throw new AppError("Déjà publiée (au moins en partie) : dupliquez-la pour la reprogrammer", 409);
    }
    const warnings = await checkTargets(userId, input);
    const timing = resolveTiming(input);
    // Réservation : le robot ne doit pas la publier pendant la modification
    const claimed = await prisma.schedule.updateMany({
      where: { id, status: { in: ["DRAFT", "SCHEDULED", "FAILED"] } },
      data: { status: "DRAFT" },
    });
    if (!claimed.count) throw new AppError("Publication en cours : réessayez dans un instant", 409);

    const schedule = await prisma.$transaction(async (tx) => {
      await tx.scheduleTarget.deleteMany({ where: { scheduleId: id } });
      return tx.schedule.update({
        where: { id },
        data: { ...content(input), ...timing, error: null, publishedAt: null, targets: { create: targetRows(input) } },
        include,
      });
    });
    if (existing.imageUrl !== schedule.imageUrl) await releaseImage(existing.imageUrl);
    if (input.publishNow) void runDueSchedules();
    return { schedule, warnings };
  },

  async remove(userId: string, id: string) {
    const existing = await findOwned(userId, id);
    if (existing.status === "PUBLISHING") throw new AppError("Publication en cours : réessayez dans un instant", 409);
    await prisma.schedule.delete({ where: { id } });
    await releaseImage(existing.imageUrl);
  },

  // Envoi immédiat ; après un échec, seules les destinations en erreur sont relancées
  async publishNow(userId: string, id: string) {
    const existing = await findOwned(userId, id);
    if (existing.status === "PUBLISHING") throw new AppError("Publication déjà en cours", 409);
    if (existing.status === "DONE") throw new AppError("Déjà publiée : dupliquez-la pour la republier", 409);
    await prisma.scheduleTarget.updateMany({ where: { scheduleId: id, status: "FAILED" }, data: { status: "PENDING", error: null } });
    await prisma.schedule.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt: new Date(), error: null } });
    void runDueSchedules();
    return findOwned(userId, id);
  },
};
