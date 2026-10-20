import type { Request, Response, NextFunction } from "express";
import { featureError, getEntitlements, inactiveError } from "../modules/billing/entitlements.js";
import type { Feature } from "../modules/billing/plans.js";

// Module réservé à certaines formules (après authenticate).
// Abonnement expiré : lecture seule (les données restent consultables, les modifications sont refusées).
export function requirePlanFeature(feature: Feature) {
  return (req: Request, _res: Response, next: NextFunction) => {
    getEntitlements(req.user!.userId)
      .then((ent) => {
        if (!ent.features[feature]) return next(featureError(feature));
        if (!ent.active && req.method !== "GET") return next(inactiveError(ent));
        next();
      })
      .catch(next);
  };
}
