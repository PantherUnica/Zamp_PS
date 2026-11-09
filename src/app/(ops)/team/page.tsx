import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin, requireStaff } from "@/lib/auth";
import { listStaff } from "@/lib/data";
import { TeamManager } from "@/components/team-manager";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Team" };

export default async function Team() {
  const me = await requireStaff();
  if (!isAdmin(me)) redirect("/dashboard");
  const members = await listStaff();
  return (
    <>
      <PageHeader title="Team" meta="Who can sign in, and what they are allowed to decide" />
      <TeamManager members={members} meId={me.id} />
    </>
  );
}
