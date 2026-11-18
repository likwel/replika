import { Router } from "express";
import { aiController } from "./ai.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { aiAccountSchema, aiSheetSchema, aiTestSchema } from "./ai.schema.js";

const router = Router();
router.use(authenticate);

router.get("/", aiController.overview);
router.patch("/accounts/:id", validate(aiAccountSchema), aiController.updateAccount);
router.post("/test", validate(aiTestSchema), aiController.test);
router.post("/import-sheet", validate(aiSheetSchema), aiController.importSheet);

export default router;
