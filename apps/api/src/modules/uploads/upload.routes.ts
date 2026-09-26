import express, { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { MAX_UPLOAD_BYTES, saveImage } from "./upload.service.js";

const router = Router();

// Corps binaire (Content-Type: image/jpeg…) : pas de base64, pas de limite JSON
router.post(
  "/",
  authenticate,
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_UPLOAD_BYTES }),
  catchAsync(async (req, res) => {
    const data = await saveImage(req.body, req.headers["content-type"]);
    res.status(201).json({ status: "success", data });
  })
);

export default router;
