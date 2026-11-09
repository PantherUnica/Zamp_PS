import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, json } from "@/lib/api";

const body = z.object({
  vendor_id: z.string().uuid(),
  title: z.string().trim().min(2, "Describe the task").max(300),
  owner: z.enum(["us", "vendor"]).default("us"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const b = body.parse(await request.json());
    const { data, error } = await admin().from("tasks").insert({ ...b, due_date: b.due_date || null, created_by: staff.id }).select("id").single();
    if (error) throw new Error(error.message);
    return json(data, 201);
  } catch (err) {
    return fromError(err);
  }
}
