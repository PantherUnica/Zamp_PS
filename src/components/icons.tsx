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

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 8.5l3 3 6-7" /></svg>
);
export const Cross = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
);
export const Alert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 5v3.5M8 11h.01" /><circle cx="8" cy="8" r="6.25" /></svg>
);
export const Arrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
);
export const Chevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 4l4 4-4 4" /></svg>
);
export const FileIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 1.75H4.5a1 1 0 00-1 1v10.5a1 1 0 001 1h7a1 1 0 001-1V5.25L9 1.75z" /><path d="M9 1.75v3.5h3.5" /></svg>
);
export const Upload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.75 10.5v2a1 1 0 001 1h8.5a1 1 0 001-1v-2" /></svg>
);
export const Spark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 1.75l1.4 4.85L14.25 8l-4.85 1.4L8 14.25 6.6 9.4 1.75 8 6.6 6.6 8 1.75z" /></svg>
);
export const Rule = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2.75 4.25h10.5M2.75 8h10.5M2.75 11.75h6" /></svg>
);
