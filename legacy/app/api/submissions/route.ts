import { admin } from "@/lib/supabase/admin";
import { createSubmissionSchema } from "@/lib/schema";
import { fail, fromError, json } from "@/lib/api";
import { createUploads } from "@/lib/data";
import { bankAccountKey, compact } from "@/lib/rules/validators";

/**
 * Vendor creates a submission. Returns a secret access token (the vendor's link back to this
 * submission) and signed upload URLs so files go straight to private storage, not through this function.
 */
export async function POST(request: Request) {
  try {
    const body = createSubmissionSchema.parse(await request.json());
    const slots = body.files.map((f) => f.slot);
    if (new Set(slots).size !== slots.length) return fail("Upload one file per document type", 422);

    const db = admin();
    const { data: sub, error } = await db
      .from("submissions")
      .insert({
        legal_name: body.data.legal_name,
        country: body.data.country,
        tax_id: compact(body.data.tax_id),
        bank_account: bankAccountKey(body.data.bank),
        contact_email: body.data.contact_email,
        status: "draft",
        current_version: 1,
      })
      .select("id, ref, access_token")
      .single();
    if (error || !sub) throw new Error(`Could not create submission: ${error?.message}`);

    const { error: vErr } = await db.from("submission_versions").insert({ submission_id: sub.id, version: 1, data: body.data });
    if (vErr) throw new Error(vErr.message);

    const uploads = await createUploads(sub.id, 1, body.files);
    await db.from("events").insert({
      submission_id: sub.id,
      actor_type: "vendor",
      actor_email: body.data.contact_email,
      action: "submitted",
      note: `${body.files.length} document${body.files.length === 1 ? "" : "s"} attached`,
    });
    return json({ ref: sub.ref, token: sub.access_token, uploads }, 201);
  } catch (err) {
    return fromError(err);
  }
}
