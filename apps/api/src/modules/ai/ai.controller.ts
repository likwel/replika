import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { aiSettingsService } from "./ai.settings.js";

export const aiController = {
  overview: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await aiSettingsService.overview(req.user!.userId) });
  }),
  updateAccount: catchAsync(async (req: Request, res: Response) => {
    const data = await aiSettingsService.updateAccount(req.user!.userId, req.params.id, req.body);
    res.json({ status: "success", data });
  }),
  test: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await aiSettingsService.test(req.user!.userId, req.body) });
  }),
};
