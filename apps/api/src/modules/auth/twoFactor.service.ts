import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import type { TwoFactorChallenge, TwoFactorMethod, User } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { open, seal } from "../../utils/secretBox.js";
import { newTotpSecret, otpauthUrl, verifyTotp } from "../../utils/totp.js";
import { isMailConfigured, mailDelivery, sendTwoFactorCode } from "../mail/mail.service.js";

// Validation en deux étapes : code envoyé par e-mail, ou code d'une application (Google Authenticator…).
// Désactivée par défaut ; codes de secours à usage unique en cas de perte du téléphone ou de la boîte mail.

const CHALLENGE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 45_000;
const RECOVERY_COUNT = 8;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O, 1/I

export type Purpose = "LOGIN" | "SETUP_EMAIL" | "DISABLE";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const codeHash = (challengeId: string, code: string) => sha(`${challengeId}:${code}`);
const normRecovery = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

// e***@gmail.com
export const maskEmail = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, (_m, a: string, b: string) => `${a}***${b}`);

function newRecoveryCodes() {
  const codes = Array.from({ length: RECOVERY_COUNT }, () => {
    const s = Array.from({ length: 8 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { codes, hashes: codes.map((c) => sha(normRecovery(c))) };
}

async function createChallenge(user: Pick<User, "id" | "email" | "name">, purpose: Purpose, method: TwoFactorMethod, remember = true) {
  // Une seule étape en attente par usage : les précédentes ne servent plus
  await prisma.twoFactorChallenge.deleteMany({ where: { userId: user.id, purpose, consumedAt: null } });
  const id = randomBytes(24).toString("base64url");
  let code: string | null = null;
  if (method === "EMAIL") code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const ch = await prisma.twoFactorChallenge.create({
    data: {
      id,
      userId: user.id,
      purpose,
      method,
      remember,
      codeHash: code ? codeHash(id, code) : null,
      lastSentAt: code ? new Date() : null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  if (code) await sendTwoFactorCode(user.email, user.name, code, purpose === "LOGIN" ? "LOGIN" : "SETUP_EMAIL");
  return ch;
}

const challengeView = (ch: TwoFactorChallenge, email: string) => ({
  challengeId: ch.id,
  method: ch.method,
  emailHint: ch.method === "EMAIL" ? maskEmail(email) : null,
  expiresAt: ch.expiresAt,
  // « console » : aucun serveur d'e-mail, le code est seulement affiché dans le terminal de l'API (dev)
  delivery: ch.method === "EMAIL" ? mailDelivery() : null,
});

// Étape en cours, encore valide
async function liveChallenge(id: string, purpose: Purpose, userId?: string) {
  const ch = await prisma.twoFactorChallenge.findUnique({ where: { id }, include: { user: true } });
  if (!ch || ch.purpose !== purpose || (userId && ch.userId !== userId) || ch.consumedAt) {
    throw new AppError("Cette vérification n'est plus valide : recommencez.", 400, "TWO_FACTOR_EXPIRED");
  }
  if (ch.expiresAt < new Date()) throw new AppError("Le code a expiré : recommencez.", 400, "TWO_FACTOR_EXPIRED");
  if (ch.attempts >= MAX_ATTEMPTS) throw new AppError("Trop d'essais : recommencez la vérification.", 429, "TWO_FACTOR_LOCKED");
  return ch;
}

// Vérifie le second facteur : code de l'étape (e-mail), code de l'application, ou code de secours
async function checkCode(user: User, ch: TwoFactorChallenge | null, code: string, opts: { totpSecret?: string } = {}): Promise<"code" | "recovery"> {
  const raw = code.trim();
  // Code de secours (XXXX-XXXX), accepté pour la connexion et la désactivation
  const rec = normRecovery(raw);
  if (rec.length === 8 && /[A-Z]/.test(rec)) {
    const h = sha(rec);
    if (user.twoFactorRecovery.includes(h)) {
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecovery: user.twoFactorRecovery.filter((x) => x !== h) } });
      return "recovery";
    }
    throw new AppError("Code de secours invalide ou déjà utilisé.", 400, "TWO_FACTOR_INVALID");
  }
  const digits = raw.replace(/\s/g, "");
  if (ch?.method === "EMAIL" && ch.codeHash) {
    const ok = /^\d{6}$/.test(digits) && timingSafeEqual(Buffer.from(codeHash(ch.id, digits)), Buffer.from(ch.codeHash));
    if (!ok) throw new AppError("Code incorrect.", 400, "TWO_FACTOR_INVALID");
    return "code";
  }
  const secret = opts.totpSecret ?? (user.totpSecret ? open(user.totpSecret) : null);
  if (!secret) throw new AppError("Code incorrect.", 400, "TWO_FACTOR_INVALID");
  const step = verifyTotp(secret, digits);
  // Un code déjà accepté ne sert pas deux fois (rejeu)
  if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) throw new AppError("Code incorrect ou déjà utilisé.", 400, "TWO_FACTOR_INVALID");
  await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
  return "code";
}

// Essai compté avant la vérification : 5 erreurs invalident l'étape
async function attempt<T>(ch: TwoFactorChallenge, fn: () => Promise<T>): Promise<T> {
  await prisma.twoFactorChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
  const r = await fn();
  await prisma.twoFactorChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
  return r;
}

export const twoFactorService = {
  status(user: Pick<User, "twoFactorMethod" | "twoFactorEnabledAt" | "twoFactorRecovery">) {
    return {
      method: user.twoFactorMethod,
      enabledAt: user.twoFactorEnabledAt,
      recoveryLeft: user.twoFactorRecovery.length,
      emailAvailable: isMailConfigured() || process.env.NODE_ENV !== "production",
      mailConfigured: isMailConfigured(),
    };
  },

  // Connexion : mot de passe (ou fournisseur) validé, code demandé
  async startLogin(user: User, remember: boolean) {
    const ch = await createChallenge(user, "LOGIN", user.twoFactorMethod!, remember);
    return challengeView(ch, user.email);
  },

  async verifyLogin(challengeId: string, code: string) {
    const ch = await liveChallenge(challengeId, "LOGIN");
    const used = await attempt(ch, () => checkCode(ch.user, ch, code));
    return { userId: ch.userId, remember: ch.remember, usedRecovery: used === "recovery" };
  },

  async resend(challengeId: string) {
    const ch = await liveChallenge(challengeId, "LOGIN");
    if (ch.method !== "EMAIL") throw new AppError("Ouvrez votre application d'authentification pour obtenir le code.", 400);
    if (ch.lastSentAt && Date.now() - ch.lastSentAt.getTime() < RESEND_AFTER_MS) {
      throw new AppError("Patientez quelques secondes avant de redemander un code.", 429);
    }
    const next = await createChallenge(ch.user, "LOGIN", "EMAIL", ch.remember);
    return challengeView(next, ch.user.email);
  },

  // ─── Activation par e-mail ─────────────────────────────────────────────────
  async startEmail(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorMethod) throw new AppError("La validation en deux étapes est déjà activée : désactivez-la d'abord.", 409);
    const ch = await createChallenge(user, "SETUP_EMAIL", "EMAIL");
    return challengeView(ch, user.email);
  },

  async confirmEmail(userId: string, challengeId: string, code: string) {
    const ch = await liveChallenge(challengeId, "SETUP_EMAIL", userId);
    await attempt(ch, () => checkCode(ch.user, ch, code));
    const { codes, hashes } = newRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorMethod: "EMAIL", twoFactorEnabledAt: new Date(), twoFactorRecovery: hashes, totpSecret: null, totpPendingSecret: null },
    });
    await prisma.activityLog.create({ data: { userId, action: "TWO_FACTOR_ENABLED", meta: { method: "EMAIL" } } });
    return { method: "EMAIL" as const, recoveryCodes: codes };
  },

  // ─── Activation par application (Google Authenticator…) ────────────────────
  async startTotp(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorMethod) throw new AppError("La validation en deux étapes est déjà activée : désactivez-la d'abord.", 409);
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: seal(secret) } });
    const url = otpauthUrl(secret, user.email);
    return {
      secret: secret.match(/.{1,4}/g)!.join(" "), // saisie manuelle
      otpauthUrl: url,
      qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" }),
    };
  },

  async confirmTotp(userId: string, code: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpPendingSecret) throw new AppError("Recommencez l'activation : le QR code a expiré.", 400, "TWO_FACTOR_EXPIRED");
    await checkCode(user, null, code, { totpSecret: open(user.totpPendingSecret) });
    const { codes, hashes } = newRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorMethod: "TOTP",
        twoFactorEnabledAt: new Date(),
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        twoFactorRecovery: hashes,
      },
    });
    await prisma.activityLog.create({ data: { userId, action: "TWO_FACTOR_ENABLED", meta: { method: "TOTP" } } });
    return { method: "TOTP" as const, recoveryCodes: codes };
  },

  // ─── Désactivation : un code valide (e-mail, application ou secours) est exigé ─
  async startDisable(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorMethod !== "EMAIL") return null; // application : le code est déjà sur le téléphone
    const ch = await createChallenge(user, "DISABLE", "EMAIL");
    return challengeView(ch, user.email);
  },

  async disable(userId: string, code: string, challengeId?: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorMethod) return { method: null };
    if (user.twoFactorMethod === "EMAIL" && challengeId) {
      const ch = await liveChallenge(challengeId, "DISABLE", userId);
      await attempt(ch, () => checkCode(user, ch, code));
    } else {
      await checkCode(user, null, code); // application ou code de secours
    }
    await prisma.user.update({ where: { id: userId }, data: resetFields });
    await prisma.activityLog.create({ data: { userId, action: "TWO_FACTOR_DISABLED", meta: { method: user.twoFactorMethod } } });
    return { method: null };
  },

  // Administrateur : téléphone ou boîte mail perdus
  async adminReset(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: resetFields });
    await prisma.twoFactorChallenge.deleteMany({ where: { userId } });
  },
};

const resetFields = {
  twoFactorMethod: null,
  twoFactorEnabledAt: null,
  totpSecret: null,
  totpPendingSecret: null,
  totpLastStep: null,
  twoFactorRecovery: [],
};
