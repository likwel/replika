import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { currentActor } from "../utils/requestContext.js";

// Singleton pour éviter de multiplier les connexions en dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const client = new PrismaClient({ log: env.isProd ? ["error"] : ["error", "warn"] });
  // Action faite par un membre d'équipe : l'entrée d'historique est signée de son nom
  client.$use(async (params, next) => {
    const actor = currentActor();
    if (actor && params.model === "ActivityLog" && params.action === "create" && params.args?.data && !params.args.data.actorId) {
      params.args.data = { ...params.args.data, actorId: actor.id, actorName: actor.name };
    }
    return next(params);
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (!env.isProd) globalForPrisma.prisma = prisma;