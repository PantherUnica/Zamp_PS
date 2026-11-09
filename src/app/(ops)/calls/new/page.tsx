import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { CallUploader } from "@/components/call-forms";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Log a call" };

export default async function NewCall({ searchParams }: PageProps<"/calls/new">) {
  await requireStaff();
  const sp = await searchParams;
  const { data: vendors } = await admin().from("vendors").select("id, company_name").order("company_name");
  return (
    <>
      <div className="mb-2 text-sm"><Link href="/calls" className="text-muted underline-offset-4 hover:text-ink hover:underline">Calls</Link></div>
      <PageHeader title="Log a call" meta="Upload or paste the transcript. The agent turns it into vendor details, actions and coaching." />
      <CallUploader vendors={vendors ?? []} defaultVendor={typeof sp.vendor === "string" ? sp.vendor : undefined} />
    </>
  );
}
