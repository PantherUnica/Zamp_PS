import { admin } from "@/lib/supabase/admin";
import { createSubmissionSchema } from "@/lib/schema";
import { fail, fromError, isToken, json } from "@/lib/api";
import { bankAccountKey, compact } from "@/lib/rules/validators";
import { createUploads } from "@/lib/data";

/** Vendor reopens the same submission: new version of the data plus replacement documents. */
export async function POST(request: Request, ctx: RouteContext<"/api/submissions/[token]/revise">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const body = createSubmissionSchema.parse(await request.json());
    const db = admin();
    const { data: sub } = await db.from("submissions").select("id, status, current_version, ref").eq("access_token", token).single();
    if (!sub) return fail("Not found", 404);
    if (sub.status !== "awaiting_vendor") return fail("This submission is not waiting for changes from you", 409);

    const version = sub.current_version + 1;
    const { error: vErr } = await db.from("submission_versions").insert({ submission_id: sub.id, version, data: body.data });
    if (vErr) throw new Error(vErr.message);
    await db
      .from("submissions")
      .update({
        current_version: version,
        legal_name: body.data.legal_name,
        country: body.data.country,
        tax_id: compact(body.data.tax_id),
        bank_account: bankAccountKey(body.data.bank),
        contact_email: body.data.contact_email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    const uploads = await createUploads(sub.id, version, body.files);
    await db.from("events").insert({
      submission_id: sub.id,
      actor_type: "vendor",
      actor_email: body.data.contact_email,
      action: "resubmitted",
      note: `Version ${version}${body.files.length ? `, ${body.files.length} replacement document${body.files.length === 1 ? "" : "s"}` : ""}`,
    });
    return json({ ref: sub.ref, token, uploads, version });
  } catch (err) {
    return fromError(err);
  }
}
