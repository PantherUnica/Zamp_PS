import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

type P = SVGProps<SVGSVGElement>;
export const Check = (p: P) => <svg {...base(p)}><path d="M3.5 8.5l3 3 6-7" /></svg>;
export const Cross = (p: P) => <svg {...base(p)}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>;
export const Alert = (p: P) => <svg {...base(p)}><path d="M8 5v3.5M8 11h.01" /><circle cx="8" cy="8" r="6.25" /></svg>;
export const Minus = (p: P) => <svg {...base(p)}><path d="M4.5 8h7" /></svg>;
export const Arrow = (p: P) => <svg {...base(p)}><path d="M3 8h10M9 4l4 4-4 4" /></svg>;
export const Chevron = (p: P) => <svg {...base(p)}><path d="M6 4l4 4-4 4" /></svg>;
export const FileIcon = (p: P) => <svg {...base(p)}><path d="M9 1.75H4.5a1 1 0 00-1 1v10.5a1 1 0 001 1h7a1 1 0 001-1V5.25L9 1.75z" /><path d="M9 1.75v3.5h3.5" /></svg>;
export const Upload = (p: P) => <svg {...base(p)}><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.75 10.5v2a1 1 0 001 1h8.5a1 1 0 001-1v-2" /></svg>;
export const Spark = (p: P) => <svg {...base(p)}><path d="M8 1.75l1.4 4.85L14.25 8l-4.85 1.4L8 14.25 6.6 9.4 1.75 8 6.6 6.6 8 1.75z" /></svg>;
export const Rule = (p: P) => <svg {...base(p)}><path d="M2.75 4.25h10.5M2.75 8h10.5M2.75 11.75h6" /></svg>;
export const Globe = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="6.25" /><path d="M1.75 8h12.5M8 1.75c1.8 2 1.8 10.5 0 12.5M8 1.75c-1.8 2-1.8 10.5 0 12.5" /></svg>;
export const Mail = (p: P) => <svg {...base(p)}><rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.25" /><path d="M2.25 4l5.75 4.5L13.75 4" /></svg>;
export const Link = (p: P) => <svg {...base(p)}><path d="M6.5 9.5l3-3M7 4.5l1-1a2.83 2.83 0 014 4l-1 1M9 11.5l-1 1a2.83 2.83 0 01-4-4l1-1" /></svg>;
export const Phone = (p: P) => <svg {...base(p)}><path d="M3.25 2.25h2.5l1.25 3-1.5 1a7 7 0 003.25 3.25l1-1.5 3 1.25v2.5a1 1 0 01-1 1A10.75 10.75 0 012.25 3.25a1 1 0 011-1z" /></svg>;
export const Lock = (p: P) => <svg {...base(p)}><rect x="3.25" y="7" width="9.5" height="6.75" rx="1.25" /><path d="M5.25 7V5a2.75 2.75 0 015.5 0v2" /></svg>;
export const Plus = (p: P) => <svg {...base(p)}><path d="M8 3v10M3 8h10" /></svg>;
export const User = (p: P) => <svg {...base(p)}><circle cx="8" cy="5.5" r="2.75" /><path d="M2.75 13.75c.6-2.4 2.7-4 5.25-4s4.65 1.6 5.25 4" /></svg>;
export const Database = (p: P) => <svg {...base(p)}><ellipse cx="8" cy="3.75" rx="5.25" ry="2" /><path d="M2.75 3.75v8.5c0 1.1 2.35 2 5.25 2s5.25-.9 5.25-2v-8.5M2.75 8c0 1.1 2.35 2 5.25 2s5.25-.9 5.25-2" /></svg>;
