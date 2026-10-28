import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { facebookService } from "./facebook.service.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { consumeOAuthState, issueOAuthState } from "../../utils/oauthState.js";
import { prisma } from "../../config/prisma.js";
import { graphErrorMessage } from "./graph.client.js";

export const facebookController = {
  // GET /api/facebook/connect → renvoie l'URL de consentement
  connect: catchAsync(async (req: Request, res: Response) => {
    const url = facebookService.buildAuthUrl(issueOAuthState(res, `pages:${req.user!.userId}`));
    res.json({ status: "success", data: { url } });
  }),

  // GET /api/facebook/callback → Meta redirige ici
  callback: catchAsync(async (req: Request, res: Response) => {
    const { code, state, error, error_reason: errorReason, error_description: errorDescription } = req.query as Record<string, string>;
    // Le compte à relier vient du state émis par /connect pour CE navigateur : un lien Facebook fabriqué par
    // un tiers (avec son propre identifiant) ne peut plus rattacher les Pages d'une victime à son compte.
    const purpose = consumeOAuthState(req, res, state);
    const owner = purpose?.startsWith("pages:") ? purpose.slice("pages:".length) : null;
    // Échec gardé dans l'historique du compte : c'est souvent la seule trace (aucune Page n'est créée)
    const fail = async (reason: string) => {
      if (owner) await prisma.activityLog.create({ data: { userId: owner, action: "FACEBOOK_CONNECT_FAILED", meta: { reason } } }).catch(() => {});
      return res.redirect(`${env.clientUrl}/app/connexions?${new URLSearchParams({ fb: "error", reason })}`);
    };
    if (error) {
      // Annulation par la personne, ou refus de Facebook (autorisations de l'app non validées…) : message de Facebook
      if (errorReason === "user_denied") return res.redirect(`${env.clientUrl}/app/connexions?fb=denied`);
      return fail(`Facebook a refusé la connexion${errorDescription ? ` : « ${errorDescription} »` : ""}${errorReason ? ` (${errorReason})` : ""}.`);
    }
    if (!purpose?.startsWith("pages:") || !code) {
      const reason = "La demande de connexion à Facebook a expiré : relancez-la depuis Connexions.";
      return res.redirect(`${env.clientUrl}/app/connexions?${new URLSearchParams({ fb: "error", reason })}`);
    }
    const userId = purpose.slice("pages:".length);

    // Retour dans l'application dans tous les cas (le navigateur arrive ici depuis Facebook)
    let result: Awaited<ReturnType<typeof facebookService.handleCallback>>;
    try {
      result = await facebookService.handleCallback(code, userId);
    } catch (e) {
      if (!(e instanceof AppError)) console.error("❌ Connexion Facebook :", e);
      const reason = e instanceof AppError ? e.message : `Connexion à Facebook impossible : ${graphErrorMessage(e)}`;
      return fail(reason);
    }
    const { pages, instagram, missing, absent, limited } = result;
    const params = new URLSearchParams({ fb: "success", pages: String(pages), ig: String(instagram) });
    if (missing.length) params.set("missing", missing.join(","));
    if (absent.length) params.set("absent", absent.join("|"));
    if (limited.length) params.set("limited", limited.join("|"));
    res.redirect(`${env.clientUrl}/app/connexions?${params}`);
  }),

  posts: catchAsync(async (req: Request, res: Response) => {
    const data = await facebookService.getAggregatedPosts(req.user!.userId);
    res.json({ status: "success", data });
  }),

  insights: catchAsync(async (req: Request, res: Response) => {
    const data = await facebookService.getInsights(req.user!.userId);
    res.json({ status: "success", data });
  }),
  comments: catchAsync(async (req: Request, res: Response) => {
  const data = await facebookService.getComments(req.user!.userId, req.params.postId);
  res.json({ status: "success", data });
}),

aiReply: catchAsync(async (req: Request, res: Response) => {
  const reply = await facebookService.aiReplyToComment(
    req.user!.userId, req.params.postId, req.params.commentId
  );
  res.json({ status: "success", data: { reply } });
}),
};