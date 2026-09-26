import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ status: "error", message: err.message });
  }

  // Corps de requête refusé par express (trop lourd, JSON invalide)
  const bodyError = (err as { type?: string }).type;
  if (bodyError === "entity.too.large") {
    return res.status(413).json({ status: "error", message: "Fichier ou contenu trop lourd." });
  }
  if (bodyError === "entity.parse.failed") {
    return res.status(400).json({ status: "error", message: "Contenu de la requête invalide." });
  }

  // Erreurs Prisma fréquentes
  if (err.name === "PrismaClientKnownRequestError") {
    return res.status(409).json({ status: "error", message: "Conflit de données." });
  }

  console.error("❌", err);
  return res.status(500).json({
    status: "error",
    message: "Erreur interne du serveur",
    ...(env.isProd ? {} : { detail: err.message }),
  });
}