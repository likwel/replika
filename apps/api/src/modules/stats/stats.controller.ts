import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { statsService } from "./stats.service.js";
import { daysQuerySchema } from "./stats.schema.js";

export const statsController = {
  overview: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await statsService.overview(req.user!.userId) });
  }),

  engagement: catchAsync(async (req: Request, res: Response) => {
    const query = daysQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError("Période invalide", 422);
    const data = await statsService.engagement(req.user!.userId, query.data.days);
    res.json({ status: "success", data });
  }),

  accounts: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await statsService.accounts(req.user!.userId) });
  }),

  rules: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await statsService.rules(req.user!.userId) });
  }),
};
