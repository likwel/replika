import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

// Envoi d'e-mails (SMTP). Gmail : smtp.gmail.com, port 465, adresse Gmail et « mot de passe d'application ».
// Sans SMTP configuré : hors production, le message est affiché dans la console de l'API.

let transport: Transporter | null = null;

// Un serveur local de test (Mailpit, MailHog… sur localhost:1025) n'exige pas d'identifiants
const isLocalHost = () => /^(localhost|127\.0\.0\.1|::1|mailpit|mailhog|maildev)$/i.test(env.mail.host);
export const isMailConfigured = () => Boolean(env.mail.host && ((env.mail.user && env.mail.pass) || isLocalHost()));

// Cause lisible d'un échec SMTP
function mailFailure(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const where = `${env.mail.host}:${env.mail.port}`;
  if (err.code === "ECONNREFUSED") {
    return isLocalHost()
      ? `aucun serveur d'e-mail n'écoute sur ${where} : lancez Mailpit (docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit) ou utilisez un vrai SMTP`
      : `le serveur ${where} refuse la connexion`;
  }
  if (err.code === "ETIMEDOUT" || err.code === "ESOCKET" || err.code === "ECONNECTION" || err.code === "ENOTFOUND") return `serveur ${where} injoignable (vérifiez SMTP_HOST, SMTP_PORT, le pare-feu)`;
  if (err.code === "EAUTH") return "identifiants SMTP refusés (Gmail : utilisez un mot de passe d'application)";
  return err.message ?? "erreur inconnue";
}

// Transport Nodemailer (même réglage que factura.mg : TLS direct sur le port 465, STARTTLS sinon)
function transporter() {
  transport ??= nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user && env.mail.pass ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    // Serveur de test local : pas de certificat valide
    tls: isLocalHost() ? { rejectUnauthorized: false } : undefined,
  });
  return transport;
}

export const mailDelivery = (): "email" | "console" => (isMailConfigured() ? "email" : "console");

export function mailStatus() {
  return { configured: isMailConfigured(), host: env.mail.host || null, from: env.mail.from, user: env.mail.user ? env.mail.user.replace(/^(.).*(@.*)$/, "$1***$2") : null };
}

// Test depuis l'administration : renvoie l'erreur SMTP exacte (identifiants refusés, port bloqué…)
export async function sendTestMail(to: string) {
  if (!isMailConfigured()) return { delivered: false, error: "Aucun serveur SMTP configuré : renseignez SMTP_HOST, SMTP_USER et SMTP_PASS dans apps/api/.env, puis redémarrez l'API." };
  try {
    await transporter().verify();
    await transporter().sendMail({
      from: env.mail.from,
      to,
      subject: "Test d'envoi SuiteFlow",
      text: "Cet e-mail confirme que SuiteFlow peut envoyer des messages (codes de validation en deux étapes).",
      html: '<p style="font-family:Inter,Arial,sans-serif">Cet e-mail confirme que SuiteFlow peut envoyer des messages (codes de validation en deux étapes).</p>',
    });
    return { delivered: true, error: null };
  } catch (e) {
    return { delivered: false, error: `Échec : ${mailFailure(e)}.` };
  }
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
    const cause = mailFailure(e);
    console.error(`❌ E-mail vers ${to} : ${cause}`);
    // En production, la cause technique reste dans les journaux
    throw new AppError(`L'e-mail n'a pas pu être envoyé${env.isProd ? ", réessayez dans un instant." : ` : ${cause}.`}`, 502, "MAIL_FAILED");
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
