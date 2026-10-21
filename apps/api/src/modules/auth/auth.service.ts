import crypto from "node:crypto";
import type { Subscription, User } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { sessionToken } from "../../utils/session.js";
import { AppError } from "../../utils/AppError.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";
import { PROVIDER_LABEL, type SocialProfile } from "./social.service.js";
import { assertAccess } from "../../utils/accountAccess.js";
import { summarizeSubscription } from "../billing/entitlements.js";
import { trialSubscription } from "../billing/plans.js";

// Toute lecture d'utilisateur destinée au navigateur inclut sa formule
const withSub = { subscription: true } as const;

// Le tout premier compte créé est l'administrateur de la plateforme (tableau de bord /app/admin)
async function roleForNewUser(): Promise<"ADMIN" | "USER"> {
  return (await prisma.user.count()) === 0 ? "ADMIN" : "USER";
}

type ClientInfo = { ip: string | null; ua: string | null };

// Ce que le navigateur a besoin de savoir sur l'utilisateur connecté (en-tête, redirection…)
export function publicUser(u: User & { subscription: Subscription | null }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl,
    defaultPage: u.defaultPage,
    desktopNotifications: u.desktopNotifications,
    darkMode: u.darkMode,
    accentTheme: u.accentTheme,
    subscription: summarizeSubscription(u),
  };
}

export const authService = {
  async register(data: RegisterInput, client: ClientInfo) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists?.deletedAt || exists?.status === "BANNED") {
      throw new AppError("Un compte fermé existe déjà avec cet e-mail : contactez le support SuiteFlow.", 409, "ACCOUNT_CLOSED");
    }
    if (exists) throw new AppError("Cet e-mail est déjà utilisé", 409);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: await hashPassword(data.password),
        role: await roleForNewUser(),
        subscription: { create: trialSubscription() }, // 14 jours d'essai Pro
      },
      include: withSub,
    });

    await prisma.activityLog.create({ data: { userId: user.id, action: "REGISTER", meta: client } });
    return { user: publicUser(user), token: sessionToken(user) };
  },

  async login(data: LoginInput, client: ClientInfo) {
    const user = await prisma.user.findUnique({ where: { email: data.email }, include: withSub });
    if (!user || !(await comparePassword(data.password, user.password))) {
      throw new AppError("E-mail ou mot de passe incorrect", 401);
    }
    assertAccess(user); // suspendu, banni ou supprimé par un administrateur
    await prisma.activityLog.create({ data: { userId: user.id, action: "LOGIN", meta: client } });
    return { user: publicUser(user), token: sessionToken(user) };
  },

  // Connexion / inscription via Facebook ou Google
  async socialLogin(profile: SocialProfile, client: ClientInfo) {
    const label = PROVIDER_LABEL[profile.provider];
    const link = profile.provider === "facebook" ? { facebookId: profile.providerId } : { googleId: profile.providerId };

    let user = await prisma.user.findUnique({ where: link, include: withSub });
    let created = false;

    if (!user) {
      if (!profile.email) {
        throw new AppError(`${label} n'a pas partagé votre adresse e-mail : créez votre compte avec votre e-mail et un mot de passe.`, 422);
      }
      const existing = await prisma.user.findFirst({ where: { email: { equals: profile.email, mode: "insensitive" } } });
      if (existing) {
        // Rattacher une identité à un compte existant exige une adresse garantie par le fournisseur,
        // sinon n'importe qui pourrait prendre la main sur un compte en déclarant son e-mail.
        if (!profile.emailVerified) {
          throw new AppError("Un compte SuiteFlow existe déjà avec cette adresse : connectez-vous avec votre mot de passe.", 409);
        }
        user = await prisma.user.update({ where: { id: existing.id }, data: link, include: withSub });
      } else {
        user = await prisma.user.create({
          data: {
            name: profile.name.trim().slice(0, 80) || profile.email,
            email: profile.email,
            // Mot de passe aléatoire inconnu de tous : la personne se connecte via le fournisseur
            password: await hashPassword(crypto.randomBytes(32).toString("hex")),
            role: await roleForNewUser(),
            ...link,
            subscription: { create: trialSubscription() }, // 14 jours d'essai Pro
          },
          include: withSub,
        });
        created = true;
      }
    }

    assertAccess(user); // suspendu, banni ou supprimé par un administrateur
    await prisma.activityLog.create({
      data: { userId: user.id, action: created ? "REGISTER" : "LOGIN", meta: { ...client, provider: profile.provider } },
    });
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
    const user = await prisma.user.findUnique({ where: { id: userId }, include: withSub });
    if (!user) throw new AppError("Utilisateur introuvable", 404);
    return publicUser(user);
  },
};
