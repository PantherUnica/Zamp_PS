# Design System v2: MASTER

Stage 2 (system) and stage 3 (motion) of the UI design pipeline, with built-in guidance (`ui-ux-pro-max` and `emil-design-eng` are not installed). Implemented in `src/app/globals.css` (`@theme`). Pages use only these tokens.

## Type
| Token | px / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Labels, chips, table meta |
| `text-sm` | 13 / 20 | Table cells, help text |
| `text-base` | 14 / 22 | Body, inputs, buttons |
| `text-md` | 16 / 24 | Section titles, portal inputs |
| `text-lg` | 20 / 28 | Page titles |
| `text-xl` | 28 / 34 | Key figures |
| `font-display` 40–56 | Instrument Serif | Landing headline, vendor welcome only |

## Colour roles
| Role | Value | Rule |
|---|---|---|
| canvas | #FAFAF9 | App background |
| surface | #FFFFFF | Panels, inputs |
| subtle | #F5F5F4 | Hover rows, segmented controls |
| ink / ink-2 / muted | #1C1917 / #44403C / #78716C | Text (muted is 4.8:1 on white) |
| line / line-strong | #E7E5E4 / #D6D3D1 | Hairlines / input borders |
| **accent** | #C2410C (hover #9A3412, soft #FFF4ED, line #FED7AA) | **Needs a human.** One primary action per screen, attention statuses, live dot |
| ok / ok-soft | #166534 / #F0FDF4 | Approved, passed |
| danger / danger-soft | #B91C1C / #FEF2F2 | Rejected, failed, errors |

Forbidden: a second accent hue, gradients, coloured section backgrounds, orange for success.

## Evidence sources (verification UI)
| Source | Label | Meaning |
|---|---|---|
| format | Format | Well-formed and the checksum is right. Does not mean it exists |
| document | Document | Compared with an uploaded document |
| external | External record | Checked against a record outside this system |
| internal | Our records | Compared with other vendors in this system |
| not connected | Not connected | Shown explicitly; never counted as passed |

## Components
Buttons: `primary` (orange, at most one per view), `dark` (ink), `secondary` (white with border), `ghost`, `danger`. Height 36 (32 for sm). Chips are 22px with a 6px dot. Panels have a 10px radius and 1px line. Focus ring: 2px accent with 2px offset.

## Motion
| Element | Trigger | Duration | Easing | Reason |
|---|---|---|---|---|
| Stage icon/colour | Live run state change | 160ms | ease-out | Shows the change as it happens |
| Live dot | Something is running | 1.2s loop | ease-in-out | Where the system is working now |
| Stage output reveal | Stage completes | 180ms opacity + 4px | ease-out | Ties output to its stage |
| Dialog / sheet | Open | 160ms opacity + scale .98 | ease-out | Modal decision |
| Portal step change | Next/back | 180ms opacity | ease-out | Keeps place in a long form |
| Save indicator | Autosave | 120ms colour | ease-out | Confirms progress without a toast |

`prefers-reduced-motion` disables all of the above except colour changes.
