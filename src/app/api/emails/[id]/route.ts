import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { logEvent } from "@/lib/events";

const patch = z.object({
  subject: z.string().trim().min(3, "Subject is required").max(200),
  body_text: z.string().trim().min(10, "Message is too short").max(10_000),
});

/** Staff edit a draft before sending. Sent emails are immutable. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/emails/[id]">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const b = patch.parse(await request.json());
    const db = admin();
    const { data, error } = await db.from("emails").update(b).eq("id", id).in("status", ["draft", "failed"]).select("id, vendor_id, generated_by").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail("Only drafts and failed emails can be edited", 409);
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}

/** Discard a draft (kept in the database with status "discarded" for the audit trail). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/emails/[id]">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const db = admin();
    const { data } = await db.from("emails").update({ status: "discarded" }).eq("id", id).in("status", ["draft", "failed"]).select("vendor_id, submission_id, info_request_id, subject").maybeSingle();
    if (!data) return fail("Only drafts and failed emails can be discarded", 409);
    if (data.info_request_id) await db.from("info_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", data.info_request_id).eq("status", "draft");
    await logEvent({ vendorId: data.vendor_id, submissionId: data.submission_id, actor: "staff", actorEmail: staff.email, action: "email_discarded", note: data.subject });
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}
