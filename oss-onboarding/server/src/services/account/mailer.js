import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transport;

// Sends through SMTP when SMTP_URL is set; otherwise prints the message so local demos work without a mail server.
export async function sendMail({ to, subject, text }) {
  if (!env.SMTP_URL) {
    console.log(`[mail] To: ${to}\n[mail] Subject: ${subject}\n[mail] ${text}`);
    return { delivered: false, logged: true };
  }
  transport ||= nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
  return { delivered: true };
}

export function verifyLink(token) {
  return `${env.CLIENT_ORIGIN}/verify-email?token=${token}`;
}

export function resetLink(token) {
  return `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;
}
