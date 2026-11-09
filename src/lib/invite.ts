import "server-only";
import { randomBytes } from "node:crypto";
import { admin } from "@/lib/supabase/admin";
import type { Staff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { createAndSend } from "@/lib/email/outbox";
import { compose } from "@/lib/email/templates";
import { newExpiry, vendorLink } from "@/lib/portal";
import { fmtDateLong } from "@/lib/dates";

/**
 * Creates (or refreshes) the vendor's onboarding submission and its secret magic link, and
 * optionally emails the invitation. Regenerating rotates the token so older links stop working.
 */
export async function issueLink(vendorId: string, staff: Staff, opts: { send: boolean; regenerate: boolean }) {
  const db = admin();
  const { data: v } = await db.from("vendors").select("*").eq("id", vendorId).single();
  if (!v) throw new Error("Vendor not found");
  let { data: sub } = await db.from("submissions").select("*").eq("vendor_id", vendorId).maybeSingle();
  const expires = newExpiry();

  if (!sub) {
    const prefill = {
      legal_name: v.company_name,
      contact_name: v.contact_name ?? "",
      contact_email: v.contact_email ?? "",
      contact_phone: v.contact_phone ?? "",
      city: v.city ?? "",
      supplies: v.supplies ?? "",
      ...(v.prefill ?? {}),
    };
    const { data, error } = await db
      .from("submissions")
      .insert({ vendor_id: vendorId, legal_name: v.company_name, contact_email: v.contact_email ?? "", country: "IN", status: "draft", current_version: 1, draft_data: prefill, link_expires_at: expires })
      .select("*")
      .single();
    if (error || !data) throw new Error(`Could not create onboarding link: ${error?.message}`);
    sub = data;
    await logEvent({ vendorId, submissionId: sub.id, actor: "staff", actorEmail: staff.email, action: "link_created", note: `Valid until ${fmtDateLong(expires)}` });
  } else {
    if (["approved", "rejected"].includes(sub.status)) throw new Error(`Vendor is already ${sub.status}`);
    const patch: Record<string, unknown> = { link_expires_at: expires };
    if (opts.regenerate) patch.access_token = randomBytes(24).toString("hex");
    const { data } = await db.from("submissions").update(patch).eq("id", sub.id).select("*").single();
    sub = data;
    await logEvent({ vendorId, submissionId: sub.id, actor: "staff", actorEmail: staff.email, action: opts.regenerate ? "link_regenerated" : "link_extended", note: `${opts.regenerate ? "Old link revoked. " : ""}Valid until ${fmtDateLong(expires)}` });
  }

  const url = vendorLink(sub.access_token);
  let email = null;
  if (opts.send) {
    if (!v.contact_email) throw new Error("Add a contact email to the vendor first");
    email = await createAndSend(
      {
        kind: "invite",
        audience: "vendor",
        to: v.contact_email,
        content: compose.invite({ contactName: v.contact_name, company: v.company_name, ownerName: staff.name, url, expires: fmtDateLong(expires) }),
        vendorId,
        submissionId: sub.id,
        generatedBy: "system",
        createdBy: staff.id,
      },
      staff,
    );
    if (email.status === "sent") await db.from("submissions").update({ link_sent_at: new Date().toISOString() }).eq("id", sub.id);
  }
  return { url, expires, email: email ? { id: email.id, status: email.status, error: email.error } : null };
}

