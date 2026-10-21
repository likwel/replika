import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { startAutoReplyPoller } from "./modules/autoreply/autoreply.poller.js";
import { startScheduler } from "./modules/schedules/schedule.worker.js";
import { startLivePoller } from "./modules/lives/live.poller.js";
import { startBillingReconciler } from "./modules/billing/billing.worker.js";
import { isMailConfigured } from "./modules/mail/mail.service.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 API SuiteFlow sur http://localhost:${env.port}`);
});

const stopPoller = startAutoReplyPoller();
const stopScheduler = startScheduler();
const stopLivePoller = startLivePoller();
const stopBilling = startBillingReconciler();
console.log(
  isMailConfigured()
    ? `📧 E-mails : SMTP ${env.mail.host}:${env.mail.port}`
    : "📧 E-mails : aucun SMTP configuré (SMTP_HOST, SMTP_USER, SMTP_PASS) : les codes de validation s'affichent ici, dans ce terminal",
);
if (env.turnstile.incomplete) {
  console.warn("⚠️  Cloudflare Turnstile : TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY doivent être renseignées ensemble (clés de test utilisées en attendant).");
}

// Arrêt propre
async function shutdown() {
  console.log("\n⏳ Arrêt en cours...");
  stopPoller();
  stopScheduler();
  stopLivePoller();
  stopBilling();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
