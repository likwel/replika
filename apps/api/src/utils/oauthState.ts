import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";

const COOKIE = "oauth_state";
const cookieOpts = { httpOnly: true, secure: env.isProd, sameSite: "lax" as const, path: "/api" };

// Anti-CSRF des connexions OAuth : un jeton aléatoire est posé en cookie avant le départ chez le
// fournisseur, puis comparé à celui qui revient. Un lien OAuth fabriqué par un tiers n'a pas de
// cookie correspondant dans le navigateur de la victime : il est refusé.
// `purpose` (ex. « login:google », « pages:<userId> ») est relu au retour, une fois le jeton vérifié.
export function issueOAuthState(res: Response, purpose: string): string {
  const state = `${purpose}.${crypto.randomBytes(24).toString("hex")}`;
  res.cookie(COOKIE, state, { ...cookieOpts, maxAge: 10 * 60 * 1000 });
  return state;
}

// Usage unique : le cookie est effacé dans tous les cas. Renvoie `purpose`, ou null si le jeton ne correspond pas.
export function consumeOAuthState(req: Request, res: Response, received: unknown): string | null {
  const expected: unknown = req.cookies?.[COOKIE];
  res.clearCookie(COOKIE, cookieOpts);
  if (typeof received !== "string" || typeof expected !== "string") return null;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return received.slice(0, received.lastIndexOf("."));
}
