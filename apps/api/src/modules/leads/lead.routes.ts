import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { leadService } from "./lead.service.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null));

const updateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  note: optionalText(2000),
  value: z.number().int().min(0).max(1_000_000_000).nullish(),
  phone: optionalText(40),
  email: optionalText(120),
  name: z.string().trim().min(1).max(120).optional(),
});
const messageSchema = z.object({ text: z.string().trim().min(1, "Message vide").max(2000, "2 000 caractères maximum") });

// Leads : clients potentiels détectés automatiquement
const router = Router();
router.use(authenticate);

const uid = (req: Request) => req.user!.userId;
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const ok = (res: Response, data: unknown) => res.json({ status: "success", data });

router.get(
  "/",
  catchAsync(async (req, res) =>
    ok(
      res,
      await leadService.list(uid(req), {
        status: str(req.query.status)?.split(","),
        temperature: str(req.query.temperature),
        accountId: str(req.query.accountId),
        search: str(req.query.q),
        sort: str(req.query.sort),
      })
    )
  )
);
router.get("/stats", catchAsync(async (req, res) => ok(res, await leadService.stats(uid(req)))));
router.post("/rescan", catchAsync(async (req, res) => ok(res, await leadService.rescan(uid(req)))));
router.get("/:id", catchAsync(async (req, res) => ok(res, await leadService.get(uid(req), req.params.id))));
router.patch("/:id", validate(updateSchema), catchAsync(async (req, res) => ok(res, await leadService.update(uid(req), req.params.id, req.body))));
router.post("/:id/message", validate(messageSchema), catchAsync(async (req, res) => ok(res, await leadService.message(uid(req), req.params.id, req.body.text))));
router.delete(
  "/:id",
  catchAsync(async (req, res) => {
    await leadService.remove(uid(req), req.params.id);
    res.status(204).send();
  })
);

export default router;
