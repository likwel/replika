import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { clientInfo, setSessionCookie } from "../../utils/session.js";
import { profileService } from "./profile.service.js";

export const profileController = {
  get: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await profileService.get(req.user!.userId) });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await profileService.update(req.user!.userId, req.body) });
  }),

  changeEmail: catchAsync(async (req: Request, res: Response) => {
    const data = await profileService.changeEmail(req.user!.userId, req.body, clientInfo(req));
    res.json({ status: "success", data });
  }),

  changePassword: catchAsync(async (req: Request, res: Response) => {
    const token = await profileService.changePassword(req.user!.userId, req.body, clientInfo(req));
    setSessionCookie(res, token); // la session courante reste ouverte, les autres sont fermées
    res.json({ status: "success", message: "Mot de passe modifié. Les autres appareils ont été déconnectés." });
  }),

  logoutOthers: catchAsync(async (req: Request, res: Response) => {
    const token = await profileService.logoutOthers(req.user!.userId, clientInfo(req));
    setSessionCookie(res, token);
    res.json({ status: "success", message: "Les autres appareils ont été déconnectés." });
  }),

  updatePreferences: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await profileService.updatePreferences(req.user!.userId, req.body) });
  }),

  activity: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await profileService.activity(req.user!.userId) });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await profileService.remove(req.user!.userId, req.body.password);
    res.clearCookie("token").status(204).send();
  }),
};
