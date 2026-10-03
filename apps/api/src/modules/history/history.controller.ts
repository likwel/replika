import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { historyService } from "./history.service.js";
import { listQuerySchema } from "./history.schema.js";

export const historyController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError("Filtre invalide", 422);
    const data = await historyService.list(req.user!.userId, query.data);
    res.json({ status: "success", data });
  }),

  counts: catchAsync(async (req: Request, res: Response) => {
    const data = await historyService.counts(req.user!.userId);
    res.json({ status: "success", data });
  }),
};
