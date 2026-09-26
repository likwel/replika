import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { messageService } from "./message.service.js";
import { listQuerySchema } from "./message.schema.js";

export const messageController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) throw new AppError("Filtre invalide", 422);
    const data = await messageService.list(req.user!.userId, query.data);
    res.json({ status: "success", data });
  }),

  reply: catchAsync(async (req: Request, res: Response) => {
    const data = await messageService.reply(req.user!.userId, req.params.id, req.body.reply);
    res.json({ status: "success", data });
  }),

  aiSuggest: catchAsync(async (req: Request, res: Response) => {
    const data = await messageService.aiSuggest(req.user!.userId, req.params.id);
    res.json({ status: "success", data });
  }),

  escalate: catchAsync(async (req: Request, res: Response) => {
    const data = await messageService.escalate(req.user!.userId, req.params.id);
    res.json({ status: "success", data });
  }),

  ignore: catchAsync(async (req: Request, res: Response) => {
    const data = await messageService.ignore(req.user!.userId, req.params.id);
    res.json({ status: "success", data });
  }),
};
