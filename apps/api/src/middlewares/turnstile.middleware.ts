import type { Request, Response, NextFunction } from "express";
import axios from "axios";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

// Cloudflare Turnstile : vérifie le jeton « je ne suis pas un robot » envoyé par le formulaire.
// Sans clé secrète (production non configurée), la vérification est ignorée.
export const isTurnstileEnabled = () => Boolean(env.turnstile.secretKey && env.turnstile.siteKey);

export function requireTurnstile(req: Request, _res: Response, next: NextFunction) {
  if (!isTurnstileEnabled()) return next();
  const token = (req.body?.turnstileToken ?? req.get("cf-turnstile-response")) as string | undefined;
  if (!token) return next(new AppError("Confirmez que vous n'êtes pas un robot.", 400, "TURNSTILE_REQUIRED"));
  const body = new URLSearchParams({ secret: env.turnstile.secretKey, response: token, ...(req.ip ? { remoteip: req.ip } : {}) });
  axios
    .post("https://challenges.cloudflare.com/turnstile/v0/siteverify", body, { timeout: 8000 })
    .then(({ data }) => {
      if (data?.success) return next();
      next(new AppError("La vérification anti-robot a échoué ou a expiré : réessayez.", 400, "TURNSTILE_FAILED"));
    })
    .catch(() => next(new AppError("Vérification anti-robot indisponible, réessayez dans un instant.", 503, "TURNSTILE_UNAVAILABLE")));
}
