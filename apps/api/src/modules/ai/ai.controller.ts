import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { aiSettingsService } from "./ai.settings.js";
import { AppError } from "../../utils/AppError.js";
import { fetchSheetText } from "../schedules/import.fetch.js";
import { toSheetCsvUrl } from "../schedules/import.logic.js";

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
  // Texte brut (CSV) d'un Google Sheet partagé « avec le lien » : lecture protégée contre les adresses privées (SSRF)
  importSheet: catchAsync(async (req: Request, res: Response) => {
    let csvUrl: string;
    try {
      csvUrl = toSheetCsvUrl(req.body.url).url;
    } catch (e) {
      throw new AppError((e as Error).message, 422);
    }
    res.json({ status: "success", data: { csv: await fetchSheetText(csvUrl) } });
  }),
};
