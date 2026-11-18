import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type { PipelineInput, PipelineUpdateInput } from "./pipeline.schema.js";

async function findOwned(userId: string, id: string) {
  const p = await prisma.pipeline.findFirst({ where: { id, userId } });
  if (!p) throw new AppError("Pipeline introuvable", 404);
  return p;
}

// Compte et règles référencés : ils doivent appartenir à l'espace (sinon un id étranger passerait la validation)
async function assertReferences(userId: string, accountIds: string[] | undefined, steps: PipelineInput["steps"] | undefined) {
  const ids = [...new Set(accountIds ?? [])];
  if (ids.length) {
    const found = await prisma.socialAccount.count({ where: { userId, id: { in: ids } } });
    if (found !== ids.length) throw new AppError("Compte introuvable", 404);
  }
  const ruleIds = [...new Set((steps ?? []).flatMap((s) => (s.type === "MATCH_RULE" ? [s.config.ruleId] : [])))];
  if (ruleIds.length) {
    const found = await prisma.automationRule.count({ where: { userId, id: { in: ruleIds } } });
    if (found !== ruleIds.length) throw new AppError("Une règle choisie dans une étape n'existe plus", 422);
  }
}

export const pipelineService = {
  list: (userId: string) =>
    prisma.pipeline.findMany({ where: { userId }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),

  async create(userId: string, input: PipelineInput) {
    await assertReferences(userId, input.accountIds, input.steps);
    return prisma.pipeline.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? null,
        trigger: input.trigger,
        accountIds: [...new Set(input.accountIds)],
        steps: input.steps as unknown as Prisma.InputJsonValue,
        isActive: input.isActive ?? false, // un nouveau pipeline démarre en pause : on le relit avant de l'activer
      },
    });
  },

  async update(userId: string, id: string, input: PipelineUpdateInput) {
    const current = await findOwned(userId, id);
    await assertReferences(userId, input.accountIds, input.steps);
    return prisma.pipeline.update({
      where: { id: current.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
        ...(input.accountIds !== undefined ? { accountIds: [...new Set(input.accountIds)] } : {}),
        ...(input.steps !== undefined ? { steps: input.steps as unknown as Prisma.InputJsonValue } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  },

  async remove(userId: string, id: string) {
    const p = await findOwned(userId, id);
    await prisma.pipeline.delete({ where: { id: p.id } });
  },

  // Dernières exécutions, tous pipelines ou un seul
  runs: (userId: string, pipelineId?: string) =>
    prisma.pipelineRun.findMany({
      where: { userId, ...(pipelineId ? { pipelineId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { pipeline: { select: { id: true, name: true } } },
    }),
};
