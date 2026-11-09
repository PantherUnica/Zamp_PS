"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A soft circle that follows the pointer and shows a verb ("DRAG", "SIGN IN", "OPEN")
 * over elements marked with data-cursor="LABEL". Fine pointers only; off for reduced motion.
 */
export function CursorFollower() {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    let x = -200, y = -200, tx = -200, ty = -200, raf = 0;
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor]");
      setLabel(target?.dataset.cursor ?? null);
    };
    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    const leave = () => setLabel(null);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed top-0 left-0 z-[60] hidden [@media(pointer:fine)]:block">
      <div
        className={`grid size-[112px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f7cdb4] text-[13px] font-semibold tracking-[-0.01em] text-ink uppercase transition-[transform,opacity] duration-300 ease-out ${label ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
      >
        {label}
      </div>
    </div>
  );
}

/** Horizontal rail you can drag with the mouse (and scroll/swipe natively). */
export function DragRail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let down = false, startX = 0, startLeft = 0, moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.classList.add("cursor-grabbing");
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      down = false;
      el.classList.remove("cursor-grabbing");
    };
    const onClick = (e: MouseEvent) => {
      if (moved) e.preventDefault();
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("click", onClick, true);
    };
  }, []);
  return (
    <div ref={ref} data-cursor="Drag" className="no-scrollbar flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto pb-2 select-none sm:gap-10">
      {children}
    </div>
  );
}

/** Fades content up the first time it scrolls into view. */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${className}`}>
      {children}
    </div>
  );
}

/** Newsletter-style underline field where vendors paste their onboarding link. */
export function VendorLinkLine({ dark }: { dark?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const token = /([a-f0-9]{48})/.exec(value.trim())?.[1];
        if (!token) return setError("Paste the full link from your invitation email.");
        router.push(`/v/${token}`);
      }}
    >
      <label htmlFor={dark ? "link-dark" : "link"} className="sr-only">Onboarding link</label>
      <div className={`flex items-center border-b ${dark ? "border-white/60 focus-within:border-white" : "border-ink/70 focus-within:border-ink"}`}>
        <input
          id={dark ? "link-dark" : "link"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste your onboarding link"
          className={`h-14 min-w-0 flex-1 bg-transparent text-lg outline-none ${dark ? "text-white placeholder:text-white/60" : "placeholder:text-ink/45"}`}
        />
        <button type="submit" aria-label="Open my onboarding form" className={`grid size-10 place-items-center ${dark ? "text-white" : "text-ink"}`}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11h16M13 5l6 6-6 6" /></svg>
        </button>
      </div>
      {error && <p className={`mt-2 text-sm ${dark ? "text-[#f7cdb4]" : "text-danger"}`}>{error}</p>}
    </form>
  );
}
