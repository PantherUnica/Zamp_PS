import { after } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { createRun, executeRun } from "@/lib/pipeline";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { logEvent } from "@/lib/events";

export const maxDuration = 300;

/** Re-runs verification on the latest submitted version (e.g. after an AI or network outage). */
export async function POST(_req: Request, ctx: RouteContext<"/api/vendors/[id]/reprocess">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const db = admin();
    const { data: sub } = await db.from("submissions").select("id, status, current_version, submitted_at").eq("vendor_id", id).maybeSingle();
    if (!sub?.submitted_at) return fail("Nothing has been submitted yet", 409);
    if (["approved", "rejected", "processing"].includes(sub.status)) return fail(`Cannot re-run a vendor that is ${sub.status}`, 409);
    const runId = await createRun(sub.id, sub.current_version, "reprocess");
    await logEvent({ vendorId: id, submissionId: sub.id, runId, actor: "staff", actorEmail: staff.email, action: "reprocessed" });
    after(() => executeRun(runId));
    return json({ runId }, 202);
  } catch (err) {
    return fromError(err);
  }
}
