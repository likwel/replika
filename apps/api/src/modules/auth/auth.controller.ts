import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { env } from "../../config/env.js";
import { authService } from "./auth.service.js";
import { clientInfo, setSessionCookie } from "../../utils/session.js";
import { consumeOAuthState, issueOAuthState } from "../../utils/oauthState.js";
import { authorizeUrl, fetchProfile, isConfigured, PROVIDER_LABEL, SOCIAL_PROVIDERS, type SocialProvider } from "./social.service.js";

// Retour sur la page de connexion avec un message (le navigateur arrive ici depuis Facebook / Google)
const loginWithError = (message: string) => `${env.clientUrl}/connexion?${new URLSearchParams({ oauth_error: message })}`;

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const { user, token } = await authService.register(req.body, clientInfo(req));
    setSessionCookie(res, token);
    res.status(201).json({ status: "success", data: { user, token } });
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const { user, token } = await authService.login(req.body, clientInfo(req));
    setSessionCookie(res, token, req.body.remember !== false);
    res.json({ status: "success", data: { user, token } });
  }),

  logout: catchAsync(async (_req: Request, res: Response) => {
    res.clearCookie("token").json({ status: "success", message: "Déconnecté" });
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    res.json({ status: "success", message: "Si un compte existe, un e-mail a été envoyé." });
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ status: "success", message: "Mot de passe réinitialisé." });
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.userId);
    res.json({ status: "success", data: { user } });
  }),

  // Fournisseurs de connexion configurés sur ce serveur (le front n'affiche que ceux-là)
  providers: (_req: Request, res: Response) => {
    res.json({ status: "success", data: Object.fromEntries(SOCIAL_PROVIDERS.map((p) => [p, isConfigured(p)])) });
  },

  // GET /api/auth/:provider → départ vers la fenêtre de connexion du fournisseur
  socialStart: (req: Request, res: Response) => {
    const provider = req.params.provider as SocialProvider;
    if (!isConfigured(provider)) return res.redirect(loginWithError(`La connexion avec ${PROVIDER_LABEL[provider]} n'est pas encore configurée.`));
    res.redirect(authorizeUrl(provider, issueOAuthState(res, `login:${provider}`)));
  },

  // GET /api/auth/:provider/callback → retour du fournisseur
  socialCallback: catchAsync(async (req: Request, res: Response) => {
    const provider = req.params.provider as SocialProvider;
    const label = PROVIDER_LABEL[provider];
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const purpose = consumeOAuthState(req, res, state);

    if (error) return res.redirect(loginWithError(`Connexion avec ${label} annulée.`));
    if (purpose !== `login:${provider}` || !code) {
      return res.redirect(loginWithError("La demande de connexion a expiré ou n'a pas pu être vérifiée : réessayez."));
    }

    try {
      const profile = await fetchProfile(provider, code);
      const { token } = await authService.socialLogin(profile, clientInfo(req));
      setSessionCookie(res, token);
      res.redirect(`${env.clientUrl}/app`);
    } catch (e) {
      if (!(e instanceof AppError)) console.error(`❌ Connexion ${label} :`, e);
      res.redirect(loginWithError(e instanceof AppError ? e.message : `Connexion avec ${label} impossible, réessayez.`));
    }
  }),
};
