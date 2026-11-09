import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { Mark } from "@/components/app-shell";
import { LinkEntry } from "@/components/login-form";
import { LandingBackdrop } from "@/components/landing-backdrop";
import { ButtonLink } from "@/components/ui";

const STEPS = [
  { n: "01", title: "Log the call", body: "Upload a transcript. The agent pulls out the vendor's details, requirements, objections and follow-ups." },
  { n: "02", title: "Send a magic link", body: "A personal, expiring link. No account or password. The vendor saves progress and returns any time." },
  { n: "03", title: "Agent verifies", body: "GSTIN, PAN, IFSC, documents and duplicates, each checked with the evidence shown, and every source labelled." },
  { n: "04", title: "A person decides", body: "Clean cases arrive ready to sign. Anything doubtful explains itself. Only a reviewer can approve." },
];

export default async function Landing() {
  if (await getStaff()) redirect("/dashboard");
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-surface">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px]" aria-hidden><LandingBackdrop /></div>
      <header className="relative mx-auto flex max-w-[1120px] items-center justify-between px-4 py-5 sm:px-8">
        <Mark />
        <Link href="/login" className="t-colors text-sm text-ink-2 hover:text-ink">Team sign in</Link>
      </header>

      <main className="relative mx-auto max-w-[1120px] px-4 sm:px-8">
        <section className="grid gap-12 pt-12 pb-20 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:pt-20">
          <div>
            <p className="anim-rise mb-6 text-sm text-muted">Vendor onboarding for Indian businesses</p>
            <h1 className="anim-rise delay-1 font-display text-[44px] leading-[1.05] tracking-[-0.01em] sm:text-[60px]">
              Every vendor verified<br />before the first rupee moves.
            </h1>
            <p className="anim-rise delay-2 mt-6 max-w-[520px] text-md text-ink-2">
              From the first sales call to an approved supplier. An agent does the reading and checking; your team makes the decisions,
              with the evidence for each one on screen.
            </p>
          </div>

          <div className="anim-rise delay-3 flex flex-col gap-4">
            <div className="rounded-[10px] border border-line bg-surface/90 p-5 backdrop-blur-sm">
              <div className="text-sm font-semibold">For your team</div>
              <p className="mt-1 text-sm text-muted">Salespeople, reviewers and admins.</p>
              <ButtonLink href="/login" variant="dark" className="mt-4 w-full">Sign in to the workspace</ButtonLink>
            </div>
            <div className="relative rounded-[10px] border border-line bg-surface/90 p-5 backdrop-blur-sm">
              <div className="text-sm font-semibold">Invited as a vendor?</div>
              <p className="mt-1 mb-4 text-sm text-muted">Open the link from your email, or paste it here.</p>
              <LinkEntry />
            </div>
          </div>
        </section>

        <section className="anim-rise delay-4 grid border-t border-line bg-surface sm:grid-cols-2 lg:grid-cols-4" aria-label="How it works">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`py-8 pr-6 ${i > 0 ? "lg:border-l lg:pl-6" : ""} ${i % 2 === 1 ? "sm:border-l sm:pl-6 lg:pl-6" : ""} border-line`}>
              <div className="mono text-xs text-accent">{s.n}</div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-2 text-sm text-ink-2">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 border-t border-line py-14 lg:grid-cols-[1fr_1.4fr]">
          <h2 className="font-display text-[32px] leading-tight">What “verified” means here</h2>
          <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Format</dt><dd className="mt-1 text-ink-2">GSTIN check character, PAN structure, IFSC and account formats. These prove a number is well-formed, not that it exists.</dd></div>
            <div><dt className="font-semibold">Documents</dt><dd className="mt-1 text-ink-2">The agent reads the GST certificate, PAN card and cheque, and every form value is compared with what is printed.</dd></div>
            <div><dt className="font-semibold">External records</dt><dd className="mt-1 text-ink-2">IFSC codes are checked against RBI branch data. GST and PAN registry checks are shown as not connected until a provider is added.</dd></div>
            <div><dt className="font-semibold">People</dt><dd className="mt-1 text-ink-2">No vendor is approved by software. A reviewer signs off, and every action is logged.</dd></div>
          </dl>
        </section>
      </main>

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-6 text-xs text-muted sm:px-8">
          <span>Zamp PS-2 · Vendor onboarding</span>
          <span>Data stays in your Supabase project</span>
        </div>
      </footer>
    </div>
  );
}
