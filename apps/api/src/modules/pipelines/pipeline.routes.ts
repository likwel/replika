import { Router } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { pipelineSchema, pipelineUpdateSchema } from "./pipeline.schema.js";
import { pipelineService } from "./pipeline.service.js";

const router = Router();
router.use(authenticate);

const ok = (data: unknown) => ({ status: "success", data });

router.get("/", catchAsync(async (req, res) => res.json(ok(await pipelineService.list(req.user!.userId)))));
router.get("/runs", catchAsync(async (req, res) => res.json(ok(await pipelineService.runs(req.user!.userId, typeof req.query.pipelineId === "string" ? req.query.pipelineId : undefined)))));
router.post("/", validate(pipelineSchema), catchAsync(async (req, res) => res.status(201).json(ok(await pipelineService.create(req.user!.userId, req.body)))));
router.patch("/:id", validate(pipelineUpdateSchema), catchAsync(async (req, res) => res.json(ok(await pipelineService.update(req.user!.userId, req.params.id, req.body)))));
router.delete(
  "/:id",
  catchAsync(async (req, res) => {
    await pipelineService.remove(req.user!.userId, req.params.id);
    res.status(204).send();
  })
);

export default router;
