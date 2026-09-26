import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/prisma.js";

// Étend Request pour porter l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7) : (req.cookies?.token as string | undefined);

  if (!token) return next(new AppError("Non authentifié", 401));

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(new AppError("Token invalide ou expiré", 401));
  }

  // Session révoquée (mot de passe changé, « déconnecter partout ») ou compte supprimé
  prisma.user
    .findUnique({ where: { id: payload.userId }, select: { tokenVersion: true, role: true } })
    .then((user) => {
      if (!user || (payload.tv ?? 0) !== user.tokenVersion) {
        return next(new AppError("Session expirée, veuillez vous reconnecter", 401));
      }
      req.user = { userId: payload.userId, role: user.role };
      next();
    })
    .catch(next);
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError("Accès refusé", 403);
    }
    next();
  };
}
