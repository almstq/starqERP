# starqERP Brand System v1.0

## Core idea
Competent, quiet infrastructure. Warmth comes from the action amber; the surrounding system stays restrained.

## Name
Always `starqERP`: lowercase `starq`, uppercase `ERP`, one word.

## Mark
The symbol is **Confluence / Course**: three record lines become one forward course. It expresses record + join + navigation without a literal star, node network, cube, or magnifier.

### Minimum size
- Standard mark: 24 px digital, 8 mm print.
- Micro mark: 16 px digital only.
- Horizontal lockup: 112 px digital, 28 mm print.

### Clear space
Keep clear space equal to 1/2 the logomark width on every side.

## Existing palette: what stays
Kept exactly from the product brief (converted to sRGB for files): background #0A1018, sidebar #050911, card #111923, foreground #E7ECF0, muted foreground #8F9AA4, accent #E09036, primary #7FBEF3, destructive #F94144. Radius remains .75rem.

## Light theme: what changes
The prior light theme was described as derived/unreviewed, so this system uses a reviewed neutral light set: background #F6F8FA, sidebar #EEF2F6, card #FFFFFF, foreground #111A24, muted #5F6C78, border #D8DEE6. The amber action remains #E09036; the blue becomes #2563A8 where dark-on-light contrast is required.

## Contrast checks
- Dark foreground on dark background: 16.05:1
- Dark muted on dark background: 6.66:1
- Dark text on amber CTA: 7.46:1
- Light foreground on light background: 16.48:1
- Light muted on light background: 5.05:1
- White on light-theme primary blue: 6.12:1
All core text combinations clear WCAG AA.

## Type
- Display/headings/figures: Lexend 500–700
- UI/body: Manrope 400–700
- Identifiers: Fira Code 400–500
- Dhivehi/Thaana: Noto Sans Thaana 400–700 where available; fall back to Noto Sans Thaana Regular.
- Money: use tabular figures; `font-variant-numeric: tabular-nums lining-nums`.

### Scale
12 / 14 / 16 / 18 / 22 / 30 / 42 / 60 px. Product H1 = 30 px Lexend 600, tracking -0.75 px.

### Thaana / RTL
Use `dir="rtl" lang="dv"` at the content container, not by flipping the entire app. Mirror directional UI icons only when their meaning depends on direction. Keep numerals and MVR values readable as isolated LTR runs inside RTL sentences. Example font: Noto Sans Thaana.

## Iconography
24 px grid, 1.8 px stroke, round caps and joins, optical radius ~2 px. Icons are monochrome by default. Semantic colour is allowed only when the icon is part of a status/message whose text repeats the meaning; never rely on colour alone.

## Colour discipline
One filled amber control per screen. Amber is action, not decoration. Status warning amber uses its own token and is never visually identical to the CTA. Green = money in/success, red = money out/cost/destructive, blue = information.

## Charts
Dark theme: #65B5FF, #F2A44B, #57C7BD, #B49AEF, #D9C35A. Light theme: #1769AA, #A55208, #087C75, #6752A8, #786300. For >3 series, pair colour with line style or point markers so hue is never the only differentiator.

## Co-branding
`starq` is the house. Product names attach directly with the product function in the same line: `starqERP`, `starqPay`. Starq Dynamics remains a service brand and should not be forced into the product-wordmark construction. On customer documents, the customer brand owns the invoice header; `Generated with starqERP` may appear in the footer.

## Never
Do not capitalize the s; do not split the name; do not add gradients to the mark; do not use amber for decorative logo fills inside product chrome; do not put customer brands in global product chrome; do not show bank/MIRA/third-party logos as integrations; do not make tax/compliance claims.
