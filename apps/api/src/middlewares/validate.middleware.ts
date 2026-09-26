import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/AppError.js";

// Valide req.body contre un schéma Zod
export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      throw new AppError(msg, 422);
    }
    req.body = result.data;
    next();
  };