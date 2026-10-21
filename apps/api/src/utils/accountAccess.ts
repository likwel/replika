import type { AccountStatus, Prisma } from "@prisma/client";
import { AppError } from "./AppError.js";

// Accès d'un compte selon la modération (suspendu, banni, supprimé par un administrateur)

export interface Moderation {
  status: AccountStatus;
  suspendedUntil: Date | null;
  moderationReason: string | null;
  deletedAt: Date | null;
}

export const MODERATION_SELECT = { status: true, suspendedUntil: true, moderationReason: true, deletedAt: true } as const;

// Suspension arrivée à échéance : le compte redevient actif sans action de l'administrateur
export const isBlocked = (u: Moderation, now = new Date()) =>
  Boolean(u.deletedAt) || u.status === "BANNED" || (u.status === "SUSPENDED" && (!u.suspendedUntil || u.suspendedUntil > now));

// Erreur à renvoyer à la connexion (ou à une session encore ouverte) ; null si le compte est accessible
export function accessError(u: Moderation, now = new Date()): AppError | null {
  if (!isBlocked(u, now)) return null;
  const reason = u.moderationReason ? ` Motif : ${u.moderationReason}` : "";
  if (u.deletedAt) return new AppError("Ce compte a été supprimé. Contactez le support SuiteFlow pour le récupérer.", 403, "ACCOUNT_DELETED");
  if (u.status === "BANNED") return new AppError(`Ce compte a été banni pour non-respect des conditions d'utilisation.${reason}`, 403, "ACCOUNT_BANNED");
  const until = u.suspendedUntil
    ? ` jusqu'au ${u.suspendedUntil.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Antananarivo" })}`
    : "";
  return new AppError(`Ce compte est suspendu${until}.${reason}`, 403, "ACCOUNT_SUSPENDED");
}

export function assertAccess(u: Moderation) {
  const e = accessError(u);
  if (e) throw e;
}

// Comptes dont les Pages doivent être relevées (relève, webhooks) : ni supprimés, ni bannis, ni suspendus
export const workingUserWhere = (now = new Date()): Prisma.UserWhereInput => ({
  deletedAt: null,
  OR: [{ status: "ACTIVE" }, { status: "SUSPENDED", suspendedUntil: { lte: now } }],
});
