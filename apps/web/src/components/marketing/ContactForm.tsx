import { useRef, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Loader2, Mail, Phone, Send, User } from "lucide-react";
import { theme } from "@/theme";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";
import { ApiError } from "@/lib/api";
import { CONTACT_SUBJECTS, contactApi, type ContactSubject } from "@/lib/contact.api";

interface Props {
  defaultSubject?: ContactSubject;
  prefill?: { name?: string; email?: string; company?: string | null };
  onSent?: () => void;
}

// Formulaire « Nous contacter » : page /contact et fenêtre dans l'application
export function ContactForm({ defaultSubject = "SALES", prefill, onSent }: Props) {
  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    email: prefill?.email ?? "",
    company: prefill?.company ?? "",
    phone: "",
    subject: defaultSubject,
    message: "",
  });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaOn, setCaptchaOn] = useState(true);
  const turnstile = useRef<TurnstileHandle>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.message.trim().length < 10) return setError("Décrivez votre demande en quelques mots (10 caractères minimum).");
    setSending(true);
    try {
      await contactApi.send({ ...form, company: form.company || undefined, phone: form.phone || undefined, turnstileToken: captcha });
      setSent(true);
      onSent?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Envoi impossible, réessayez.");
      turnstile.current?.reset();
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.greenSoft }}>
          <CheckCircle2 size={28} style={{ color: theme.green }} />
        </span>
        <p className="mt-4 text-[17px] font-semibold" style={{ color: theme.text }}>Message envoyé, merci !</p>
        <p className="mt-1 max-w-sm text-[13.5px]" style={{ color: theme.textMuted }}>
          Notre équipe vous répond sous 24 heures ouvrées à <strong style={{ color: theme.text }}>{form.email}</strong>. Un e-mail de confirmation vient de vous être envoyé.
        </p>
      </div>
    );
  }

  const input = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";
  const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field icon={User} label="Nom complet" name="name" autoComplete="name" placeholder="Votre nom" value={form.name} onChange={set("name")} required maxLength={100} />
        <Field icon={Mail} label="Adresse e-mail" type="email" name="email" autoComplete="email" placeholder="vous@exemple.com" value={form.email} onChange={set("email")} required />
        <Field icon={Building2} label="Entreprise (optionnel)" name="company" autoComplete="organization" placeholder="Nom de votre boutique ou agence" value={form.company} onChange={set("company")} maxLength={120} />
        <Field icon={Phone} label="Téléphone (optionnel)" type="tel" name="phone" autoComplete="tel" placeholder="034 00 000 00" value={form.phone} onChange={set("phone")} maxLength={40} />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Sujet</span>
        <select value={form.subject} onChange={set("subject")} className={input} style={inputStyle}>
          {(Object.keys(CONTACT_SUBJECTS) as ContactSubject[]).map((k) => (
            <option key={k} value={k}>{CONTACT_SUBJECTS[k]}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: theme.text }}>Message</span>
        <textarea
          rows={6}
          maxLength={4000}
          value={form.message}
          onChange={set("message")}
          required
          placeholder={form.subject === "AGENCY" ? "Nombre de marques ou de Pages gérées, volume de messages par mois, besoins particuliers…" : "Comment pouvons-nous vous aider ?"}
          className={input}
          style={inputStyle}
        />
        <span className="mt-1 block text-right text-[11px]" style={{ color: theme.textMuted }}>{form.message.length} / 4000</span>
      </label>
      <Turnstile ref={turnstile} onToken={setCaptcha} onEnabled={setCaptchaOn} />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full justify-center sm:w-fit" disabled={sending || (captchaOn && !captcha)}>
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {sending ? "Envoi…" : "Envoyer le message"}
      </Button>
    </form>
  );
}
