import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type { CreateAccountInput } from "./account.schema.js";
import { checkAccount } from "./account.check.js";
import { assertPageSlot } from "../billing/entitlements.js";

// Champs renvoyés au navigateur : jamais le jeton d'accès de la Page
const PUBLIC_FIELDS = {
  id: true,
  platform: true,
  externalId: true,
  name: true,
  avatarUrl: true,
  isActive: true,
  syncError: true,
  createdAt: true,
} as const;

export const accountService = {
  list: (userId: string) =>
    prisma.socialAccount.findMany({
      where: { userId },
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: "desc" },
    }),

  async create(userId: string, data: CreateAccountInput) {
    if (data.platform === "FACEBOOK") await assertPageSlot(userId); // nombre de Pages de la formule
    return prisma.socialAccount.create({
      data: { ...data, userId, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null },
      select: PUBLIC_FIELDS,
    });
  },

  async toggle(userId: string, id: string, isActive: boolean) {
    const acc = await prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!acc) throw new AppError("Compte introuvable", 404);
    if (isActive && !acc.isActive) {
      if (acc.platform === "FACEBOOK") await assertPageSlot(userId); // nombre de Pages de la formule
      if (acc.platform === "INSTAGRAM" && acc.linkedPageId) {
        const page = await prisma.socialAccount.findFirst({ where: { userId, platform: "FACEBOOK", externalId: acc.linkedPageId } });
        if (page && !page.isActive) throw new AppError(`Activez d'abord la Page liée « ${page.name} » : ce compte Instagram en dépend.`, 422);
      }
    }
    const updated = await prisma.socialAccount.update({ where: { id }, data: { isActive }, select: PUBLIC_FIELDS });
    // Le compte Instagram lié suit sa Page
    if (acc.platform === "FACEBOOK") {
      await prisma.socialAccount.updateMany({ where: { userId, platform: "INSTAGRAM", linkedPageId: acc.externalId }, data: { isActive } });
    }
    return updated;
  },

  // État de la connexion : jeton, accès à la Page, autorisations par fonction
  async check(userId: string, id: string) {
    const acc = await prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!acc) throw new AppError("Compte introuvable", 404);
    return checkAccount(acc);
  },

  async remove(userId: string, id: string) {
    const acc = await prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!acc) throw new AppError("Compte introuvable", 404);
    await prisma.socialAccount.delete({ where: { id } });
  },
};
