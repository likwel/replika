import { api } from "./api";

export type ContactSubject = "AGENCY" | "SALES" | "SUPPORT" | "BILLING" | "PARTNERSHIP" | "OTHER";

export const CONTACT_SUBJECTS: Record<ContactSubject, string> = {
  AGENCY: "Formule Agence (devis)",
  SALES: "Question commerciale",
  SUPPORT: "Aide technique",
  BILLING: "Facturation et paiement",
  PARTNERSHIP: "Partenariat",
  OTHER: "Autre demande",
};

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  subject: ContactSubject;
  subjectLabel: string;
  message: string;
  status: "NEW" | "HANDLED";
  userId: string | null;
  handledAt: string | null;
  createdAt: string;
}

type Res<T> = { status: string; data: T };

export const contactApi = {
  send: (body: { name: string; email: string; company?: string; phone?: string; subject: ContactSubject; message: string; turnstileToken?: string | null }) =>
    api.post<Res<{ id: string; notified: boolean }>>("/contact", body).then((r) => r.data),
  // Administration
  list: (q: { status?: "NEW" | "HANDLED"; page?: number; pageSize?: number }) =>
    api
      .get<Res<{ total: number; unread: number; page: number; pageSize: number; messages: ContactMessage[] }>>(
        `/admin/contacts?${new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`,
      )
      .then((r) => r.data),
  setStatus: (id: string, status: "NEW" | "HANDLED") => api.patch<Res<ContactMessage>>(`/admin/contacts/${id}`, { status }).then((r) => r.data),
};
