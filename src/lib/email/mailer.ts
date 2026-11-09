import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { serverEnv } from "@/lib/env";

let transporter: Transporter | null = null;

export function emailConfigured() {
  return Boolean(serverEnv.gmailUser() && serverEnv.gmailPassword());
}

function transport() {
  transporter ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: serverEnv.gmailUser(), pass: serverEnv.gmailPassword() },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

/** Hands the message to Gmail SMTP. Resolves only when Gmail has accepted it for delivery. */
export async function deliver(msg: { to: string; cc?: string | null; subject: string; html: string; text: string; replyTo?: string | null }) {
  if (!emailConfigured()) throw new Error("Email is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD.");
  const info = await transport().sendMail({
    from: { name: serverEnv.emailFromName(), address: serverEnv.gmailUser() },
    to: msg.to,
    cc: msg.cc || undefined,
    replyTo: msg.replyTo || undefined,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
  if (info.rejected?.length) throw new Error(`Rejected by Gmail for: ${info.rejected.join(", ")}`);
  return { messageId: info.messageId, response: info.response };
}
