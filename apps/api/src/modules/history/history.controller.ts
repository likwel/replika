import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { historyService } from "./history.service.js";

export const historyController = {
  list: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await historyService.list(req.user!.userId) });
  }),
};