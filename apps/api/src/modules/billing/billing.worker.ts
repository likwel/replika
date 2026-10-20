import { env } from "../../config/env.js";
import { billingService, notificationUrl } from "./billing.service.js";
import { isPapiConfigured } from "./papi.client.js";

// Vérifie auprès de Papi les paiements en attente : indispensable quand la notification
// ne peut pas arriver (API sans adresse publique en développement, panne réseau)
export function startBillingReconciler() {
  if (!isPapiConfigured()) {
    console.log("💳 Papi : clés PAPI_API_KEY / PAPI_SECRET_KEY absentes, paiement en ligne désactivé");
    return () => {};
  }
  if (!notificationUrl()) {
    console.log("💳 Papi : PUBLIC_API_URL locale, notifications de paiement injoignables → confirmation par vérification du statut");
  }
  if (env.billingReconcileSeconds <= 0) return () => {};

  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await billingService.reconcilePending();
    } catch (e) {
      console.error("❌ Paiements :", e);
    } finally {
      busy = false;
    }
  }, env.billingReconcileSeconds * 1000);
  console.log(`💳 Papi${env.papi.testMode ? " (mode test)" : ""} : paiements en attente vérifiés toutes les ${env.billingReconcileSeconds} s`);
  return () => clearInterval(timer);
}
