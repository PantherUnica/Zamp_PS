import Link from "next/link";
import type { Metadata } from "next";
import { getReviewer } from "@/lib/auth";
import { SAMPLE_CASES } from "@/lib/samples";
import { SubmissionForm } from "@/components/submission-form";
import { Mark } from "@/components/app-shell";

export const metadata: Metadata = { title: "Vendor registration" };

export default async function Onboard() {
  const reviewer = await getReviewer();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-3">
          <Mark />
          {reviewer ? (
            <Link href="/dashboard" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Back to overview</Link>
          ) : (
            <Link href="/login" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Reviewer sign in</Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-8">
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-[0.04em] text-muted">Vendor registration</div>
          <h1 className="text-lg font-semibold">Register as a supplier</h1>
          <p className="mt-1 max-w-[640px] text-sm text-ink-2">
            We check your company, tax and bank details against your documents before you can be paid. If anything is missing or unclear,
            we will tell you exactly what to fix, and you can update this same submission.
          </p>
        </div>
        <SubmissionForm mode="create" samples={reviewer ? SAMPLE_CASES : undefined} reviewer={!!reviewer} />
      </main>
    </div>
  );
}
