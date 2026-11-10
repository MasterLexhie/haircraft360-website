# Haircraft360 design system: "Plum Lounge"

This is the visual language for the Haircraft360 prototype. It follows the *style* of a premium salon-chain site:
- an editorial light serif with an italic accent word
- tracked uppercase labels
- deep plum fills
- blush panels
- near-square corners

It does **not** reuse any reference brand's logo, copy, imagery or offers. All content stays Haircraft360's own, and demo values are still labelled.

- **Live reference:** `/styleguide`, which renders every token and component below.
- **Source of truth:** `src/app/globals.css` (tokens and type roles) and `src/components/ui/primitives.tsx` (components).

## 1. Brand basis

The palette comes from the supplied **pink/black logo colourway**, with lilac `#F8BCF8` on a black badge. The badge (`public/brand/logo-pink-full.webp`) is used unaltered as the round mark. The orange and black colourways remain in `public/brand` but are no longer used on the site.

## 2. Colour tokens

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | `#FDFAFC` | Page ground | — |
| `--surface` | `#FFFFFF` | Cards, inputs, header | — |
| `--sand` | `#F5EFF1` | Soft blush sections, hero, photo placeholders | — |
| `--sand-2` | `#EBE1E5` | Blush panels, card title strips, preview bar | — |
| `--ink` | `#2B2029` | Body text | 15.1:1 on bg |
| `--ink-2` | `#4E404C` | Secondary text | 9.4:1 |
| `--ink-3` | `#6F5F6C` | Hints, captions | 5.7:1 on bg, 4.7:1 on sand-2 |
| `--line` / `--line-strong` | `#ECDFE5` / `#D3BCC5` | Dividers and borders | — |
| `--accent` | `#513650` | **Plum**: primary buttons, headings, selected states, footer, promo band | white on it 10.5:1 |
| `--accent-hover` | `#6B4769` | Hover on plum fills | — |
| `--accent-soft` | `#F3E8EE` | Icon discs, selected-row tint | — |
| `--accent-text` | `#513650` | Plum text on light grounds | 10.2:1 |
| `--lilac` | `#F8BCF8` | Logo lilac. **Only on plum/night grounds** (italic accents, footer labels, focus ring) | 8.6:1 on night, 6.8:1 on plum |
| `--night` | `#3E283D` | Deepest plum: closing CTA band | — |
| `--on-night` / `--on-night-2` | `#FDFAFC` / `#E4D4DE` | Text on plum | 7.4:1 or better |

Status colours (`success`, `warning`, `danger`, `info` and their `-soft` versions) are unchanged. Status is always shown with **text plus a dot or icon**, never colour alone.

**Rules**
- Plum is the only brand fill. Lilac never sits on white or blush, because it fails contrast there.
- A page alternates grounds `bg → sand → bg → plum` to separate sections, rather than using heavy borders.

## 3. Typography

| Role | Font | Spec | Where |
|---|---|---|---|
| **Display** (`.type-display`) | Playfair Display 300 | 2.1–4rem, line-height 1.06, plum; `<em>` = italic 400 | Hero and section headlines, page titles |
| **Caps** (`.type-caps`) | Montserrat 700 | Uppercase, letter-spacing 0.16em, 0.7–0.95rem | Eyebrows, card title strips, nav, footer labels |
| **Caps headline** | Montserrat 700 | Uppercase, letter-spacing 0.18em, 1.7–2.4rem | One "Welcome to Haircraft360" headline per page |
| **Body** | Montserrat 400 | 16px, line-height 1.6, `--ink`/`--ink-2` | Paragraphs |
| **Button / link-caps** | Montserrat 700 | Uppercase, letter-spacing 0.14–0.16em, 0.7–0.8rem | Buttons, `.link-caps` text links |
| **Numbers** | Playfair italic | — | Step numbers ("01"), the "360" in the wordmark |

**Pattern:** write headlines as a plain phrase plus one italic word, for example "Loc services to *book* online". Use the italic once per headline.

**Wordmark:** "HAIRCRAFT" in tracked Montserrat caps, followed by "360" in Playfair italic. The round badge sits on its left.

## 4. Shape, depth, spacing

- **Radius:**
  - `--radius` is 4px for cards, panels and alerts.
  - `--radius-control` is 3px for buttons and inputs.
  - Pills (`rounded-full`) only for status badges and icon discs.
- **Shadow:** `--shadow-sm` for resting cards and `--shadow-md` for hover or selected. Shadows are plum-tinted and very soft.
- **Borders:** cards prefer a shadow or a blush title strip over an outline. The selected state is a 2px plum outline.
- **Spacing:** 4px base; sections use `py-16` on mobile and `py-24` on desktop; content width is `max-w-6xl` with a 16/24px gutter.

## 5. Components (`src/components/ui/primitives.tsx`)

**Buttons:** all variants use uppercase tracked labels, 2px borders, a minimum height of 40–48px and a 1px press nudge.

| Variant | Look | Use |
|---|---|---|
| `primary` | Plum fill, white label | One main action per view ("Book appointment", "Continue") |
| `secondary` | Plum outline, plum label | Paired with primary ("See services"); toggles such as "Add to booking" |
| `light` | White fill, plum label; hover is lilac | Primary action on plum or night bands |
| `ghost` | Text only | Low-emphasis actions |
| `danger` | Red outline | Cancel, no-show |
| `night` | Deep plum fill | Admin utility actions |

**Other components:**
- **SectionHeading:**
  - `variant="serif"` (default) or `"caps"`.
  - `align="left" | "center"`.
  - An optional caps eyebrow.
- **Service card:**
  1. a blush caps title strip
  2. a 16:9 photo slot
  3. the italic number and demo tag
  4. the description
  5. price and duration
  6. a full-width secondary button, which turns primary when selected
- **Photo placeholder:** a hatched blush panel with a caption saying "Photo placeholder · …". Its aspect ratio is reserved so a real photo causes no layout shift.
- **Promo band:** a full-width plum strip with tracked caps and a lilac underlined link. It must state only true facts; offers need owner approval.
- **Arch intro** (`.arch-top`): a blush backdrop with a curved bottom behind a centred caps headline.
- **Header:**
  - a white sticky bar with a soft plum shadow
  - caps nav links with a lilac underline on hover and for the current page
  - a plum "Book now" button
- **Footer:** a plum ground, the wordmark in its dark tone, lilac caps column labels, and a short serif tagline.
- **Inputs:**
  - a 3px radius and a `line-strong` border
  - on focus, a plum border plus a 2px plum ring
  - errors in red, with an icon, shown below the field
- **Focus:** a global 3px plum outline (lilac on plum grounds), declared in `@layer base` so a component can opt out for headings it focuses programmatically.

## 6. Accessibility guarantees

- All text pairs meet WCAG AA, with figures in the table above.
- Touch targets are at least 44px, including nav links, footer links and caps links.
- Uppercase is used only for short labels; body copy is sentence case.
- `prefers-reduced-motion` disables smooth scroll and transitions.

## 7. Do / don't

- **Do:**
  - Keep one italic word per serif headline.
  - Keep demo and placeholder labels visible.
  - Keep plum as the single brand fill.
- **Don't:**
  - Recolour or crop the logo artwork.
  - Put lilac text on light grounds.
  - Invent offers, testimonials or statistics to fill reference-style sections. Leave the section out until the owner supplies real content.
