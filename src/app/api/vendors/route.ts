import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { vendorSchema } from "@/lib/schema";
import { fail, fromError, json } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { issueLink } from "@/lib/invite";

const body = vendorSchema.extend({
  invite: z.boolean().default(false),
  send: z.boolean().default(false),
  prefill: z.record(z.string(), z.unknown()).optional(),
});

/** Salesperson creates a vendor (lead), optionally generating and emailing the magic link right away. */
export async function POST(request: Request) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const b = body.parse(await request.json());
    if ((b.invite || b.send) && !b.contact_email) return fail("A contact email is needed to send an onboarding link", 422, [{ path: "contact_email", message: "Required to send the link" }]);
    const db = admin();
    const { data: v, error } = await db
      .from("vendors")
      .insert({
        company_name: b.company_name,
        contact_name: b.contact_name || null,
        contact_email: b.contact_email || null,
        contact_phone: b.contact_phone || null,
        city: b.city || null,
        supplies: b.supplies || null,
        source: b.source || null,
        notes: b.notes || null,
        prefill: b.prefill ?? {},
        owner_id: staff.id,
        created_by: staff.id,
      })
      .select("id, ref")
      .single();
    if (error || !v) throw new Error(`Could not create vendor: ${error?.message}`);
    await logEvent({ vendorId: v.id, actor: "staff", actorEmail: staff.email, action: "vendor_created", note: b.company_name });
    let link = null;
    if (b.invite || b.send) link = await issueLink(v.id, staff, { send: b.send, regenerate: false });
    return json({ id: v.id, ref: v.ref, link }, 201);
  } catch (err) {
    return fromError(err);
  }
}
