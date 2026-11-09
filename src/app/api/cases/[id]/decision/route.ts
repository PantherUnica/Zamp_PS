import { admin } from "@/lib/supabase/admin";
import { getReviewer } from "@/lib/auth";
import { decisionSchema } from "@/lib/schema";
import { fail, fromError, json } from "@/lib/api";
import { composeRequestMessage } from "@/lib/messages";
import type { Finding, RunResult, SubmissionData } from "@/lib/types";

/**
 * The only place a vendor becomes approved or rejected. Requires a signed-in reviewer,
 * a written note, and explicit acknowledgement of every finding that needed judgment.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/cases/[id]/decision">) {
  try {
    const reviewer = await getReviewer();
    if (!reviewer) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    const body = decisionSchema.parse(await request.json());
    const db = admin();

    const { data: sub } = await db.from("submissions").select("*").eq("id", id).single();
    if (!sub) return fail("Case not found", 404);
    if (["approved", "rejected"].includes(sub.status)) return fail(`Case is already ${sub.status}`, 409);
    if (sub.status === "processing" || sub.status === "draft") return fail("Wait for processing to finish", 409);

    const { data: runs } = await db
      .from("runs")
      .select("id, result, status")
      .eq("submission_id", id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1);
    const run = runs?.[0];
    const result = run?.result as RunResult | undefined;
    const findings: Finding[] = result?.findings ?? [];
    const now = new Date().toISOString();

    if (body.action === "approve") {
      if (!result) return fail("Cannot approve: no completed processing run", 409);
      const fixable = findings.filter((f) => f.severity === "fixable");
      if (fixable.length) return fail(`Cannot approve while ${fixable.length} vendor-fixable item(s) are open. Request information instead.`, 409);
      const mustAck = findings.filter((f) => f.severity === "review" || f.severity === "block").map((f) => f.code);
      const missing = mustAck.filter((c) => !body.acknowledged.includes(c));
      if (missing.length) return fail(`Acknowledge every flagged finding before approving (${missing.join(", ")})`, 422);
    }

    if (body.action === "request_info") {
      const items = body.items ?? [];
      if (!items.length) return fail("Select at least one item for the vendor to fix", 422);
      const { data: version } = await db.from("submission_versions").select("data").eq("submission_id", id).eq("version", sub.current_version).single();
      const message = composeRequestMessage(version!.data as SubmissionData, sub.ref, items, body.note);
      await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", id).eq("status", "open");
      const { error } = await db.from("info_requests").insert({ submission_id: id, run_id: run?.id ?? null, items, message, created_by: reviewer.email });
      if (error) throw new Error(error.message);
      await db.from("submissions").update({ status: "awaiting_vendor", updated_at: now }).eq("id", id);
    } else {
      const status = body.action === "approve" ? "approved" : "rejected";
      await db.from("submissions").update({ status, decided_at: now, updated_at: now }).eq("id", id);
      await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", id).eq("status", "open");
    }

    await db.from("events").insert({
      submission_id: id,
      run_id: run?.id ?? null,
      actor_type: "reviewer",
      actor_email: reviewer.email,
      action: body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "info_requested",
      note: body.note,
      data: {
        recommendation: result?.recommendation ?? null,
        acknowledged: body.acknowledged,
        overrode_recommendation:
          (body.action === "approve" && result?.recommendation !== "approve") || (body.action === "reject" && result?.recommendation !== "reject"),
        items: body.items ?? undefined,
      },
    });
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}
