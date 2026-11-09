import { admin } from "@/lib/supabase/admin";
import { canDecide, getStaff } from "@/lib/auth";
import { decisionSchema } from "@/lib/schema";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { createAndSend } from "@/lib/email/outbox";
import { compose } from "@/lib/email/templates";
import { vendorLink } from "@/lib/portal";
import type { Finding, RunResult, SubmissionData } from "@/lib/types";

/**
 * The only place a vendor becomes approved or rejected. Approve/reject need a reviewer or admin
 * who does not own the vendor, a written note, and explicit acknowledgement of every finding
 * that needed judgment. Any staff member can request more information.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/decision">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const body = decisionSchema.parse(await request.json());
    const db = admin();
    const { data: vendor } = await db.from("vendors").select("*").eq("id", id).single();
    const { data: sub } = await db.from("submissions").select("*").eq("vendor_id", id).maybeSingle();
    if (!vendor || !sub) return fail("This vendor has not submitted anything yet", 404);
    if (["approved", "rejected"].includes(sub.status)) return fail(`Vendor is already ${sub.status}`, 409);
    if (["processing", "draft"].includes(sub.status)) return fail("Wait until the vendor has submitted and verification has finished", 409);

    if (body.action !== "request_info") {
      if (!canDecide(staff)) return fail("Only reviewers and admins can approve or reject vendors", 403);
      if (vendor.owner_id === staff.id) return fail("You own this vendor. Another reviewer must make the decision (separation of duties).", 403);
    }

    const { data: runs } = await db.from("runs").select("id, result").eq("submission_id", sub.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1);
    const run = runs?.[0];
    const result = run?.result as RunResult | undefined;
    const findings: Finding[] = result?.findings ?? [];
    const { data: version } = await db.from("submission_versions").select("data").eq("submission_id", sub.id).eq("version", sub.current_version).maybeSingle();
    const data = version?.data as SubmissionData | undefined;
    const to = data?.contact_email || vendor.contact_email;
    const now = new Date().toISOString();

    if (body.action === "approve") {
      if (!result) return fail("Cannot approve: no completed verification run", 409);
      const fixable = findings.filter((f) => f.severity === "fixable");
      if (fixable.length) return fail(`Cannot approve while ${fixable.length} vendor-fixable item(s) are open. Request the corrections first.`, 409);
      const mustAck = findings.filter((f) => f.severity === "review" || f.severity === "block").map((f) => f.code);
      const missing = mustAck.filter((c) => !body.acknowledged.includes(c));
      if (missing.length) return fail(`Acknowledge every flagged finding before approving (${missing.join(", ")})`, 422);
    }

    let emailStatus: { status: string; error: string | null } | null = null;
    if (body.action === "request_info") {
      const items = body.items ?? [];
      if (!items.length) return fail("Select at least one item for the vendor to fix", 422);
      if (!to) return fail("The vendor has no contact email", 422);
      await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", sub.id).in("status", ["open", "draft"]);
      await db.from("emails").update({ status: "discarded" }).eq("submission_id", sub.id).eq("kind", "correction_request").eq("status", "draft");
      const content = compose.correction({ contactName: data?.contact_name ?? vendor.contact_name, company: data?.legal_name ?? vendor.company_name, ref: sub.ref, url: vendorLink(sub.access_token), items, note: body.note });
      const { data: req, error } = await db.from("info_requests").insert({ submission_id: sub.id, run_id: run?.id ?? null, items, message: content.body, status: "open", created_by: staff.email }).select("id").single();
      if (error || !req) throw new Error(error?.message);
      await db.from("submissions").update({ status: "awaiting_vendor", updated_at: now }).eq("id", sub.id);
      const sent = await createAndSend({ kind: "correction_request", audience: "vendor", to, content, vendorId: id, submissionId: sub.id, infoRequestId: req.id, generatedBy: "staff", createdBy: staff.id }, staff);
      emailStatus = { status: sent.status, error: sent.error };
    } else {
      const status = body.action === "approve" ? "approved" : "rejected";
      await db.from("submissions").update({ status, decided_at: now, updated_at: now }).eq("id", sub.id);
      await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", sub.id).in("status", ["open", "draft"]);
      if (body.notify && to) {
        const o = { contactName: data?.contact_name ?? vendor.contact_name, company: data?.legal_name ?? vendor.company_name, ref: sub.ref };
        const sent = await createAndSend({ kind: status === "approved" ? "decision_approved" : "decision_rejected", audience: "vendor", to, content: status === "approved" ? compose.approved(o) : compose.rejected(o), vendorId: id, submissionId: sub.id, generatedBy: "system", createdBy: staff.id }, staff);
        emailStatus = { status: sent.status, error: sent.error };
      }
    }
    await db.from("vendors").update({ updated_at: now }).eq("id", id);

    await logEvent({
      vendorId: id,
      submissionId: sub.id,
      runId: run?.id ?? null,
      actor: "staff",
      actorEmail: staff.email,
      action: body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "info_requested",
      note: body.note,
      data: {
        role: staff.role,
        recommendation: result?.recommendation ?? null,
        acknowledged: body.acknowledged,
        overrode_recommendation: (body.action === "approve" && result?.recommendation !== "approve") || (body.action === "reject" && result?.recommendation !== "reject"),
        items: body.items ?? undefined,
      },
    });
    return json({ ok: true, email: emailStatus });
  } catch (err) {
    return fromError(err);
  }
}
