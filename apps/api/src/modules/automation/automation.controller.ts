import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { automationService } from "./automation.service.js";

export const automationController = {
  list: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await automationService.list(req.user!.userId) });
  }),
  create: catchAsync(async (req: Request, res: Response) => {
    res.status(201).json({ status: "success", data: await automationService.create(req.user!.userId, req.body) });
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await automationService.update(req.user!.userId, req.params.id, req.body) });
  }),
  remove: catchAsync(async (req: Request, res: Response) => {
    await automationService.remove(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
  getSettings: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await automationService.getSettings(req.user!.userId) });
  }),
  updateSettings: catchAsync(async (req: Request, res: Response) => {
    const data = await automationService.updateSettings(req.user!.userId, req.body.autoReplyEnabled);
    res.json({ status: "success", data });
  }),
  sync: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await automationService.sync(req.user!.userId) });
  }),
  test: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await automationService.test(req.user!.userId, req.body) });
  }),
};
