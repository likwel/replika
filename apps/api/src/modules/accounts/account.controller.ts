import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { accountService } from "./account.service.js";

export const accountController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const data = await accountService.list(req.user!.userId);
    res.json({ status: "success", data });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const data = await accountService.create(req.user!.userId, req.body);
    res.status(201).json({ status: "success", data });
  }),

  toggle: catchAsync(async (req: Request, res: Response) => {
    const data = await accountService.toggle(req.user!.userId, req.params.id, req.body.isActive);
    res.json({ status: "success", data });
  }),

  check: catchAsync(async (req: Request, res: Response) => {
    const data = await accountService.check(req.user!.userId, req.params.id);
    res.json({ status: "success", data });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await accountService.remove(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
};