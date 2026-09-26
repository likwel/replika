import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { isValidSignature, processWebhook } from "./webhook.service.js";

export const webhookController = {
  // GET /api/webhooks/meta → vérification de l'abonnement par Meta
  verify(req: Request, res: Response) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && env.fb.webhookVerifyToken && token === env.fb.webhookVerifyToken) {
      return res.status(200).send(String(challenge));
    }
    return res.sendStatus(403);
  },

  // POST /api/webhooks/meta → notifications (commentaires, messages)
  receive(req: Request, res: Response) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!isValidSignature(rawBody, req.header("x-hub-signature-256"))) {
      return res.sendStatus(401);
    }

    // Meta attend un 200 rapide : le traitement (appels Graph) se fait ensuite
    res.sendStatus(200);
    processWebhook(req.body).catch((e) => console.error("❌ Webhook Meta :", e));
  },
};
