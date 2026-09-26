import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { registerSchema, loginSchema, forgotSchema, resetSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", validate(forgotSchema), authController.forgotPassword);
router.post("/reset-password", validate(resetSchema), authController.resetPassword);
router.get("/me", authenticate, authController.me);

export default router;