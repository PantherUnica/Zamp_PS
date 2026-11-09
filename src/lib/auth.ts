import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** The signed-in staff member (salesperson, reviewer or admin), or null. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const { data: p } = await admin().from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  if (!p) return null; // signed in to Supabase but not a member of this workspace
  return { id: user.id, email: user.email, name: p.full_name || user.email.split("@")[0], role: p.role as Role };
}

export async function requireStaff(next = "/dashboard"): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}

export const canDecide = (s: Pick<Staff, "role">) => s.role === "reviewer" || s.role === "admin";
export const isAdmin = (s: Pick<Staff, "role">) => s.role === "admin";

export const ROLE_LABEL: Record<Role, string> = { sales: "Salesperson", reviewer: "Reviewer", admin: "Admin" };
