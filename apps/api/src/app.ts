import express from "express";
import { UPLOADS_DIR } from "./modules/uploads/upload.service.js";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  // Conserve le corps brut : nécessaire pour vérifier la signature des webhooks Meta
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan("dev"));

  // Images des publications programmées : publiques (Instagram les télécharge), noms aléatoires
  app.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      maxAge: "30d",
      index: false,
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
    })
  );

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}