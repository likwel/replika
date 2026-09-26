import { Router } from "express";
import { automationController } from "./automation.controller.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { diagnose } from "./automation.diagnostic.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ruleSchema, ruleUpdateSchema, settingsSchema, testSchema } from "./automation.schema.js";

const router = Router();
router.use(authenticate);

router.get("/settings", automationController.getSettings);
router.patch("/settings", validate(settingsSchema), automationController.updateSettings);
router.post("/sync", automationController.sync);
// État réel de l'automatisation, compte par compte
router.get(
  "/diagnostic",
  catchAsync(async (req, res) => res.json({ status: "success", data: await diagnose(req.user!.userId) }))
);
router.post("/test", validate(testSchema), automationController.test);

router.get("/", automationController.list);
router.post("/", validate(ruleSchema), automationController.create);
router.patch("/:id", validate(ruleUpdateSchema), automationController.update);
router.delete("/:id", automationController.remove);

export default router;
