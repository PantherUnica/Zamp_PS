# Design System: MASTER

Stage 2 (system) and Stage 3 (motion) of the UI design pipeline. Every page reads this file.
Stage 2 used built-in guidance because `ui-ux-pro-max` is not installed. Stage 3 used built-in
guidance because `emil-design-eng` is not installed. Tokens are implemented in
`src/app/globals.css` (`@theme`). Use only these tokens.

## Type (Geist / Geist Mono, ratio about 1.2)
| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Labels, table meta, chips |
| `text-sm` | 13 / 20 | Table cells, secondary text, form help |
| `text-base` | 14 / 22 | Body, inputs, buttons |
| `text-md` | 16 / 24 | Section titles |
| `text-lg` | 20 / 28 | Page titles |
| `text-xl` | 28 / 34 | Single key figures (dashboard counts, recommendation) |

Weights: 400 body, 500 labels and buttons, 600 titles only. Mono is used for IDs, tax IDs, account
numbers, scores, timestamps, durations, and evidence values. Uppercase is used only for the 11px
`eyebrow` labels with tracking 0.04em.

## Spacing (4px base)
`1=4 · 2=8 · 3=12 · 4=16 · 6=24 · 8=32 · 12=48 · 16=64`. No other values. Page gutter: 16 (mobile), 32 (desktop).
Related rows: 8–12. Sections: 32. Panels: 16–24 padding.

## Colour roles
| Role | Value | Notes |
|---|---|---|
| `canvas` | #FAFAFA | App background |
| `surface` | #FFFFFF | Panels, tables, inputs |
| `ink` | #171717 | Primary text (contrast 17:1) |
| `ink-2` | #404040 | Secondary text |
| `muted` | #737373 | Meta text (4.7:1 on white) |
| `line` | #E5E5E5 | Hairlines |
| `line-strong` | #D4D4D4 | Input borders |
| `accent` | #003D29 | **Only accent.** Primary button, active nav, approved, focus ring |
| `accent-soft` | #E7EFEB | Approved chip background, selected row |
| `warn` / `warn-soft` | #8A5A00 / #FBF3E2 | Pending / review states only |
| `danger` / `danger-soft` | #B42318 / #FDF0EE | Rejected / failed / error only |
| `info-soft` | #F2F2F2 | Neutral chips (queued, skipped) |

Forbidden: a second accent hue, gradients, coloured backgrounds on whole sections, coloured icons outside status.

## Shape and depth
Radius: `6px` for controls (inputs, buttons, chips) and `8px` for panels. Borders: 1px `line`.
Shadow: only `overlay` (dialog/menu): `0 8px 24px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.06)`.

## Components (single voice)
- **Button:** primary (accent bg, white text), secondary (surface, line-strong border), danger (danger text, line border). Height 36, padding x 12–16, text-base 500. Disabled at 40% opacity with `not-allowed`.
- **Status chip:** 22px tall, 6px radius, text-xs 500, a 6px dot plus a label. Colour comes from the status map only.
- **Panel:** surface, 1px line, 8px radius. Header row: text-md 600 with optional right-aligned meta.
- **Table:** header text-xs muted, rows 44px, hairline separators, numeric and mono values right-aligned.
- **Focus-visible:** 2px accent outline, 2px offset, on every interactive element.

## Status map
| State | Chip |
|---|---|
| approved / passed | accent |
| awaiting_review, awaiting_vendor, pending, warning | warn |
| rejected, failed, error | danger |
| processing / running | ink, animated dot |
| queued, skipped, draft | neutral |

## Breakpoints
`sm 640 · md 768 · lg 1024 · xl 1280`. Sidebar navigation from `lg`, top bar below. Evidence tables collapse to stacked rows below `md`.

## Motion (stage 3)
| Element | Trigger | Duration | Easing | Reason |
|---|---|---|---|---|
| Stage row status icon/colour | Stage state changes during a live run | 160ms | ease-out | Shows a state change as it happens in the live view |
| Running stage dot | Stage is running | 1.2s loop opacity | ease-in-out | Tells the viewer which stage is executing now |
| Stage output panel | Stage completes (first reveal) | 180ms opacity + 4px translate | ease-out | Connects the new output to the stage that produced it |
| Dialog | Open | 160ms opacity + scale .98→1 | ease-out | Spatial cue that the decision is modal |
| Buttons / rows hover | Hover | 120ms colour | ease-out | Feedback on a frequent action, colour only |

Not animated: page navigation, tables, counts, nav, form fields. `prefers-reduced-motion` disables all of the above except colour changes.
