import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { LandingBackdrop } from "@/components/landing-backdrop";
import { CursorFollower, DragRail, Reveal, VendorLinkLine } from "@/components/landing";

const STEPS = [
  { n: "01", title: "Log the call", kicker: "Transcript in", body: "Drop a Zoom, Meet or Teams transcript. The agent pulls out the vendor's details, requirements, objections, risk signals and follow-ups, with coaching for the rep." },
  { n: "02", title: "Send a magic link", kicker: "No passwords", body: "A personal, expiring link. The vendor fills a guided form that saves as they go and checks GSTIN, PAN and IFSC as they type." },
  { n: "03", title: "Agent verifies", kicker: "8 stages", body: "Documents read by AI, every value cross-checked by rules, IFSC matched against RBI branch data, duplicates searched across your vendors." },
  { n: "04", title: "A person decides", kicker: "Human sign-off", body: "Clean cases arrive ready to sign. Doubtful ones explain themselves. Only a reviewer who doesn't own the vendor can approve." },
];

const CHECKS = [
  { tag: "Format · checksum", title: "Well-formed is not the same as real", body: "GSTIN check character, PAN holder type, IFSC and account structure. These prove a number is well-formed, never that it exists.", sample: "29AABCN1234F1ZS", tone: "paper" },
  { tag: "Document · cross-check", title: "Every value against the paper it came from", body: "The GST certificate, PAN card and cancelled cheque are read, and the name, GSTIN, PAN, account and IFSC on the form are compared with what is printed.", sample: "PVT LTD = PRIVATE LIMITED", tone: "ink" },
  { tag: "External record", title: "Checked where a record exists", body: "IFSC codes are matched against RBI branch data. GSTN, NSDL and penny-drop checks are labelled not connected until a provider is added, and never counted as passed.", sample: "HDFC0000075 → AIRPORT RD", tone: "accent" },
  { tag: "Human · audit", title: "No vendor is approved by software", body: "Reviewers acknowledge every flag and sign with a note. The agent, the vendor and your team all leave a trail you can read later.", sample: "APPROVED · A. RAO · 14:02", tone: "paper" },
];

function ScreenForm() {
  return (
    <div className="text-[11px] text-ink">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="font-bold uppercase tracking-tight">Northwind Components</span><span className="text-muted">Step 3/6</span></div>
      <div className="space-y-3 px-4 py-4">
        <div><div className="mb-1 text-muted">GSTIN</div><div className="mono flex items-center justify-between rounded-md border border-line px-2 py-1.5">29AABCN1234F1ZS<span className="text-ok">15/15</span></div><div className="mt-1 text-ok">✓ Format looks right</div></div>
        <div><div className="mb-1 text-muted">PAN of the business</div><div className="mono rounded-md border border-line px-2 py-1.5">AABCN1234F</div></div>
        <div><div className="mb-1 text-muted">IFSC</div><div className="mono rounded-md border border-line px-2 py-1.5">HDFC0000075</div><div className="mt-1 text-ok">HDFC Bank, Airport Road</div></div>
        <div className="flex gap-1 pt-1">{[1, 1, 1, 0, 0, 0].map((d, i) => <span key={i} className={`h-1 flex-1 rounded-full ${d ? "bg-ink" : "bg-line"}`} />)}</div>
      </div>
      <div className="m-4 mt-0 rounded-full bg-ink py-2 text-center text-[10px] font-semibold uppercase text-white">Continue</div>
    </div>
  );
}

function ScreenRun() {
  const rows: [string, string][] = [["Intake", "ok"], ["Document reading", "ok"], ["Format validation", "ok"], ["Cross-checks", "warn"], ["External records", "run"], ["Risk & duplicates", "wait"], ["Decision rules", "wait"]];
  return (
    <div className="text-[11px] text-ink">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="font-bold uppercase tracking-tight">Live run · VND-0006</span><span className="flex items-center gap-1 text-accent"><span className="anim-pulse size-1.5 rounded-full bg-accent" />Live</span></div>
      <ol className="space-y-2.5 px-4 py-4">
        {rows.map(([l, s]) => (
          <li key={l} className="flex items-center gap-2.5">
            <span className={`grid size-4 place-items-center rounded-full border text-[8px] ${s === "ok" ? "border-ink bg-ink text-white" : s === "warn" ? "border-accent text-accent" : s === "run" ? "border-accent" : "border-line-strong"}`}>{s === "ok" ? "✓" : s === "warn" ? "!" : s === "run" ? <span className="anim-pulse size-1.5 rounded-full bg-accent" /> : ""}</span>
            <span className={s === "wait" ? "text-muted" : ""}>{l}</span>
            {s === "warn" && <span className="ml-auto text-accent">1 flag</span>}
          </li>
        ))}
      </ol>
      <div className="mx-4 mb-4 rounded-md bg-subtle px-3 py-2"><div className="text-muted">Account holder (cheque)</div><div className="mono">BRIGHTLINE LOGISTICS PVT LTD</div><div className="text-danger">✕ Differs from legal name · 60/100</div></div>
    </div>
  );
}

function ScreenDecision() {
  return (
    <div className="text-[11px] text-ink">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="font-bold uppercase tracking-tight">Decision</span><span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">Ready for approval</span></div>
      <div className="space-y-2 px-4 py-4">
        {["GSTIN matches certificate", "PAN matches card", "Cheque in company's name", "IFSC in RBI directory", "No duplicate vendors"].map((t) => (
          <div key={t} className="flex items-center gap-2"><span className="text-ok">✓</span>{t}</div>
        ))}
        <div className="flex items-center gap-2 text-muted"><span>–</span>GSTN registry · not connected</div>
        <div className="mt-2 rounded-md border border-line px-2 py-2 text-muted">Reviewer note: cheque verified, suffix difference only.</div>
      </div>
      <div className="m-4 mt-0 grid grid-cols-2 gap-2">
        <div className="rounded-full border border-ink py-2 text-center text-[10px] font-semibold uppercase">Request</div>
        <div className="rounded-full bg-accent py-2 text-center text-[10px] font-semibold uppercase text-white">Approve</div>
      </div>
    </div>
  );
}

export default async function Landing() {
  if (await getStaff()) redirect("/dashboard");
  return (
    <div className="relative overflow-x-hidden">
      <CursorFollower />

      {/* ───────── Hero: dark, full-bleed, product "reel" */}
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden><LandingBackdrop tone="dark" /></div>
        <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-6 sm:px-10 lg:px-[100px] lg:py-10">
          <Link href="/" className="text-[22px] font-extrabold uppercase tracking-[-0.05em]">Onboard<sup className="text-[11px]">®</sup></Link>
          <nav className="hidden items-center gap-12 text-[15px] font-semibold uppercase tracking-[-0.01em] md:flex" aria-label="Sections">
            <a href="#how" className="t-colors hover:text-[#f7cdb4]">How it works</a>
            <a href="#checks" className="t-colors hover:text-[#f7cdb4]">Verification</a>
            <a href="#vendors" className="t-colors hover:text-[#f7cdb4]">For vendors</a>
          </nav>
          <Link href="/login" data-cursor="Sign in" className="t-colors rounded-full border border-white/70 px-5 py-2 text-[13px] font-semibold uppercase hover:bg-white hover:text-ink">Sign in</Link>
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-8 px-5 pt-4 pb-16 sm:px-10 md:grid-cols-3 lg:px-[100px]">
          {[
            { el: <ScreenForm />, tilt: "-2deg", delay: "0s", cls: "hidden md:block" },
            { el: <ScreenRun />, tilt: "0deg", delay: "-2.3s", cls: "" },
            { el: <ScreenDecision />, tilt: "2deg", delay: "-4.6s", cls: "hidden md:block" },
          ].map((s, i) => (
            <div key={i} className={`anim-float mx-auto w-full max-w-[320px] overflow-hidden rounded-[18px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.45)] ${s.cls}`} style={{ ["--tilt" as string]: s.tilt, animationDelay: s.delay }}>
              <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold text-ink"><span>9:41</span><span className="flex gap-1"><span className="h-1.5 w-3 rounded-sm bg-ink" /><span className="h-1.5 w-1.5 rounded-full bg-ink" /></span></div>
              {s.el}
            </div>
          ))}
          <Link href="/login" data-cursor="Open" className="t-colors absolute top-1/2 left-1/2 hidden size-[150px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f2f1ee] text-center text-[17px] leading-tight font-bold uppercase tracking-[-0.03em] text-ink hover:bg-[#f7cdb4] md:grid">
            See it<br />run
          </Link>
        </div>

        <div className="relative z-10 mx-auto max-w-[1440px] px-5 pb-12 sm:px-10 lg:px-[100px]">
          <div className="flex flex-col gap-6 border-t border-white/25 pt-8 lg:flex-row lg:items-end lg:justify-between"><h1 className="display anim-rise text-[40px] sm:text-[56px] xl:text-[72px]">Every vendor verified<br className="hidden sm:block" /> before the first rupee moves.</h1><p className="anim-rise delay-2 max-w-[340px] text-[17px] leading-[1.45] text-white/75">From the first sales call to an approved supplier. An agent reads and checks; your team decides, with the evidence on screen.</p></div>
        </div>
      </section>

      {/* ───────── Proof row */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-10 lg:px-[100px] lg:py-28">
        <div className="grid gap-12 text-center sm:grid-cols-3">
          {[
            ["08", "Verification stages", "on every submission"],
            ["04", "Evidence sources", "each check labelled"],
            ["00", "Auto-approvals", "a person always signs"],
          ].map(([n, a, b], i) => (
            <Reveal key={n} delay={i * 120}>
              <div className="display text-[72px] lg:text-[96px]">{n}</div>
              <div className="label mt-4">{a}<br />{b}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── Statement + giant wordmark */}
      <section className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-[100px]">
        <div className="grid gap-12 border-t border-ink py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
          <Reveal>
            <p className="text-[30px] leading-[1.12] font-medium tracking-[-0.035em] sm:text-[42px]">
              Onboard® is the vendor desk for Indian businesses. It reads GST, PAN and bank documents, checks every number, chases what&apos;s missing, and hands your team decisions with the evidence attached.
            </p>
            <Link href="/login" data-cursor="Sign in" className="t-colors mt-10 inline-flex rounded-full border border-ink px-7 py-3 text-[13px] font-semibold uppercase hover:bg-ink hover:text-white">Sign in to the workspace</Link>
          </Reveal>
          <Reveal delay={150} className="flex justify-start lg:justify-end">
            <div className="text-[120px] leading-none font-extrabold tracking-[-0.07em] sm:text-[180px] lg:text-[220px]" aria-hidden>
              O/B<span className="align-top text-[0.45em]">®</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── How it works: numbered index + drag rail */}
      <section id="how" className="mx-auto max-w-[1440px] scroll-mt-10 px-5 sm:px-10 lg:px-[100px]">
        <div className="flex items-baseline border-t border-ink pt-5 text-[15px] font-medium">
          <span className="w-1/3">00</span>
          <span className="flex-1">/04</span>
          <span className="size-2.5 rounded-full bg-ink" aria-hidden />
        </div>
        <h2 className="display mt-16 mb-16 text-[48px] sm:text-[64px]">How it<br />works</h2>
      </section>
      <div className="mx-auto max-w-[1440px] pl-5 sm:pl-10 lg:pl-[100px]">
        <DragRail>
          {STEPS.map((s) => (
            <article key={s.n} className="w-[78vw] max-w-[420px] shrink-0 snap-start pr-2 sm:w-[46vw]">
              <div className="display text-[64px] text-accent">{s.n}</div>
              <div className="mt-4 h-0.5 w-6 bg-ink" />
              <div className="label mt-16 text-muted">{s.kicker}</div>
              <h3 className="mt-2 text-[28px] font-bold uppercase tracking-[-0.035em]">{s.title}</h3>
              <p className="mt-4 text-[19px] leading-[1.45] tracking-[-0.015em] text-ink-2">{s.body}</p>
            </article>
          ))}
          <div className="w-[10vw] shrink-0" aria-hidden />
        </DragRail>
      </div>

      {/* ───────── What verified means: big list rows */}
      <section id="checks" className="mx-auto max-w-[1440px] scroll-mt-10 px-5 pt-28 sm:px-10 lg:px-[100px]">
        <h2 className="display mb-14 text-[48px] sm:text-[64px]">What “verified”<br />means here</h2>
        {CHECKS.map((c) => (
          <Reveal key={c.title}>
            <article className="grid gap-6 border-t border-ink py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8">
              <div className={`grid aspect-[16/10] place-items-center overflow-hidden rounded-sm px-6 ${c.tone === "ink" ? "bg-ink text-white" : c.tone === "accent" ? "bg-accent text-white" : "bg-[#e7e5e0] text-ink"}`}>
                <span className="mono text-center text-[15px] tracking-tight sm:text-[18px]">{c.sample}</span>
              </div>
              <div className="flex min-h-full flex-col">
                <div className="flex items-start justify-between gap-6">
                  <h3 className="display text-[32px] sm:text-[48px]">{c.title}</h3>
                  <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-2 shrink-0" aria-hidden><path d="M4 17h26M20 7l10 10-10 10" /></svg>
                </div>
                <p className="mt-6 max-w-[620px] text-[17px] leading-[1.5] text-ink-2">{c.body}</p>
                <div className="label mt-auto pt-8"><span className="font-bold">{c.tag.split(" · ")[0]}</span> <span className="text-muted">{c.tag.split(" · ")[1]}</span></div>
              </div>
            </article>
          </Reveal>
        ))}
      </section>

      {/* ───────── Vendors */}
      <section id="vendors" className="mx-auto max-w-[1440px] scroll-mt-10 px-5 py-28 sm:px-10 lg:px-[100px]">
        <div className="grid gap-12 border-t border-ink pt-16 lg:grid-cols-2">
          <h2 className="display text-[48px] sm:text-[64px]">Invited as<br />a vendor?</h2>
          <div>
            <p className="max-w-[520px] text-[19px] leading-[1.45] text-ink-2">Open the link from your email, or paste it below. No account, no password. You can save and come back to the same link any time before it expires.</p>
            <div className="mt-10 max-w-[560px]"><VendorLinkLine /></div>
            <ul className="label mt-10 grid gap-2 text-ink-2 sm:grid-cols-2">
              {["GSTIN and PAN", "Bank account and IFSC", "GST certificate", "PAN card", "Cancelled cheque", "Incorporation certificate"].map((x) => <li key={x} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-ink" />{x}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── Footer */}
      <footer className="bg-ink text-white">
        <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-10 lg:px-[100px]">
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="text-[26px] font-extrabold uppercase tracking-[-0.05em]">O/B<sup className="text-[12px]">®</sup></div>
            <p className="text-[30px] leading-[1.15] font-medium tracking-[-0.035em] sm:text-[38px]">
              We verify ambitious supply chains. Let&apos;s onboard yours.{" "}
              <Link href="/login" data-cursor="Sign in" className="underline decoration-2 underline-offset-[6px] hover:text-[#f7cdb4]">Sign in</Link>
            </p>
          </div>
          <div className="mt-24 grid gap-12 lg:grid-cols-2">
            <div>
              <div className="label flex items-center gap-2 text-[15px]"><span className="size-2.5 rounded-full bg-white" />Open my onboarding link</div>
              <div className="mt-6 max-w-[560px]"><VendorLinkLine dark /></div>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              {[
                ["For teams", [["Sign in", "/login"], ["How it works", "#how"], ["Verification", "#checks"]]],
                ["For vendors", [["Open my link", "#vendors"], ["What to prepare", "#vendors"]]],
                ["Principles", [["AI reads", "#checks"], ["Rules decide", "#checks"], ["People sign", "#checks"]]],
              ].map(([h, links]) => (
                <div key={h as string}>
                  <div className="label flex items-center gap-2 text-[15px]"><span className="size-2.5 rounded-full bg-white" />{h as string}</div>
                  <ul className="mt-5 space-y-1.5 text-[17px] tracking-[-0.015em]">
                    {(links as string[][]).map(([l, href]) => <li key={l}><a href={href} className="t-colors text-white/85 hover:text-white">{l}</a></li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="label mt-24 flex flex-wrap justify-between gap-4 border-t border-white/20 pt-6 text-white/60">
            <span>© 2026 Onboard® · Zamp PS-2</span>
            <span>Data stays in your Supabase project</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
