import { Router } from "express";
import { profileController } from "./profile.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  deleteSchema,
  emailSchema,
  passwordSchema,
  preferencesSchema,
  profileSchema,
} from "./profile.schema.js";

const router = Router();
router.use(authenticate);

router.get("/", profileController.get);
router.patch("/", validate(profileSchema), profileController.update);
router.patch("/email", validate(emailSchema), profileController.changeEmail);
router.patch("/password", validate(passwordSchema), profileController.changePassword);
router.post("/logout-others", profileController.logoutOthers);
router.patch("/preferences", validate(preferencesSchema), profileController.updatePreferences);
router.get("/activity", profileController.activity);
router.delete("/", validate(deleteSchema), profileController.remove);

export default router;
