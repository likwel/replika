import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { sendMail } from "../mail/mail.service.js";

// Formulaire « Nous contacter » : enregistré en base, transmis à l'équipe par e-mail, accusé de réception à l'expéditeur

export const CONTACT_SUBJECTS = {
  AGENCY: "Formule Agence (devis)",
  SALES: "Question commerciale",
  SUPPORT: "Aide technique",
  BILLING: "Facturation et paiement",
  PARTNERSHIP: "Partenariat",
  OTHER: "Autre demande",
} as const;
export type ContactSubject = keyof typeof CONTACT_SUBJECTS;

export interface ContactInput {
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  subject: ContactSubject;
  message: string;
}

const MAX_PER_HOUR = 5;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Destinataires : CONTACT_EMAIL (.env), sinon les administrateurs, sinon l'adresse d'expédition
async function inbox(): Promise<string[]> {
  if (env.contactEmail) return env.contactEmail.split(",").map((s) => s.trim()).filter(Boolean);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", deletedAt: null }, select: { email: true } });
  if (admins.length) return admins.map((a) => a.email);
  return [env.mail.from.replace(/^.*<|>.*$/g, "")];
}

export const contactService = {
  async submit(input: ContactInput, ctx: { ip: string | null; userId?: string | null }) {
    if (ctx.ip) {
      const recent = await prisma.contactMessage.count({ where: { ip: ctx.ip, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
      if (recent >= MAX_PER_HOUR) throw new AppError("Vous avez déjà envoyé plusieurs messages : réessayez dans une heure.", 429);
    }
    const msg = await prisma.contactMessage.create({
      data: { ...input, company: input.company || null, phone: input.phone || null, ip: ctx.ip, userId: ctx.userId ?? null },
    });
    const label = CONTACT_SUBJECTS[input.subject];

    // Équipe : le message est enregistré même si l'e-mail échoue (visible dans Administration › Messages)
    const lines = [
      `De : ${input.name} <${input.email}>`,
      input.company ? `Entreprise : ${input.company}` : null,
      input.phone ? `Téléphone : ${input.phone}` : null,
      `Sujet : ${label}`,
      "",
      input.message,
    ].filter((l) => l !== null) as string[];
    const team = await inbox();
    let notified = true;
    try {
      await sendMail(
        team.join(", "),
        `[Contact SuiteFlow] ${label} — ${input.name}`,
        `${lines.join("\n")}\n\nRépondez directement à cet e-mail pour écrire à ${input.name}.`,
        `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;color:#111B21">
  <p style="font-size:13px;color:#54656F;margin:0 0 12px">Nouveau message depuis le formulaire « Nous contacter »</p>
  <table style="font-size:14px;margin-bottom:14px">
    <tr><td style="color:#54656F;padding:2px 12px 2px 0">De</td><td><strong>${esc(input.name)}</strong> &lt;${esc(input.email)}&gt;</td></tr>
    ${input.company ? `<tr><td style="color:#54656F;padding:2px 12px 2px 0">Entreprise</td><td>${esc(input.company)}</td></tr>` : ""}
    ${input.phone ? `<tr><td style="color:#54656F;padding:2px 12px 2px 0">Téléphone</td><td>${esc(input.phone)}</td></tr>` : ""}
    <tr><td style="color:#54656F;padding:2px 12px 2px 0">Sujet</td><td>${esc(label)}</td></tr>
  </table>
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;padding:14px;background:#F0F2F5;border-radius:10px">${esc(input.message)}</div>
  <p style="font-size:12px;color:#54656F;margin-top:14px">Répondez directement à cet e-mail pour écrire à ${esc(input.name)}.</p></div>`,
        { replyTo: `${input.name} <${input.email}>` },
      );
    } catch (e) {
      notified = false;
      console.error("❌ Contact : notification de l'équipe non envoyée :", (e as Error).message);
    }

    // Accusé de réception (sans bloquer si l'envoi échoue)
    await sendMail(
      input.email,
      "Nous avons bien reçu votre message — SuiteFlow",
      `Bonjour ${input.name},\n\nMerci pour votre message (${label}). Notre équipe vous répond sous 24 heures ouvrées.\n\nVotre message :\n${input.message}\n\nL'équipe SuiteFlow`,
      `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;color:#111B21">
  <p style="font-size:15px">Bonjour ${esc(input.name)},</p>
  <p style="font-size:15px">Merci pour votre message (<strong>${esc(label)}</strong>). Notre équipe vous répond sous 24 heures ouvrées.</p>
  <div style="white-space:pre-wrap;font-size:13px;color:#54656F;padding:12px;border-left:3px solid #00A884;background:#F7F8FA">${esc(input.message)}</div>
  <p style="font-size:13px;color:#54656F;margin-top:18px">L'équipe SuiteFlow</p></div>`,
    ).catch(() => {});

    return { id: msg.id, notified };
  },

  async list(q: { status?: "NEW" | "HANDLED"; page: number; pageSize: number }) {
    const where = q.status ? { status: q.status } : {};
    const [total, rows, unread] = await Promise.all([
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.contactMessage.count({ where: { status: "NEW" } }),
    ]);
    return { total, unread, page: q.page, pageSize: q.pageSize, messages: rows.map((m) => ({ ...m, subjectLabel: CONTACT_SUBJECTS[m.subject as ContactSubject] ?? m.subject, ip: undefined })) };
  },

  async setStatus(id: string, status: "NEW" | "HANDLED") {
    const m = await prisma.contactMessage.findUnique({ where: { id } });
    if (!m) throw new AppError("Message introuvable", 404);
    return prisma.contactMessage.update({ where: { id }, data: { status, handledAt: status === "HANDLED" ? new Date() : null } });
  },
};
