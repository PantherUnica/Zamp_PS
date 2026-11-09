import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReviewer } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { SAMPLE_CASES } from "@/lib/samples";
import { Mark } from "@/components/app-shell";
import { VendorStatus } from "@/components/vendor-status";

export const metadata: Metadata = { title: "Your submission", robots: { index: false } };

export default async function VendorPage({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const { data: sub } = await admin().from("submissions").select("legal_name").eq("access_token", token).single();
  if (!sub) notFound();
  // Demo helper: a signed-in reviewer acting as the vendor can attach the prepared resubmission file.
  const reviewer = await getReviewer();
  const demoFiles = reviewer ? SAMPLE_CASES.find((s) => s.data.legal_name === sub.legal_name)?.resubmission : undefined;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-3">
          <Mark />
          <span className="text-xs text-muted">Secure vendor link · do not share</span>
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-8">
        <VendorStatus token={token} demoFiles={demoFiles} />
      </main>
    </div>
  );
}
