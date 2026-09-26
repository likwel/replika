import type { Request, Response } from "express";

export function notFound(req: Request, res: Response) {
  res.status(404).json({ status: "error", message: `Route introuvable : ${req.originalUrl}` });
}