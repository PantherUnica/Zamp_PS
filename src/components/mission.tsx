"use client";
/**
 * Mission-control infographics for the internal dashboard. Every animation is decorative:
 * the final values are in the server-rendered markup, and prefers-reduced-motion skips motion.
 */
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** True one frame after mount, so CSS transitions run from their zero state. */
function useArmed(delay = 0) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let raf = 0;
    const t = setTimeout(() => (raf = requestAnimationFrame(() => setOn(true))), delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [delay]);
  return on;
}

/** Number that counts up from zero. Renders the final value on the server. */
export function CountUp({ value, duration = 900, className = "" }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced() || value === 0) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      el.textContent = String(Math.round(ease(p) * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = "0";
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = String(value);
    };
  }, [value, duration]);
  return (
    <span ref={ref} className={`mono tabular-nums ${className}`}>
      {value}
    </span>
  );
}

// ---------------------------------------------------------------- live pipeline
export type DotTone = "ok" | "attention" | "danger" | "neutral" | "live";
const DOT: Record<DotTone, string> = {
  ok: "bg-ok",
  attention: "bg-accent",
  danger: "bg-danger",
  neutral: "bg-clay",
  live: "bg-accent anim-pulse ring-4 ring-accent/20",
};

export function Pipeline({ stages }: { stages: { label: string; vendors: { id: string; name: string; tone: DotTone; status: string }[] }[] }) {
  const total = stages.reduce((n, s) => n + s.vendors.length, 0);
  return (
    <div className="relative">
      {/* the conveyor: packets travel left to right behind the stage columns */}
      <div aria-hidden className="pointer-events-none absolute inset-x-4 top-[58px] h-px bg-line-strong">
        {total > 0 && [0, 1, 2].map((i) => <span key={i} className="anim-packet absolute -top-[2px] size-[5px] rounded-full bg-accent" style={{ animationDelay: `${i * 1.6}s` }} />)}
      </div>
      <ol className="relative grid grid-cols-3 gap-px sm:grid-cols-6">
        {stages.map((s, si) => (
          <li key={s.label} className="min-h-[148px] px-4 pt-4 pb-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label truncate text-muted">{s.label}</span>
              <CountUp value={s.vendors.length} className="text-lg" />
            </div>
            <div className="relative z-[1] mt-[22px] grid size-3 place-items-center rounded-full border border-line-strong bg-surface">
              <span className={`size-1.5 rounded-full ${s.vendors.length ? "bg-accent" : "bg-line-strong"}`} />
            </div>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${s.vendors.length} vendors in ${s.label}`}>
              {s.vendors.slice(0, 18).map((v, i) => (
                <li key={v.id} className="anim-flow-in" style={{ animationDelay: `${si * 110 + i * 35}ms` }}>
                  <Link href={`/vendors/${v.id}`} title={`${v.name} · ${v.status}`} aria-label={`${v.name}: ${v.status}`} className="group grid size-4 place-items-center">
                    <span className={`block size-2.5 rounded-full transition-transform duration-150 group-hover:scale-150 ${DOT[v.tone]}`} />
                  </Link>
                </li>
              ))}
              {s.vendors.length > 18 && <li className="mono text-xs text-muted">+{s.vendors.length - 18}</li>}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- donut of checks
export function CheckDonut({ checks }: { checks: { pass: number; warn: number; fail: number; skip: number } }) {
  const on = useArmed(150);
  const segs = [
    { key: "pass", label: "Passed", value: checks.pass, color: "var(--color-ok)" },
    { key: "warn", label: "Flagged", value: checks.warn, color: "var(--color-accent)" },
    { key: "fail", label: "Failed", value: checks.fail, color: "var(--color-danger)" },
    { key: "skip", label: "Not connected", value: checks.skip, color: "var(--color-line-strong)" },
  ];
  const total = segs.reduce((n, s) => n + s.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  const offsets = segs.map((_, i) => segs.slice(0, i).reduce((n, s) => n + (total ? (s.value / total) * C : 0), 0));
  return (
    <div className="flex items-center gap-6 px-4 py-5">
      <div className="relative size-[132px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${total} checks: ${segs.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(", ")}`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-subtle)" strokeWidth="10" />
          {total > 0 &&
            segs.map((s, i) => {
              const len = (s.value / total) * C;
              return (
                <circle
                  key={s.key}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="10"
                  strokeDasharray={`${on ? Math.max(0, len - 1.2) : 0} ${C}`}
                  strokeDashoffset={-offsets[i]}
                  className="transition-[stroke-dasharray] duration-[1100ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <CountUp value={total} className="text-2xl leading-none" />
          <span className="mt-1 text-[11px] text-muted">checks</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 truncate text-ink-2">{s.label}</span>
            <CountUp value={s.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- health gauge
export function HealthGauge({ value, runs }: { value: number | null; runs: number }) {
  const on = useArmed(250);
  const v = value ?? 0;
  const L = Math.PI * 40; // half circumference
  const angle = -90 + (on ? v : 0) * 1.8;
  const tone = value == null ? "var(--color-line-strong)" : v >= 80 ? "var(--color-ok)" : v >= 55 ? "var(--color-accent)" : "var(--color-danger)";
  return (
    <div className="flex flex-col items-center px-4 pt-5 pb-4">
      <svg viewBox="0 0 100 58" className="w-full max-w-[220px]" role="img" aria-label={value == null ? "No checks ran this week" : `${v}% of decisive checks passed`}>
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--color-subtle)" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${on ? (v / 100) * L : 0} ${L}`}
          className="transition-[stroke-dasharray] duration-[1200ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
        />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50px 50px" }} className="transition-transform duration-[1200ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none">
          <line x1="50" y1="50" x2="50" y2="17" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="3.5" fill="var(--color-ink)" />
      </svg>
      <div className="-mt-1 text-center">
        {value == null ? <span className="mono text-2xl text-muted">-</span> : <span className="text-2xl"><CountUp value={v} />%</span>}
        <p className="mt-1 text-xs text-muted">{runs ? `of decisive checks passed across ${runs} run${runs === 1 ? "" : "s"}` : "No verification runs this week"}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- what the agent caught
const SEV: Record<string, { bar: string; label: string }> = {
  block: { bar: "bg-danger", label: "Hard stop" },
  review: { bar: "bg-accent", label: "Needs a human" },
  fixable: { bar: "bg-amber", label: "Vendor can fix" },
};

export function CaughtBars({ items }: { items: { code: string; title: string; count: number; severity: string }[] }) {
  const on = useArmed(200);
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-muted">Nothing flagged this week. Every finding the agent raises will be tallied here.</p>;
  return (
    <ul className="space-y-3 px-4 py-4">
      {items.map((it, i) => (
        <li key={it.code}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" title={it.code}>{it.title}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="text-[11px] text-muted">{SEV[it.severity]?.label ?? it.severity}</span>
              <CountUp value={it.count} />
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-subtle">
            <div
              className={`h-full rounded-full ${SEV[it.severity]?.bar ?? "bg-ink"} transition-[width] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none`}
              style={{ width: on ? `${(it.count / max) * 100}%` : "0%", transitionDelay: `${i * 70}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- team scoreboard
type Mate = { id: string; name: string; flags: number; corrections: number; calls: number; invites: number };
const score = (t: Mate) => t.flags + t.corrections * 2 + t.calls + t.invites;

export function Scoreboard({ team, meId }: { team: Mate[]; meId: string }) {
  const on = useArmed(300);
  const top = Math.max(1, ...team.map(score));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="label text-left text-muted">
            <th className="px-4 py-2.5 font-semibold">#</th>
            <th className="py-2.5 font-semibold">Teammate</th>
            <th className="px-2 py-2.5 text-right font-semibold" title="Findings raised on vendors they own">Flags</th>
            <th className="px-2 py-2.5 text-right font-semibold">Fixes sent</th>
            <th className="px-2 py-2.5 text-right font-semibold">Calls</th>
            <th className="px-4 py-2.5 text-right font-semibold">Invites</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {team.map((t, i) => (
            <tr key={t.id} className={`anim-flow-in ${t.id === meId ? "bg-accent-soft/60" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              <td className="mono px-4 py-2.5 text-muted">{i === 0 && score(t) > 0 ? <span aria-label="Leading" className="text-amber">★</span> : i + 1}</td>
              <td className="py-2.5">
                <span className="truncate font-medium">{t.name}{t.id === meId ? <span className="text-muted"> (you)</span> : null}</span>
                <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-amber transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: on ? `${(score(t) / top) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }} />
                </div>
              </td>
              <td className="px-2 py-2.5 text-right"><CountUp value={t.flags} /></td>
              <td className="px-2 py-2.5 text-right"><CountUp value={t.corrections} /></td>
              <td className="px-2 py-2.5 text-right"><CountUp value={t.calls} /></td>
              <td className="px-4 py-2.5 text-right"><CountUp value={t.invites} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- celebration burst
/** Confetti from a point (defaults to screen centre). No-op under reduced motion. */
export function celebrate(origin?: { x: number; y: number }) {
  if (typeof window === "undefined" || reduced()) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "80" });
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);
  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight / 2;
  const colors = ["#166534", "#c2410c", "#252422", "#f7cdb4", "#86efac"];
  const parts = Array.from({ length: 110 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const sp = 5 + Math.random() * 9;
    return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0] };
  });
  const t0 = performance.now();
  const frame = (t: number) => {
    const age = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - age / 1800);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (age < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
