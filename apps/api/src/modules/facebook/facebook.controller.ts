import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { facebookService } from "./facebook.service.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

export const facebookController = {
  // GET /api/facebook/connect → renvoie l'URL de consentement
  connect: catchAsync(async (req: Request, res: Response) => {
    const url = facebookService.buildAuthUrl(req.user!.userId);
    res.json({ status: "success", data: { url } });
  }),

  // GET /api/facebook/callback → Meta redirige ici
  callback: catchAsync(async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) return res.redirect(`${env.clientUrl}/app/connexions?fb=denied`);

    // Retour dans l'application dans tous les cas (le navigateur arrive ici depuis Facebook)
    let result: Awaited<ReturnType<typeof facebookService.handleCallback>>;
    try {
      result = await facebookService.handleCallback(code, state);
    } catch (e) {
      const reason = e instanceof AppError ? e.message : "Connexion à Facebook impossible, réessayez.";
      if (!(e instanceof AppError)) console.error("❌ Connexion Facebook :", e);
      return res.redirect(`${env.clientUrl}/app/connexions?${new URLSearchParams({ fb: "error", reason })}`);
    }
    const { pages, instagram, missing, absent } = result;
    const params = new URLSearchParams({ fb: "success", pages: String(pages), ig: String(instagram) });
    if (missing.length) params.set("missing", missing.join(","));
    if (absent.length) params.set("absent", absent.join("|"));
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