import { Router } from "express";
import { aiController } from "./ai.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { aiAccountSchema, aiTestSchema } from "./ai.schema.js";

const router = Router();
router.use(authenticate);

router.get("/", aiController.overview);
router.patch("/accounts/:id", validate(aiAccountSchema), aiController.updateAccount);
router.post("/test", validate(aiTestSchema), aiController.test);

export default router;
