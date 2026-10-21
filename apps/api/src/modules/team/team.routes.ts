import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { MODULE_IDS, ROLE_PRESETS } from "./team.access.js";
import { teamService } from "./team.service.js";

// Équipe. Ces routes concernent toujours la personne connectée (jamais l'espace qu'elle a ouvert) :
// gestion de sa propre équipe, espaces rejoints, invitations reçues.
const router = Router();
const ok = (res: Response, data: unknown) => res.json({ status: "success", data });
const me = (req: Request) => req.user!.actorId;

// Aperçu d'une invitation reçue par e-mail (avant connexion)
router.get("/invitations/:token", catchAsync(async (req, res) => ok(res, await teamService.invitation(req.params.token))));

router.use(authenticate);

const permissions = z.object(Object.fromEntries(MODULE_IDS.map((m) => [m, z.enum(["read", "write"]).optional()])) as Record<string, z.ZodOptional<z.ZodEnum<["read", "write"]>>>);
const role = z.enum([...(Object.keys(ROLE_PRESETS) as [string, ...string[]]), "CUSTOM"]);

// ─── Mon équipe ──────────────────────────────────────────────────────────────
router.get("/", catchAsync(async (req, res) => ok(res, await teamService.overview(me(req)))));
router.post(
  "/members",
  validate(
    z.object({
      email: z.string().trim().email("Adresse e-mail invalide").max(200),
      name: z.string().trim().max(100).optional(),
      role,
      permissions,
    }),
  ),
  catchAsync(async (req, res) => ok(res, await teamService.invite(me(req), req.body))),
);
router.patch(
  "/members/:id",
  validate(z.object({ role: role.optional(), permissions: permissions.optional(), status: z.enum(["ACTIVE", "DISABLED"]).optional() })),
  catchAsync(async (req, res) => ok(res, await teamService.update(me(req), req.params.id, req.body))),
);
router.post("/members/:id/resend", catchAsync(async (req, res) => ok(res, await teamService.resend(me(req), req.params.id))));
router.delete("/members/:id", catchAsync(async (req, res) => ok(res, await teamService.remove(me(req), req.params.id))));

// ─── Espaces rejoints ────────────────────────────────────────────────────────
router.get("/memberships", catchAsync(async (req, res) => ok(res, await teamService.memberships(me(req)))));
router.post("/invitations/:token/accept", catchAsync(async (req, res) => ok(res, await teamService.accept(me(req), { token: req.params.token }))));
router.post("/memberships/:id/accept", catchAsync(async (req, res) => ok(res, await teamService.accept(me(req), { memberId: req.params.id }))));
router.post("/memberships/:id/decline", catchAsync(async (req, res) => ok(res, await teamService.decline(me(req), req.params.id))));
router.delete("/spaces/:ownerId", catchAsync(async (req, res) => ok(res, await teamService.leave(me(req), req.params.ownerId))));
router.post(
  "/switch",
  validate(z.object({ ownerId: z.string().min(1).nullable() })),
  catchAsync(async (req, res) => ok(res, await teamService.switchTo(me(req), req.body.ownerId))),
);

export default router;
