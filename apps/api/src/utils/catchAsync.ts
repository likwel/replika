import type { Request, Response, NextFunction, RequestHandler } from "express";

// Évite les try/catch répétés dans chaque controller
export const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };