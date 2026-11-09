import "server-only";
import { admin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { deliver } from "./mailer";
import { renderEmailHtml, type Composed } from "./templates";

export type EmailKind =
  | "invite"
  | "submission_received"
  | "correction_request"
  | "decision_approved"
  | "decision_rejected"
  | "staff_vendor_submitted"
  | "staff_action_needed"
  | "teammate_invite"
  | "custom";

export interface EmailRow {
  id: string;
  vendor_id: string | null;
  submission_id: string | null;
  info_request_id: string | null;
  kind: EmailKind;
  audience: "vendor" | "staff";
  to_email: string;
  cc: string | null;
  subject: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  status: "draft" | "sending" | "sent" | "failed" | "discarded";
  generated_by: "system" | "agent" | "staff";
  error: string | null;
  provider_message_id: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
}

/** Records an email in the outbox. Nothing is sent until sendEmail() is called. */
export async function createEmail(e: {
  kind: EmailKind;
  audience: "vendor" | "staff";
  to: string;
  cc?: string | null;
  content: Composed;
  vendorId?: string | null;
  submissionId?: string | null;
  infoRequestId?: string | null;
  generatedBy?: "system" | "agent" | "staff";
  createdBy?: string | null;
}): Promise<EmailRow> {
  const { data, error } = await admin()
    .from("emails")
    .insert({
      kind: e.kind,
      audience: e.audience,
      to_email: e.to,
      cc: e.cc ?? null,
      subject: e.content.subject,
      body_text: e.content.body,
      cta_label: e.content.ctaLabel ?? null,
      cta_url: e.content.ctaUrl ?? null,
      vendor_id: e.vendorId ?? null,
      submission_id: e.submissionId ?? null,
      info_request_id: e.infoRequestId ?? null,
      generated_by: e.generatedBy ?? "system",
      created_by: e.createdBy ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not record email: ${error?.message}`);
  return data as EmailRow;
}

/**
 * Delivers an outbox email through Gmail SMTP and records the result. Never throws for a
 * delivery failure: the row is marked "failed" with the reason so it can be retried from the UI.
 */
export async function sendEmail(id: string, actor?: { id: string; email: string } | null): Promise<EmailRow> {
  const db = admin();
  const { data: claimed } = await db
    .from("emails")
    .update({ status: "sending", error: null })
    .eq("id", id)
    .in("status", ["draft", "failed"])
    .select("*")
    .single();
  if (!claimed) {
    const { data: current } = await db.from("emails").select("*").eq("id", id).single();
    if (!current) throw new Error("Email not found");
    return current as EmailRow;
  }
  const row = claimed as EmailRow;
  let replyTo: string | null = null;
  if (row.audience === "vendor" && row.vendor_id) {
    const { data: v } = await db.from("vendors").select("owner:profiles!vendors_owner_id_fkey(email)").eq("id", row.vendor_id).maybeSingle();
    const owner = (v?.owner as unknown as { email?: string } | null) ?? null;
    replyTo = owner?.email ?? null;
  }
  const html = renderEmailHtml({ subject: row.subject, body: row.body_text, ctaLabel: row.cta_label, ctaUrl: row.cta_url, brand: serverEnv.emailFromName() });
  const text = `${row.body_text}${row.cta_url ? `\n\n${row.cta_label ?? "Open"}: ${row.cta_url}` : ""}`;
  try {
    const r = await deliver({ to: row.to_email, cc: row.cc, subject: row.subject, html, text, replyTo });
    const { data } = await db
      .from("emails")
      .update({ status: "sent", provider_message_id: r.messageId, sent_at: new Date().toISOString(), attempts: row.attempts + 1, sent_by: actor?.id ?? null, error: null })
      .eq("id", id)
      .select("*")
      .single();
    await logEvent({ vendorId: row.vendor_id, submissionId: row.submission_id, actor: actor ? "staff" : "system", actorEmail: actor?.email, action: "email_sent", note: `${row.subject} → ${row.to_email}`, data: { email_id: id, kind: row.kind } });
    return data as EmailRow;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { data } = await db.from("emails").update({ status: "failed", error: message.slice(0, 500), attempts: row.attempts + 1 }).eq("id", id).select("*").single();
    await logEvent({ vendorId: row.vendor_id, submissionId: row.submission_id, actor: "system", action: "email_failed", note: `${row.subject} → ${row.to_email}: ${message.slice(0, 200)}`, data: { email_id: id, kind: row.kind } });
    return data as EmailRow;
  }
}

export async function createAndSend(e: Parameters<typeof createEmail>[0], actor?: { id: string; email: string } | null) {
  const row = await createEmail(e);
  return sendEmail(row.id, actor);
}
