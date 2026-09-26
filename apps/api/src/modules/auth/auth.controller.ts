import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { authService } from "./auth.service.js";
import { clientInfo, setSessionCookie } from "../../utils/session.js";

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const { user, token } = await authService.register(req.body, clientInfo(req));
    setSessionCookie(res, token);
    res.status(201).json({ status: "success", data: { user, token } });
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const { user, token } = await authService.login(req.body, clientInfo(req));
    setSessionCookie(res, token);
    res.json({ status: "success", data: { user, token } });
  }),

  logout: catchAsync(async (_req: Request, res: Response) => {
    res.clearCookie("token").json({ status: "success", message: "Déconnecté" });
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    res.json({ status: "success", message: "Si un compte existe, un e-mail a été envoyé." });
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ status: "success", message: "Mot de passe réinitialisé." });
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.userId);
    res.json({ status: "success", data: { user } });
  }),
};
