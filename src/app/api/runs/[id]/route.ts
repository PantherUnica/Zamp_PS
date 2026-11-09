import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";

/** Live run state for the run view (polled while the run executes). */
export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  try {
    if (!(await getStaff())) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const db = admin();
    const { data: run } = await db
      .from("runs")
      .select("id, submission_id, version, trigger, status, recommendation, result, error, model, created_at, started_at, finished_at")
      .eq("id", id)
      .single();
    if (!run) return fail("Run not found", 404);
    const [{ data: stages }, { data: sub }] = await Promise.all([
      db.from("run_stages").select("key, label, position, status, summary, output, error, started_at, finished_at").eq("run_id", id).order("position"),
      db.from("submissions").select("id, ref, legal_name, status, recommendation, vendor_id").eq("id", run.submission_id).single(),
    ]);
    return json({ run, stages: stages ?? [], submission: sub });
  } catch (err) {
    return fromError(err);
  }
}
