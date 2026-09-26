import { prisma } from "../../config/prisma.js";

export const historyService = {
  list: (userId: string, limit = 100) =>
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
};