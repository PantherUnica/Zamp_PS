import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { sendEmail } from "@/lib/email/outbox";
import { logEvent } from "@/lib/events";

/**
 * Sends (or retries) an outbox email as the signed-in staff member. Sending a correction request
 * opens the matching request for the vendor and moves the case back to "waiting on vendor".
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/emails/[id]/send">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const db = admin();
    const { data: before } = await db.from("emails").select("status, kind, generated_by").eq("id", id).maybeSingle();
    if (!before) return fail("Not found", 404);
    if (!["draft", "failed"].includes(before.status)) return fail(`This email is already ${before.status}`, 409);
    const row = await sendEmail(id, staff);
    if (row.status === "sent" && row.kind === "correction_request" && row.submission_id) {
      const now = new Date().toISOString();
      if (row.info_request_id) {
        await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", row.submission_id).eq("status", "open").neq("id", row.info_request_id);
        await db.from("info_requests").update({ status: "open" }).eq("id", row.info_request_id);
      }
      await db.from("submissions").update({ status: "awaiting_vendor", updated_at: now }).eq("id", row.submission_id).not("status", "in", "(approved,rejected,processing)");
      await logEvent({ vendorId: row.vendor_id, submissionId: row.submission_id, actor: "staff", actorEmail: staff.email, action: "info_requested", note: `${before.generated_by === "agent" ? "Agent-drafted" : "Staff"} correction email reviewed and sent` });
    }
    return json({ status: row.status, error: row.error });
  } catch (err) {
    return fromError(err);
  }
}
