import { after } from "next/server";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isToken, json } from "@/lib/api";
import { submissionDataSchema } from "@/lib/schema";
import { canEdit, draftVersion, loadByToken, vendorLink } from "@/lib/portal";
import { createRun, executeRun } from "@/lib/pipeline";
import { bankAccountKey, compact } from "@/lib/rules/validators";
import { createAndSend } from "@/lib/email/outbox";
import { compose } from "@/lib/email/templates";
import { logEvent } from "@/lib/events";

export const maxDuration = 300;

/**
 * Submits (or resubmits) the vendor form: snapshot a new version, start verification, confirm
 * receipt to the vendor and tell the owning salesperson. The run continues after the response.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v/[token]/submit">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const sub = await loadByToken(token);
    if (!sub) return fail("Not found", 404);
    const staff = await getStaff();
    if (!canEdit(sub, staff)) return fail(sub.status === "processing" ? "Your submission is already being checked." : "This form can no longer be submitted from this link.", 409);
    const { data } = z.object({ data: submissionDataSchema }).parse(await request.json());
    const db = admin();
    const version = draftVersion(sub);
    const resubmission = Boolean(sub.submitted_at);
    const now = new Date().toISOString();

    const { error: vErr } = await db.from("submission_versions").upsert({ submission_id: sub.id, version, data }, { onConflict: "submission_id,version" });
    if (vErr) throw new Error(vErr.message);
    const { error: sErr } = await db
      .from("submissions")
      .update({
        current_version: version,
        legal_name: data.legal_name,
        country: "IN",
        tax_id: compact(data.gstin),
        pan: compact(data.pan),
        bank_account: bankAccountKey(data.bank),
        contact_email: data.contact_email,
        submitted_at: now,
        draft_data: null,
        draft_saved_at: null,
        updated_at: now,
      })
      .eq("id", sub.id);
    if (sErr) throw new Error(sErr.message);

    const runId = await createRun(sub.id, version, resubmission ? "resubmission" : "submission");
    await logEvent({ vendorId: sub.vendor_id, submissionId: sub.id, runId, actor: staff ? "staff" : "vendor", actorEmail: staff?.email ?? data.contact_email, action: resubmission ? "resubmitted" : "submitted", note: `Version ${version}${staff ? " · submitted by staff on the vendor's behalf" : ""}` });

    const notify = async () => {
      // Confirmation to the vendor and a heads-up to the salesperson, alongside verification.
      await createAndSend({ kind: "submission_received", audience: "vendor", to: data.contact_email, content: compose.submissionReceived({ contactName: data.contact_name, company: data.legal_name, ref: sub.ref, url: vendorLink(token), resubmission }), vendorId: sub.vendor_id, submissionId: sub.id });
      if (sub.vendor_id) {
        const { data: v } = await db.from("vendors").select("owner:profiles!vendors_owner_id_fkey(email, full_name)").eq("id", sub.vendor_id).maybeSingle();
        const owner = (v?.owner as unknown as { email: string; full_name: string | null } | null) ?? null;
        if (owner?.email && owner.email !== staff?.email) {
          await createAndSend({ kind: "staff_vendor_submitted", audience: "staff", to: owner.email, content: compose.staffSubmitted({ staffName: owner.full_name || "there", company: data.legal_name, ref: sub.ref, resubmission, url: `${serverEnv.appUrl()}/runs/${runId}` }), vendorId: sub.vendor_id, submissionId: sub.id });
        }
        await db.from("vendors").update({ updated_at: now }).eq("id", sub.vendor_id);
      }
    };
    after(() => Promise.all([notify().catch((e) => console.error("notify failed", e)), executeRun(runId)]));
    return json({ runId, version }, 202);
  } catch (err) {
    return fromError(err);
  }
}
