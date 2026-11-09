# Direction: "Ledger, exact"

Stage 1 of the UI design pipeline. Handled by the `frontend-design` skill. Confirmed by the user.

**Audience.** Procurement reviewers deciding whether a vendor can be paid; vendors who need to know exactly what to fix; a Zamp interviewer watching the process run live.
**Purpose.** Make every decision traceable: what was submitted, what the documents say, which rule fired, and who signed.
**Feeling.** An audit instrument: calm, exact, and trustworthy. Nothing decorative competes with the evidence.

## Options considered
| Direction | Verdict |
|---|---|
| **Ledger, exact** (chosen) | Matches Zamp.ai (Geist, near-black neutrals, deep green #003D29). The density suits side-by-side evidence review. |
| Editorial calm | Lost. Large type and a single focus per screen hide the evidence a reviewer needs on one screen. |
| Signal red ops | Lost. Off-brand, and red collides with the "rejected / failed" semantics that must stay unambiguous. |

## The four carrying choices
1. **Type.** Geist for UI. Geist Mono for anything a machine produced or a human must compare character by character: IDs, tax IDs, IBANs, confidence scores, timestamps, evidence values. Hierarchy comes from weight (400/500/600) before size.
2. **Colour.** Neutrals do 90% of the work. There is one accent, Zamp green `#003D29`, spent on the primary action, the active nav item, and the "approved" state. Amber and red appear only inside status indicators.
3. **Density.** Compact product density. Tables and hairline-divided rows, not card grids. Numbers are right-aligned and mono.
4. **Shape.** 6px radius on controls, 8px on panels. 1px hairlines. No shadows except overlays (dialog). No gradients.

**The test that does not age:** swap the logo and it should still read as an instrument for verifying vendors, because the screens are built around evidence comparison (submitted vs. document vs. rule), not generic KPI cards.
