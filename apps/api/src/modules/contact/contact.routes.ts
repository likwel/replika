import { Router, type Request } from "express";
import { z } from "zod";
import { validate } from "../../middlewares/validate.middleware.js";
import { requireTurnstile } from "../../middlewares/turnstile.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { verifyToken } from "../../utils/jwt.js";
import { CONTACT_SUBJECTS, contactService, type ContactSubject } from "./contact.service.js";

// POST /api/contact : formulaire public « Nous contacter » (protégé par Cloudflare Turnstile)
const router = Router();

const text = (max: number, label: string) => z.string({ required_error: `${label} requis` }).trim().min(1, `${label} requis`).max(max, `${label} : ${max} caractères maximum`);
const contactSchema = z.object({
  name: text(100, "Nom"),
  email: z.string().trim().email("Adresse e-mail invalide").max(160),
  company: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  subject: z.enum(Object.keys(CONTACT_SUBJECTS) as [ContactSubject, ...ContactSubject[]]),
  message: z.string().trim().min(10, "Message trop court (10 caractères minimum)").max(4000, "Message : 4 000 caractères maximum"),
});

// Expéditeur connecté (facultatif) : rattaché au message pour le retrouver dans l'administration
function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : (req.cookies?.token as string | undefined);
  if (!token) return null;
  try {
    return verifyToken(token).userId;
  } catch {
    return null;
  }
}

router.post(
  "/",
  requireTurnstile,
  validate(contactSchema),
  catchAsync(async (req, res) => {
    const r = await contactService.submit(req.body, { ip: req.ip ?? null, userId: optionalUserId(req) });
    res.status(201).json({ status: "success", data: r });
  }),
);

export default router;
