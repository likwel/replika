import { Terminal } from "lucide-react";
import { Alert } from "@/components/ui/Alert";

// Aucun serveur d'e-mail configuré : le code n'est pas envoyé, il s'affiche dans le terminal de l'API (dev)
export function MailDeliveryNotice({ delivery }: { delivery?: "email" | "console" | null }) {
  if (delivery !== "console") return null;
  return (
    <Alert variant="warning" icon={Terminal}>
      <strong>Aucun e-mail n'est envoyé :</strong> le serveur d'e-mail (SMTP) n'est pas configuré. En développement, le code
      s'affiche dans le terminal où tourne <code>npm run dev</code> (ligne « 📧 »). Pour recevoir les e-mails, renseignez
      SMTP_HOST, SMTP_USER et SMTP_PASS (mot de passe d'application Gmail) dans <code>apps/api/.env</code> puis redémarrez l'API.
    </Alert>
  );
}
