import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

// Singleton pour éviter de multiplier les connexions en dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.isProd ? ["error"] : ["query", "error", "warn"] });

if (!env.isProd) globalForPrisma.prisma = prisma;