# UI review checklist

Use this when reviewing UI code (yours or someone else's). Report findings as
`file:line - problem → fix`, grouped by file, and say "✓ pass" for files with
none. Skip explanations unless the fix is not obvious.

Adapted from Vercel's [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
(commit 434b7f9, MIT, Copyright (c) 2025 Vercel Labs), with WCAG 2.2 additions
adapted from Addy Osmani's [web-quality-skills](https://github.com/addyosmani/web-quality-skills)
(MIT, Copyright (c) 2026 Addy Osmani). Rules were reordered and edited; any
mistakes are ours. Licenses: `NOTICE.md`.

## Accessibility

- `<button>` for actions, `<a>`/`<Link>` for navigation; never `<div onClick>`.
- Semantic HTML (`<button>`, `<a>`, `<label>`, `<table>`, `<ul>`) before ARIA.
- Icon-only buttons need `aria-label` that names the target ("Remove Ada"); the
  icon gets `aria-hidden="true"`.
- Form controls need a `<label>` or `aria-label`; a placeholder is not a label.
- Images need `alt` (`alt=""` if decorative).
- Async updates (toasts, validation, "removed") need `aria-live="polite"` or
  `role="status"`; blocking errors `role="alert"`.
- One `<h1>`, hierarchical headings; a skip link to main content on full pages.
- `scroll-margin-top` on heading anchors when there is a sticky header.
- Text contrast at least 4.5:1 (3:1 for large text and UI component borders).
- Target size at least 24×24 CSS px (WCAG 2.2 2.5.8).
- Dragging (reorder, sliders) has a click or keyboard alternative (2.5.7).
- `<html lang>` is set; content in another language gets `lang` on its element.
- Modals: focus moves in on open, is trapped while open, returns to the
  trigger on close; Escape closes. Prefer the native `<dialog>` element.

## Focus

- Every interactive element shows visible focus (`:focus-visible` ring).
- Never `outline: none` / `outline-none` without a replacement.
- `:focus-visible` over `:focus` (no ring on mouse click).
- `:focus-within` for compound controls (search box with icon).
- Sticky headers, footers and overlays must not cover the focused element
  (WCAG 2.2 2.4.11).
- After removing the focused element, move focus to a sensible neighbor.

## Forms

- Wrap inputs in a `<form>` with `onSubmit` so Enter submits.
- Correct `type` (`email`, `tel`, `url`, `number`, `search`) and `inputmode`.
- Meaningful `name` and `autocomplete` (`email`, `name`, `current-password`, …).
- Never block paste.
- Labels are clickable (`htmlFor` or wrapping the control).
- `spellCheck={false}` on emails, codes and usernames.
- Checkbox/radio and its label share one hit target.
- The submit button stays enabled until the request starts, then shows progress
  and blocks double submit.
- Errors appear inline next to the field and say how to fix it; focus the first
  invalid field on submit. Keep what the user typed after an error.
- Warn before leaving with unsaved changes.
- Do not ask for the same information twice in one flow (3.3.7); allow paste
  and password managers in sign-in (3.3.8).

## Animation

- Honor `prefers-reduced-motion`.
- Animate `transform` and `opacity` only.
- Never `transition: all`; list properties.
- Animations can be interrupted by user input.
- Auto-playing motion longer than 5 s needs pause/stop.

## Typography and copy

- `…` not `...`; loading labels end with `…` ("Saving…").
- `font-variant-numeric: tabular-nums` for number columns.
- `text-wrap: balance` on headings.
- Active voice, second person, specific button labels ("Save API key", not
  "Continue"); error messages include the next step.
- Numerals for counts ("8 members").

## Content handling

- Text containers handle long content: wrap (`overflow-wrap: anywhere`) or
  truncate with the full value reachable.
- Flex children with text need `min-width: 0`.
- Empty strings and empty arrays render a designed empty state, not broken UI.
- Plan for short, average and very long user content.

## Images and media

- `<img>` has explicit `width` and `height` (no layout shift).
- Below-the-fold images `loading="lazy"`; the hero/LCP image `fetchpriority="high"`.
- Prefer `<video autoplay muted loop playsinline>` over animated GIF.

## Performance

- Lists over a few hundred items: virtualize or `content-visibility: auto`.
- No layout reads (`getBoundingClientRect`, `offsetHeight`) during render.
- Controlled inputs must be cheap per keystroke.
- `<link rel="preconnect">` for asset/CDN origins; preload critical fonts with
  `font-display: swap`.

## Navigation and state

- The URL reflects shareable state: filters, tabs, pagination, search.
- Links are real links (Cmd/Ctrl-click and middle-click work).
- Destructive actions need a confirmation or an undo window.

## Touch and layout

- No horizontal page scroll at 375 px.
- `touch-action: manipulation`; `overscroll-behavior: contain` in modals and drawers.
- Full-bleed layouts respect `env(safe-area-inset-*)`.
- Flex/grid over JavaScript measurement.
- `autoFocus` sparingly, never on mobile without reason.

## Theming

- `color-scheme: dark` on `<html>` for dark themes.
- `<meta name="theme-color">` matches the background.
- Native `<select>` gets explicit `background-color` and `color`.

## Locale

- Dates and numbers through `Intl.DateTimeFormat` / `Intl.NumberFormat`.
- `translate="no"` on brand names and code tokens.

## Hydration (SSR frameworks)

- Inputs with `value` need `onChange` (or use `defaultValue`).
- Guard date/time and random values against server/client mismatch.
- `suppressHydrationWarning` only where truly needed.

## Anti-patterns to flag

- `user-scalable=no` or `maximum-scale=1`
- `onPaste` with `preventDefault`
- `transition: all`
- `outline: none` without a focus-visible replacement
- `<div>`/`<span>`/`<li>` with click handlers
- Images without dimensions
- Inputs without labels; icon buttons without names
- Hardcoded date or number formats
- Gesture-only actions
- A second, hand-rolled version of a component the project already has
