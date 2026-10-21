import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

// Envoi d'e-mails (SMTP). Gmail : smtp.gmail.com, port 465, adresse Gmail et « mot de passe d'application ».
// Sans SMTP configuré : hors production, le message est affiché dans la console de l'API.

let transport: Transporter | null = null;

export const isMailConfigured = () => Boolean(env.mail.host && env.mail.user && env.mail.pass);

function transporter() {
  transport ??= nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: { user: env.mail.user, pass: env.mail.pass },
  });
  return transport;
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!isMailConfigured()) {
    if (env.isProd) throw new AppError("Envoi d'e-mails non configuré sur le serveur (SMTP_HOST, SMTP_USER, SMTP_PASS).", 503, "MAIL_NOT_CONFIGURED");
    console.log(`\n📧 [dev, SMTP non configuré] À : ${to}\n   Objet : ${subject}\n   ${text.replace(/\n/g, "\n   ")}\n`);
    return;
  }
  try {
    await transporter().sendMail({ from: env.mail.from, to, subject, text, html });
  } catch (e) {
    console.error("❌ E-mail :", (e as Error).message);
    throw new AppError("L'e-mail n'a pas pu être envoyé, réessayez dans un instant.", 502, "MAIL_FAILED");
  }
}

// Code de validation en deux étapes
export function sendTwoFactorCode(to: string, name: string, code: string, purpose: "LOGIN" | "SETUP_EMAIL") {
  const intro = purpose === "LOGIN" ? "Voici votre code pour vous connecter à SuiteFlow :" : "Voici le code pour activer la validation en deux étapes par e-mail :";
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const text = `Bonjour ${name},\n\n${intro}\n\n${spaced}\n\nIl expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe.\n\nL'équipe SuiteFlow`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#111B21">
  <p style="font-size:15px;margin:0 0 6px">Bonjour ${escapeHtml(name)},</p>
  <p style="font-size:15px;margin:0 0 18px">${intro}</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:0 0 18px;padding:14px 0;text-align:center;background:#E2F5EE;border-radius:12px;color:#006D59">${spaced}</p>
  <p style="font-size:13px;color:#54656F;margin:0 0 4px">Il expire dans 10 minutes.</p>
  <p style="font-size:13px;color:#54656F;margin:0">Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe.</p>
  <p style="font-size:13px;color:#54656F;margin:22px 0 0">L'équipe SuiteFlow</p></div>`;
  return sendMail(to, `${spaced} : votre code SuiteFlow`, text, html);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
