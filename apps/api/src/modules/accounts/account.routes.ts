import { Router } from "express";
import { accountController } from "./account.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createAccountSchema } from "./account.schema.js";

const router = Router();
router.use(authenticate); // toutes les routes comptes nécessitent l'auth

router.get("/", accountController.list);
router.post("/", validate(createAccountSchema), accountController.create);
router.patch("/:id/toggle", accountController.toggle);
router.get("/:id/check", accountController.check);
router.delete("/:id", accountController.remove);

export default router;