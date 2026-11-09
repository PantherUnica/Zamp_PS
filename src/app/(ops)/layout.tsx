import { requireStaff, ROLE_LABEL } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";

export default async function OpsLayout({ children }: LayoutProps<"/">) {
  const me = await requireStaff();
  const db = admin();
  const [{ count: review }, { count: drafts }, { count: failed }] = await Promise.all([
    db.from("submissions").select("id", { count: "exact", head: true }).eq("status", "awaiting_review").not("vendor_id", "is", null),
    db.from("emails").select("id", { count: "exact", head: true }).eq("status", "draft").eq("kind", "correction_request"),
    db.from("emails").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const nav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/vendors", label: "Vendors" },
    { href: "/calls", label: "Calls" },
    { href: "/review", label: "Review queue", badge: review ?? 0 },
    { href: "/emails", label: "Emails", badge: (drafts ?? 0) + (failed ?? 0) },
    ...(me.role === "admin" ? [{ href: "/team", label: "Team" }] : []),
  ];
  return (
    <AppShell me={{ name: me.name, email: me.email, roleLabel: ROLE_LABEL[me.role] }} nav={nav}>
      {children}
    </AppShell>
  );
}
