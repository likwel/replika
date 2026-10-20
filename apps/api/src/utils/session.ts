import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { signToken } from "./jwt.js";

export const cookieOpts = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Signe un jeton lié à la version de session courante de l'utilisateur
export const sessionToken = (user: { id: string; role: string; tokenVersion: number }) =>
  signToken({ userId: user.id, role: user.role, tv: user.tokenVersion });

// Pose (ou remplace) le cookie de session. persistent = false (« Se souvenir de moi » décoché) :
// cookie de session, effacé à la fermeture du navigateur.
export function setSessionCookie(res: Response, token: string, persistent = true) {
  if (persistent) res.cookie("token", token, cookieOpts);
  else res.cookie("token", token, { ...cookieOpts, maxAge: undefined });
}

// Contexte d'une connexion, affiché dans l'historique de sécurité
export function clientInfo(req: Request) {
  return { ip: req.ip ?? null, ua: req.get("user-agent")?.slice(0, 300) ?? null };
}
