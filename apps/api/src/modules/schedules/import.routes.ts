import { Router, type Request, type Response } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { commitSchema, previewSchema, sourcePatchSchema } from "./import.schema.js";
import { importService } from "./import.service.js";

// Import de publications depuis un tableur (monté dans schedule.routes.ts, après authenticate et avant /:id)
const router = Router();
const uid = (req: Request) => req.user!.userId;
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ status: "success", data });

router.get("/import/template", catchAsync(async (req: Request, res: Response) => ok(res, await importService.template(uid(req)))));

router.post("/import/preview", validate(previewSchema), catchAsync(async (req: Request, res: Response) => ok(res, await importService.preview(uid(req), req.body))));
router.post("/import/commit", validate(commitSchema), catchAsync(async (req: Request, res: Response) => ok(res, await importService.commit(uid(req), req.body), 201)));

router.get("/sources", catchAsync(async (req: Request, res: Response) => ok(res, await importService.listSources(uid(req)))));
router.patch(
  "/sources/:id",
  validate(sourcePatchSchema),
  catchAsync(async (req: Request, res: Response) => ok(res, await importService.updateSource(uid(req), req.params.id, req.body)))
);
router.delete(
  "/sources/:id",
  catchAsync(async (req: Request, res: Response) => {
    await importService.removeSource(uid(req), req.params.id);
    res.status(204).send();
  })
);
router.post(
  "/sources/:id/sync",
  catchAsync(async (req: Request, res: Response) => {
    if (!req.params.id) throw new AppError("Source introuvable", 404);
    ok(res, await importService.sync(uid(req), req.params.id));
  })
);

export default router;
