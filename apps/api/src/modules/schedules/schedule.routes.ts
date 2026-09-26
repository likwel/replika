import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { listQuerySchema, scheduleSchema } from "./schedule.schema.js";
import { scheduleService } from "./schedule.service.js";

// Planification : publications, commentaires et messages privés programmés
const router = Router();
router.use(authenticate);

const uid = (req: Request) => req.user!.userId;

router.get(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) throw new AppError("Filtre invalide", 422);
    res.json({ status: "success", data: await scheduleService.list(uid(req), q.data) });
  })
);

router.post(
  "/",
  validate(scheduleSchema),
  catchAsync(async (req: Request, res: Response) => {
    res.status(201).json({ status: "success", data: await scheduleService.create(uid(req), req.body) });
  })
);

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await scheduleService.get(uid(req), req.params.id) });
  })
);

router.put(
  "/:id",
  validate(scheduleSchema),
  catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await scheduleService.update(uid(req), req.params.id, req.body) });
  })
);

router.post(
  "/:id/publish",
  catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await scheduleService.publishNow(uid(req), req.params.id) });
  })
);

router.delete(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    await scheduleService.remove(uid(req), req.params.id);
    res.status(204).send();
  })
);

export default router;
