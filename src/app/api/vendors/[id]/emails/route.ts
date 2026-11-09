import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { draftCorrectionEmail } from "@/lib/ai/correction";
import { createEmail } from "@/lib/email/outbox";
import { itemFromFinding } from "@/lib/messages";
import { vendorLink } from "@/lib/portal";
import { logEvent } from "@/lib/events";
import type { RunResult, SubmissionData } from "@/lib/types";

const body = z.object({
  mode: z.enum(["agent", "blank"]),
  codes: z.array(z.string()).default([]),
  note: z.string().max(1000).optional(),
});

/**
 * Creates a correction email DRAFT for the salesperson to review: the agent writes it from the
 * selected verification findings, or staff start from a blank email. Nothing is sent here.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/emails">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const b = body.parse(await request.json());
    const db = admin();
    const { data: vendor } = await db.from("vendors").select("*").eq("id", id).single();
    if (!vendor) return fail("Not found", 404);
    const { data: sub } = await db.from("submissions").select("*").eq("vendor_id", id).maybeSingle();
    const { data: version } = sub ? await db.from("submission_versions").select("data").eq("submission_id", sub.id).eq("version", sub.current_version).maybeSingle() : { data: null };
    const data = version?.data as SubmissionData | undefined;
    const to = data?.contact_email || vendor.contact_email;
    if (!to) return fail("The vendor has no contact email", 422);

    if (b.mode === "blank") {
      const row = await createEmail({
        kind: "custom",
        audience: "vendor",
        to,
        content: { subject: `${vendor.company_name}: `, body: `Hello ${data?.contact_name || vendor.contact_name || "there"},\n\n\n\nRegards,\n${staff.name}`, ...(sub ? { ctaLabel: "Open your onboarding form", ctaUrl: vendorLink(sub.access_token) } : {}) },
        vendorId: id,
        submissionId: sub?.id,
        generatedBy: "staff",
        createdBy: staff.id,
      });
      return json({ id: row.id }, 201);
    }

    if (!sub) return fail("Generate an onboarding link first", 409);
    const { data: runs } = await db.from("runs").select("result").eq("submission_id", sub.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1);
    const findings = ((runs?.[0]?.result as RunResult | undefined)?.findings ?? []).filter((f) => f.severity !== "info" && (b.codes.length === 0 || b.codes.includes(f.code)));
    if (!findings.length) return fail("Select at least one finding to explain to the vendor", 422);
    const items = findings.map(itemFromFinding);
    await db.from("emails").update({ status: "discarded" }).eq("submission_id", sub.id).eq("kind", "correction_request").eq("status", "draft");
    await db.from("info_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("submission_id", sub.id).eq("status", "draft");
    const { data: req, error } = await db.from("info_requests").insert({ submission_id: sub.id, items, message: items.map((i, n) => `${n + 1}. ${i.action}`).join("\n"), status: "draft", created_by: staff.email }).select("id").single();
    if (error || !req) throw new Error(error?.message);
    const { content, byAgent } = await draftCorrectionEmail({ contactName: data?.contact_name ?? vendor.contact_name, company: data?.legal_name ?? vendor.company_name, ref: sub.ref, url: vendorLink(sub.access_token), items, ownerName: staff.name, note: b.note });
    const row = await createEmail({ kind: "correction_request", audience: "vendor", to, content, vendorId: id, submissionId: sub.id, infoRequestId: req.id, generatedBy: byAgent ? "agent" : "system", createdBy: staff.id });
    await logEvent({ vendorId: id, submissionId: sub.id, actor: byAgent ? "agent" : "system", action: "correction_drafted", note: `${items.length} item${items.length > 1 ? "s" : ""} · requested by ${staff.email}` });
    return json({ id: row.id }, 201);
  } catch (err) {
    return fromError(err);
  }
}
