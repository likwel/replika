import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { sessionToken } from "../../utils/session.js";
import type { EmailInput, PasswordInput, PreferencesInput, ProfileInput } from "./profile.schema.js";

type ClientInfo = { ip: string | null; ua: string | null };

const PROFILE_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  companyName: true,
  address: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  autoReplyEnabled: true,
  defaultPage: true,
  desktopNotifications: true,
} as const;

// Événements affichés dans l'historique de sécurité
const SECURITY_ACTIONS = [
  "REGISTER",
  "LOGIN",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "EMAIL_CHANGED",
  "LOGOUT_ALL",
];

async function checkPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Utilisateur introuvable", 404);
  if (!(await comparePassword(password, user.password))) {
    throw new AppError("Mot de passe actuel incorrect", 400);
  }
  return user;
}

export const profileService = {
  get: (userId: string) => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PROFILE_FIELDS }),

  async update(userId: string, data: ProfileInput) {
    const user = await prisma.user.update({ where: { id: userId }, data, select: PROFILE_FIELDS });
    await prisma.activityLog.create({
      data: { userId, action: "PROFILE_UPDATED", meta: { fields: Object.keys(data) } },
    });
    return user;
  },

  async changeEmail(userId: string, { email, currentPassword }: EmailInput, client: ClientInfo) {
    const user = await checkPassword(userId, currentPassword);
    if (email === user.email) throw new AppError("C'est déjà votre adresse e-mail", 400);
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError("Cet e-mail est déjà utilisé", 409);
    }
    const updated = await prisma.user.update({ where: { id: userId }, data: { email }, select: PROFILE_FIELDS });
    await prisma.activityLog.create({
      data: { userId, action: "EMAIL_CHANGED", meta: { ...client, from: user.email, to: email } },
    });
    return updated;
  },

  // Change le mot de passe et ferme toutes les autres sessions ; renvoie un jeton pour la session courante
  async changePassword(userId: string, { currentPassword, newPassword }: PasswordInput, client: ClientInfo) {
    await checkPassword(userId, currentPassword);
    if (currentPassword === newPassword) {
      throw new AppError("Le nouveau mot de passe doit être différent de l'actuel", 400);
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    });
    await prisma.activityLog.create({ data: { userId, action: "PASSWORD_CHANGED", meta: client } });
    return sessionToken(user);
  },

  // Ferme toutes les sessions sauf la session courante (qui reçoit un nouveau jeton)
  async logoutOthers(userId: string, client: ClientInfo) {
    const user = await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    await prisma.activityLog.create({ data: { userId, action: "LOGOUT_ALL", meta: client } });
    return sessionToken(user);
  },

  updatePreferences: (userId: string, data: PreferencesInput) =>
    prisma.user.update({ where: { id: userId }, data, select: PROFILE_FIELDS }),

  activity: (userId: string) =>
    prisma.activityLog.findMany({
      where: { userId, action: { in: SECURITY_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, meta: true, createdAt: true },
    }),

  // Supprime le compte et, en cascade, ses Pages liées, règles, messages et historique
  async remove(userId: string, password: string) {
    await checkPassword(userId, password);
    await prisma.user.delete({ where: { id: userId } });
  },
};
