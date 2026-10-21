import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import type { ContactSubject } from "@/lib/contact.api";
import { ContactForm } from "./ContactForm";

// « Nous contacter » depuis l'application : nom et e-mail du compte préremplis
export function ContactDialog({ subject = "SALES", title = "Nous contacter", onClose }: { subject?: ContactSubject; title?: string; onClose: () => void }) {
  const { user } = useAuth();
  return (
    <Modal title={title} subtitle="Notre équipe vous répond sous 24 heures ouvrées." onClose={onClose} size="lg">
      <ContactForm defaultSubject={subject} prefill={{ name: user?.name, email: user?.email }} />
    </Modal>
  );
}
