import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff, isAdmin, ROLE_LABEL } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { fail, fromError, json } from "@/lib/api";
import { createAndSend } from "@/lib/email/outbox";
import { compose } from "@/lib/email/templates";

const body = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["sales", "reviewer", "admin"]),
});

/** Admin adds a teammate: creates the login with a role and emails a one-time set-password link. */
export async function POST(request: Request) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    if (!isAdmin(staff)) return fail("Only admins can manage the team", 403);
    const b = body.parse(await request.json());
    const db = admin();
    const created = await db.auth.admin.createUser({ email: b.email, email_confirm: true, app_metadata: { role: b.role }, user_metadata: { full_name: b.full_name } });
    let userId = created.data.user?.id;
    if (created.error) {
      if (!/already|registered|exists/i.test(created.error.message)) throw new Error(created.error.message);
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      userId = list.users.find((u) => u.email?.toLowerCase() === b.email)?.id;
      if (!userId) throw new Error(created.error.message);
    }
    await db.from("profiles").upsert({ id: userId, email: b.email, full_name: b.full_name, role: b.role });
    const link = await db.auth.admin.generateLink({ type: "recovery", email: b.email });
    if (link.error) throw new Error(link.error.message);
    const url = `${serverEnv.appUrl()}/auth/confirm?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=recovery&next=/set-password`;
    const sent = await createAndSend({ kind: "teammate_invite", audience: "staff", to: b.email, content: compose.teammate({ name: b.full_name, roleLabel: ROLE_LABEL[b.role].toLowerCase(), inviter: staff.name, url }), createdBy: staff.id }, staff);
    return json({ id: userId, email: { status: sent.status, error: sent.error } }, 201);
  } catch (err) {
    return fromError(err);
  }
}
