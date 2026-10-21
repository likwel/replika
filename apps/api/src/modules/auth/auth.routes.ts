import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { registerSchema, loginSchema, forgotSchema, resetSchema } from "./auth.schema.js";
import { requireTurnstile } from "../../middlewares/turnstile.middleware.js";
import twoFactorRoutes from "./twoFactor.routes.js";
import { z } from "zod";

const router = Router();

// Cloudflare Turnstile (anti-robot) avant toute vérification de mot de passe ou création de compte
router.post("/register", requireTurnstile, validate(registerSchema), authController.register);
router.post("/login", requireTurnstile, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", requireTurnstile, validate(forgotSchema), authController.forgotPassword);
router.get("/config", authController.config);

// Validation en deux étapes : seconde étape de la connexion (sans session), puis réglages
const challenge = z.object({ challengeId: z.string().min(10, "Vérification invalide") });
router.post(
  "/2fa/verify",
  validate(challenge.extend({ code: z.string({ required_error: "Code requis" }).trim().min(6, "Code incomplet").max(20) })),
  authController.verifyTwoFactor,
);
router.post("/2fa/resend", validate(challenge), authController.resendTwoFactor);
router.use("/2fa", twoFactorRoutes);
router.post("/reset-password", validate(resetSchema), authController.resetPassword);
router.get("/me", authenticate, authController.me);

// Connexion / inscription via Facebook ou Google
router.get("/providers", authController.providers);
router.get("/:provider(facebook|google)", authController.socialStart);
router.get("/:provider(facebook|google)/callback", authController.socialCallback);

export default router;