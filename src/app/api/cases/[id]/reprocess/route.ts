import { after } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { getReviewer } from "@/lib/auth";
import { createRun, executeRun } from "@/lib/pipeline";
import { fail, fromError, json } from "@/lib/api";

export const maxDuration = 300;

/** Re-runs processing on the current version (e.g. after an AI/API outage). */
export async function POST(_req: Request, ctx: RouteContext<"/api/cases/[id]/reprocess">) {
  try {
    const reviewer = await getReviewer();
    if (!reviewer) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    const db = admin();
    const { data: sub } = await db.from("submissions").select("id, status, current_version").eq("id", id).single();
    if (!sub) return fail("Case not found", 404);
    if (["approved", "rejected", "processing"].includes(sub.status)) return fail(`Cannot re-run a case that is ${sub.status}`, 409);
    const runId = await createRun(sub.id, sub.current_version, "reprocess");
    await db.from("events").insert({ submission_id: sub.id, run_id: runId, actor_type: "reviewer", actor_email: reviewer.email, action: "reprocessed" });
    after(() => executeRun(runId));
    return json({ runId }, 202);
  } catch (err) {
    return fromError(err);
  }
}
