import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { startAutoReplyPoller } from "./modules/autoreply/autoreply.poller.js";
import { startScheduler } from "./modules/schedules/schedule.worker.js";
import { startLivePoller } from "./modules/lives/live.poller.js";
import { startBillingReconciler } from "./modules/billing/billing.worker.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 API SuiteFlow sur http://localhost:${env.port}`);
});

const stopPoller = startAutoReplyPoller();
const stopScheduler = startScheduler();
const stopLivePoller = startLivePoller();
const stopBilling = startBillingReconciler();

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
