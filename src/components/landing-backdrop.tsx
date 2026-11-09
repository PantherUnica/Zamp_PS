"use client";
import { useEffect, useRef } from "react";

/**
 * Landing backdrop: a quiet dot field that a slow diagonal "verification scan" sweeps across.
 * Dots the scan passes darken briefly; now and then one turns orange and sends out a ring,
 * a check completing. Canvas only, pauses when hidden, static for reduced-motion users.
 */
export function LandingBackdrop({ tone = "light" }: { tone?: "light" | "dark" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = 26;
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let running = true;
    const pulses: { x: number; y: number; t: number }[] = [];
    let lastPulse = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / GAP) + 1;
      rows = Math.ceil(h / GAP) + 1;
      if (reduce) draw(0);
    };

    // Deterministic per-dot jitter so the field feels organic but stable.
    const seed = (i: number, j: number) => {
      const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    function draw(time: number) {
      ctx!.clearRect(0, 0, w, h);
      const period = 9000;
      const span = w + h;
      const scan = reduce ? -1e9 : ((time % period) / period) * (span + 400) - 200; // position along x+y
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * GAP + (seed(i, j) - 0.5) * 3;
          const y = j * GAP + (seed(j, i) - 0.5) * 3;
          const d = Math.abs(x + y * 0.6 - scan);
          const glow = Math.max(0, 1 - d / 140);
          const alpha = 0.11 + glow * 0.38;
          const r = 1 + glow * 0.7;
          ctx!.beginPath();
          ctx!.arc(x, y, r, 0, Math.PI * 2);
          ctx!.fillStyle = tone === "dark" ? `rgba(242,241,238,${alpha * 0.9})` : `rgba(214,96,30,${alpha * 0.75})`;
          ctx!.fill();
        }
      }
      // Orange "check complete" pulses, spawned just behind the scan line.
      if (!reduce && time - lastPulse > 650 && scan > 0) {
        lastPulse = time;
        const i = Math.floor(Math.random() * cols);
        const x = i * GAP;
        const y = (scan - x) / 0.6;
        if (y > 0 && y < h) pulses.push({ x, y: Math.round(y / GAP) * GAP, t: time });
      }
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        const age = (time - p.t) / 1800;
        if (age >= 1) {
          pulses.splice(k, 1);
          continue;
        }
        const fade = 1 - age;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(194,65,12,${0.85 * fade})`;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 3 + age * 22, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(194,65,12,${0.35 * fade})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }
    }

    const loop = (t: number) => {
      if (running) draw(t);
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      running = document.visibilityState === "visible";
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVis);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tone]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_60%_75%_at_68%_38%,#000_30%,transparent_78%)]"
    />
  );
}
