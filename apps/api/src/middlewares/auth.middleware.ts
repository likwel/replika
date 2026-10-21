import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/prisma.js";
import { MODERATION_SELECT, accessError } from "../utils/accountAccess.js";
import { runAsActor } from "../utils/requestContext.js";
import { TEAM_MODULES, WORKSPACE_BASES, allows, requiredAccess, resolveWorkspace, touchMember, type Workspace } from "../modules/team/team.access.js";

// Étend Request pour porter l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      // userId : compte dont on lit et modifie les données (le propriétaire si un membre d'équipe agit dans son
      // espace) ; actorId : la personne réellement connectée ; workspace : renseigné seulement pour un membre
      user?: { userId: string; role: string; actorId: string; workspace?: Workspace };
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
    .findUnique({ where: { id: payload.userId }, select: { tokenVersion: true, role: true, name: true, activeOwnerId: true, ...MODERATION_SELECT } })
    .then(async (user) => {
      if (!user || (payload.tv ?? 0) !== user.tokenVersion) {
        return next(new AppError("Session expirée, veuillez vous reconnecter", 401));
      }
      const blocked = accessError(user); // compte suspendu, banni ou supprimé depuis la connexion
      if (blocked) return next(blocked);
      req.user = { userId: payload.userId, role: user.role, actorId: payload.userId };

      // Membre d'équipe dans l'espace d'un autre compte : les données sont celles du propriétaire,
      // selon les droits du membre sur le module demandé
      const base = req.baseUrl.replace(/^\/api/, "");
      if (!user.activeOwnerId || user.activeOwnerId === payload.userId || !WORKSPACE_BASES.has(base)) return next();
      const r = await resolveWorkspace(payload.userId, user.activeOwnerId);
      if (!r.ok) return next(r.error);
      const need = requiredAccess(base, req);
      if (need && !allows(r.workspace.permissions, need.module, need.level)) {
        const what = TEAM_MODULES[need.module];
        return next(
          new AppError(
            need.level === "write" && r.workspace.permissions[need.module] === "read"
              ? `Consultation seule : votre rôle dans l'espace ${r.workspace.ownerName} ne permet pas de modifier « ${what} ».`
              : `Accès refusé : votre rôle dans l'espace ${r.workspace.ownerName} ne donne pas accès à « ${what} ».`,
            403,
            "TEAM_FORBIDDEN",
          ),
        );
      }
      req.user = { userId: r.workspace.ownerId, role: user.role, actorId: payload.userId, workspace: r.workspace };
      touchMember(r.workspace.memberId);
      runAsActor({ id: payload.userId, name: user.name }, next);
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
