import Link from "next/link";

/**
 * The landing hero's "warm glass" scene, after the brand renders: a frosted New Vendor card,
 * a glass cube with the four agent steps ticking in, and stacked document cards, all lit warm.
 * Pure CSS: floats and ticks are decorative and switch off under prefers-reduced-motion.
 */

const Check = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

const DocIcon = () => (
  <svg viewBox="0 0 20 20" className="size-5 text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M5 2.5h6.5L15 6v11.5H5z" strokeLinejoin="round" />
    <path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h4" strokeLinecap="round" />
  </svg>
);

const STEPS = [
  { label: "Extract", icon: "M10 3l1.6 3.9L15.5 8l-3.9 1.6L10 13.5 8.4 9.6 4.5 8l3.9-1.1z" },
  { label: "Verify", icon: "M10 2.5l6 2.2v4.6c0 3.7-2.6 6.6-6 7.7-3.4-1.1-6-4-6-7.7V4.7z" },
  { label: "Flag & Fix", icon: "M15.5 7.5A6 6 0 0 0 5 5.5M4.5 12.5A6 6 0 0 0 15 14.5M5 2.5v3h3M15 17.5v-3h-3" },
  { label: "Approve", icon: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 17c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" },
];

const DOCS = ["Udyam", "Bank proof", "PAN", "GSTIN"];

export function GlassScene() {
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[600px] sm:h-[540px]" aria-hidden>
      {/* sunlight */}
      <div className="absolute -top-10 right-0 h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(255,200,140,0.75),transparent)] blur-2xl" />
      {/* stone plinth */}
      <div className="absolute bottom-0 left-[6%] h-[70px] w-[88%] rounded-[18px] bg-gradient-to-b from-[#e8dccb] to-[#d9c9b3] shadow-[0_30px_60px_-30px_rgba(110,70,30,0.6),inset_0_1px_0_rgba(255,255,255,0.7)]" />
      <div className="glow-floor absolute bottom-[54px] left-[22%] h-10 w-[56%]" />

      {/* stacked documents, back right */}
      <div className="absolute right-[4%] bottom-[70px] w-[48%] sm:w-[44%]">
        {DOCS.map((d, i) => (
          <div
            key={d}
            className="glass-strong anim-float absolute right-0 flex h-[64px] w-full items-center gap-3 rounded-[16px] px-4"
            style={{ bottom: `${(3 - i) * 40}px`, right: `${(i - 3) * 14}px`, ["--tilt" as string]: "0deg", animationDelay: `${-i * 0.6}s`, animationDuration: "8s", zIndex: 10 + i, opacity: 0.8 + i * 0.065 }}
          >
            <DocIcon />
            <span className={`flex-1 font-semibold tracking-[-0.02em] ${i === 3 ? "text-[17px]" : "text-[15px] text-ink-2"}`}>{d}</span>
            <span className="anim-pop grid size-6 place-items-center rounded-md bg-ok text-white shadow-[0_4px_10px_-3px_rgba(77,122,53,0.7)]" style={{ animationDelay: `${900 + (3 - i) * 260}ms` }}>
              <Check className="size-3.5" />
            </span>
          </div>
        ))}
      </div>

      {/* glass cube + steps, centre */}
      <div className="absolute top-[2%] left-[4%] flex w-[92%] items-center gap-5">
        <div className="anim-float relative aspect-square w-[38%] shrink-0" style={{ ["--tilt" as string]: "-4deg", animationDuration: "9s" }}>
          <div className="glass-strong absolute inset-0 rounded-[22px] bg-gradient-to-br from-white/90 via-[#fff3e6]/70 to-[#ffd9b5]/60" />
          <div className="absolute inset-[18%] rounded-[16px] bg-[radial-gradient(closest-side,rgba(255,170,90,0.55),transparent)] blur-md" />
          <svg viewBox="0 0 40 40" className="absolute inset-[34%] text-white drop-shadow-[0_2px_4px_rgba(180,80,20,0.4)]" fill="currentColor"><path d="M8 22h16v-7l10 10-10 10v-7H8z" /></svg>
        </div>
        <ul className="flex-1 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.label} className="glass-strong anim-rise flex items-center gap-2.5 rounded-[12px] px-3 py-2" style={{ animationDelay: `${300 + i * 220}ms` }}>
              <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
              <span className="flex-1 text-[14px] font-medium">{s.label}</span>
              <Check className="anim-pop size-4 text-accent" />
            </li>
          ))}
        </ul>
      </div>

      {/* New Vendor card, front left */}
      <div className="glass-strong anim-float absolute bottom-[56px] left-[4%] w-[40%] min-w-[170px] rounded-[22px] px-5 pt-6 pb-5 text-center sm:w-[36%]" style={{ ["--tilt" as string]: "-3deg", animationDelay: "-3s", animationDuration: "7.5s", zIndex: 30 }}>
        <svg viewBox="0 0 48 40" className="mx-auto h-10 w-12" aria-hidden>
          <defs><linearGradient id="awning" x1="0" x2="1"><stop offset="0" stopColor="#c8873f" /><stop offset="1" stopColor="#e9b46a" /></linearGradient></defs>
          <path d="M6 14h36v22H6z" fill="none" stroke="#a7692d" strokeWidth="2" />
          <path d="M4 6h40l2 9H2z" fill="url(#awning)" />
          <path d="M10 6v9M18 6v9M26 6v9M34 6v9" stroke="#fff" strokeOpacity=".6" />
          <path d="M19 36V24h10v12" fill="none" stroke="#a7692d" strokeWidth="2" />
        </svg>
        <div className="mt-3 text-[19px] font-semibold tracking-[-0.03em]">New Vendor</div>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-[10px] bg-gradient-to-r from-accent to-[#f97316] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(234,88,12,0.8)]">
          Start onboarding <span aria-hidden>→</span>
        </div>
      </div>
    </div>
  );
}

/** Light hero copy, after the brand render: big headline, one line of support, two actions. */
export function HeroCopy() {
  return (
    <div className="max-w-[560px]">
      <div className="anim-rise inline-flex items-center gap-2 rounded-full border border-accent-line bg-white/70 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.02em] text-accent-hover backdrop-blur">
        <span className="size-1.5 rounded-full bg-accent anim-pulse" /> AI vendor onboarding for India
      </div>
      <h1 className="anim-rise delay-1 mt-6 text-[42px] leading-[1.02] font-bold tracking-[-0.045em] sm:text-[56px] xl:text-[64px]">
        From supplier&nbsp;call <br className="hidden sm:block" />to <span className="text-gradient">verified partner.</span>
      </h1>
      <p className="anim-rise delay-2 mt-6 max-w-[460px] text-[18px] leading-[1.5] text-ink-2">
        An agent reads GST, PAN and bank documents, checks every number and chases what&apos;s missing. Your team approves, with the evidence on screen.
      </p>
      <div className="anim-rise delay-3 mt-8 flex flex-wrap gap-3">
        <Link href="/login" data-cursor="Sign in" className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[14px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(234,88,12,0.7)] transition-transform hover:-translate-y-0.5 hover:bg-accent-hover">
          Open the workspace <span aria-hidden>→</span>
        </Link>
        <a href="#vendors" className="glass inline-flex h-12 items-center rounded-full px-6 text-[14px] font-semibold transition-colors hover:text-accent-hover">I&apos;m a vendor</a>
      </div>
      <dl className="anim-rise delay-4 mt-10 grid max-w-[460px] grid-cols-3 gap-3">
        {[
          ["8", "verification stages"],
          ["4", "evidence sources"],
          ["0", "auto-approvals"],
        ].map(([n, l]) => (
          <div key={l} className="glass rounded-[14px] px-3 py-3">
            <dt className="sr-only">{l}</dt>
            <dd className="text-[26px] leading-none font-bold tracking-[-0.04em] text-accent">{n}</dd>
            <dd className="mt-1 text-[12px] leading-tight text-muted">{l}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
