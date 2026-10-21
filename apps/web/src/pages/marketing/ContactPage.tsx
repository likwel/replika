import { useSearchParams } from "react-router-dom";
import { Clock, Mail, MapPin, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { LegalLayout } from "@/components/marketing/LegalLayout";
import { ContactForm } from "@/components/marketing/ContactForm";
import { useAuth } from "@/context/AuthContext";
import { CONTACT_EMAIL } from "@/data/plans";
import type { ContactSubject } from "@/lib/contact.api";

const FROM_PARAM: Record<string, ContactSubject> = { agence: "AGENCY", support: "SUPPORT", facturation: "BILLING", partenariat: "PARTNERSHIP" };

// Page publique « Nous contacter » (/contact, /contact?sujet=agence)
export function ContactPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const subject = FROM_PARAM[params.get("sujet") ?? ""] ?? "SALES";
  return (
    <LegalLayout
      title="Nous contacter"
      subtitle={subject === "AGENCY" ? "Parlez-nous de vos marques : nous préparons un devis Agence adapté à votre volume." : "Une question sur SuiteFlow, une formule ou votre compte ? Écrivez-nous."}
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl p-6 sm:p-8" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <ContactForm key={subject} defaultSubject={subject} prefill={{ name: user?.name, email: user?.email }} />
        </section>
        <aside className="flex flex-col gap-3">
          <Info icon={Clock} title="Réponse sous 24 h" text="Du lundi au vendredi, heures de Madagascar (UTC+3)." />
          <Info icon={Mail} title="Par e-mail" text={<a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: theme.goldDark }}>{CONTACT_EMAIL}</a>} />
          <Info icon={MapPin} title="Basés à Madagascar" text="Antananarivo — accompagnement en français et en malagasy." />
          <Info icon={MessageCircle} title="Déjà client ?" text="Indiquez l'e-mail de votre compte SuiteFlow : nous retrouvons vos Pages plus vite." />
        </aside>
      </div>
    </LegalLayout>
  );
}

function Info({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl p-4" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: theme.goldSoft }}>
        <Icon size={17} style={{ color: theme.goldDark }} />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold" style={{ color: theme.text }}>{title}</p>
        <p className="text-[13px]" style={{ color: theme.textMuted }}>{text}</p>
      </div>
    </div>
  );
}
