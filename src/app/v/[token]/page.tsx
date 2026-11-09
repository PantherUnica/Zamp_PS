import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Mark } from "@/components/app-shell";
import { Lock } from "@/components/icons";
import { VendorPortal } from "@/components/vendor-portal";

export const metadata: Metadata = { title: "Vendor onboarding", robots: { index: false, follow: false } };

export default async function VendorPage({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/"><Mark /></Link>
          <span className="flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> Private link · do not forward</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 sm:py-12">
        <VendorPortal token={token} />
      </main>
    </div>
  );
}
