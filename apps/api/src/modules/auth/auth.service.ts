import crypto from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { sessionToken } from "../../utils/session.js";
import { AppError } from "../../utils/AppError.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

type ClientInfo = { ip: string | null; ua: string | null };

// Ce que le navigateur a besoin de savoir sur l'utilisateur connecté (en-tête, redirection…)
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl,
    defaultPage: u.defaultPage,
    desktopNotifications: u.desktopNotifications,
  };
}

export const authService = {
  async register(data: RegisterInput, client: ClientInfo) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new AppError("Cet e-mail est déjà utilisé", 409);

    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: await hashPassword(data.password) },
    });

    await prisma.activityLog.create({ data: { userId: user.id, action: "REGISTER", meta: client } });
    return { user: publicUser(user), token: sessionToken(user) };
  },

  async login(data: LoginInput, client: ClientInfo) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !(await comparePassword(data.password, user.password))) {
      throw new AppError("E-mail ou mot de passe incorrect", 401);
    }
    await prisma.activityLog.create({ data: { userId: user.id, action: "LOGIN", meta: client } });
    return { user: publicUser(user), token: sessionToken(user) };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Réponse identique que l'utilisateur existe ou non (anti-énumération)
    if (!user) return;

    const raw = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(raw).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashed, resetExpires: new Date(Date.now() + 60 * 60 * 1000) },
    });
    // TODO: envoyer l'e-mail avec le lien ?token=raw (service mail à brancher)
    return raw;
  },

  async resetPassword(token: string, password: string) {
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({
      where: { resetToken: hashed, resetExpires: { gt: new Date() } },
    });
    if (!user) throw new AppError("Token invalide ou expiré", 400);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(password),
        resetToken: null,
        resetExpires: null,
        tokenVersion: { increment: 1 }, // les sessions ouvertes avec l'ancien mot de passe sont fermées
      },
    });
    await prisma.activityLog.create({ data: { userId: user.id, action: "PASSWORD_RESET" } });
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("Utilisateur introuvable", 404);
    return publicUser(user);
  },
};
