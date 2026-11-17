---
name: senior-frontend
description: "You MUST use this whenever you build, change or review user interface code, including small UI tweaks and when the user is in a hurry: pages, components, forms, lists, tables, modals, navigation, layout or styling in React, Next.js, Vue, Svelte, Astro or plain HTML/CSS/Tailwind. Reuse the project's own components and tokens, design every state (loading, empty, error, long content), make it work with a keyboard and a screen reader and at phone width, then open it in a real browser and check it before saying it is done."
license: MIT
metadata:
  author: claude-code-templates
  version: "2.0.0"
  sources: "Vercel Web Interface Guidelines and agent-skills (MIT), Addy Osmani web-quality-skills (MIT), React docs; see references/"
---

# Senior Frontend

A senior frontend engineer is not faster at typing JSX. They read the codebase
before writing, they think about the states nobody asked for, they use the
keyboard to try what they built, and they look at it in a browser before they
say it works. This skill is that habit, written down.

**Core rule: the UI is not done until you have seen it work in a browser,
including the unhappy paths.** A passing typecheck says nothing about whether
the button can be reached with Tab or whether a long name breaks the layout on
a phone.

## 1. Read the project before you write

Spend the first minutes reading, not writing. Find and use:

- **The stack and its versions**: framework, router, React version (18 vs 19
  changes `forwardRef`, `use`, actions), TypeScript strictness.
- **The existing components**: if the project has a `Button`, `Input`, `Dialog`
  or design-system package, use it. Never hand-roll a second button.
- **The tokens**: colors, spacing, radius and type scale already defined
  (CSS variables, Tailwind theme, theme object). New hex values or magic pixel
  numbers in a project that has tokens are a bug.
- **The data layer**: the API helpers, query library (TanStack Query, SWR,
  server components, loaders) and how errors are already handled.
- **The scripts**: `typecheck`, `lint`, `test`, `build`, `dev`. You will run them.
- **A sibling page or component** that does something similar. Match its
  structure and naming.

Ask the user before you add a dependency (UI kit, icon set, state library,
date library). The platform and the project usually already have what you need.

## 2. List the states before you build

Every piece of UI that shows data or takes input has more states than the happy
path. Write them down for the feature, then build each one:

| State | What the user must see |
|-------|------------------------|
| Loading | A placeholder or "Loading…" with `aria-busy` or `role="status"`; no layout jump when data arrives |
| Empty | A sentence that says why it is empty and what to do ("No members match "zz". Clear the search.") |
| Error | What failed, in plain words, and a way out (Retry, or a link). Never a blank area or a console-only error |
| Success / done | Confirmation that the action happened, announced to screen readers |
| Pending action | The control shows progress and is disabled only while the request runs; no double submit |
| Long and odd content | Very long names, emails and words wrap or truncate; 0, 1 and 500 items all look right |
| Partial failure | One row's action failing does not break the rest of the list |

If the API helper can fail (it always can), the UI must handle the rejection.
Look for a way the project lets you force failures (a mock flag, a query
parameter, a dev toggle) so you can see the error state yourself.

## 3. Build with the platform first

Semantic HTML gives you keyboard support, focus, and screen-reader names for
free. Reach for ARIA only when no element does the job.

- `<button>` for actions, `<a href>` / the router's `Link` for navigation.
  Never `<div onClick>`.
- Every input has a visible `<label>` (or at minimum `aria-label`), the right
  `type` (`email`, `tel`, `url`, `search`), `name` and `autocomplete`.
- Inputs that submit live inside a `<form>` with `onSubmit`, so Enter works.
- Icon-only buttons need an accessible name that says what and which:
  `aria-label="Remove Ada Lovelace"`, not `"Delete"` repeated twelve times.
  The icon itself gets `aria-hidden="true"`.
- One `<h1>` per page, headings in order, lists as `<ul>`/`<ol>`, tables as
  `<table>` with `<th scope>`.
- Async results (saved, removed, failed) go in an `aria-live="polite"` region
  or `role="status"`; blocking errors in `role="alert"`.
- Visible focus on everything interactive (`:focus-visible`); never remove an
  outline without a replacement.
- Images have `alt` (empty for decorative ones) and explicit `width`/`height`.
- Destructive actions need a confirmation or an undo window, never an
  immediate irreversible delete. After a removal, move focus somewhere sensible
  (the next row or the list heading), not to `<body>`.

The full checklist, with forms, motion, typography, i18n and touch rules, is in
`references/ui-checklist.md`. Use it when reviewing UI code.

## 4. State and data: keep it boring

- **Derive, do not sync.** A filtered list is `items.filter(...)` during render,
  not a second `useState` updated by an effect.
- **Effects are for talking to the outside world** (fetching, subscriptions,
  timers), not for reacting to your own state. Event logic goes in the event
  handler.
- **Fetching in an effect needs cleanup**: ignore stale responses (an `ignore`
  flag or `AbortController`) and handle React 18 Strict Mode's double mount.
  If the project has a query library or server components, use those instead.
- **Never define a component inside another component.** It remounts on every
  render and loses state and focus.
- **Composition over boolean props.** If a component grows `isCompact`,
  `showHeader`, `withFooter`, split it into explicit variants or compound
  components.
- **Keep URL state in the URL** when users expect to share or reload it
  (search query, tab, page, filters).
- **Do not optimize blind.** Memoize, virtualize or code-split when a
  measurement or an obvious size (hundreds of rows, a heavy chart library)
  calls for it.

Details and examples: `references/react-patterns.md`.

## 5. Layout that survives real content

- Design at **375 px wide** first, then widen. The page must never scroll
  horizontally.
- Flex children that hold text need `min-width: 0`; long strings need
  `overflow-wrap: anywhere` or a deliberate truncate with the full value
  available (title, tooltip, detail view).
- Touch targets at least 24×24 CSS px (WCAG 2.2), 44 px for primary mobile
  actions.
- Respect `prefers-reduced-motion`; animate `transform` and `opacity`; never
  `transition: all`.

## 6. Verify like you mean it

Run, in this order, and read the output:

1. The project's `typecheck`, `lint` and `test` scripts, then `build`.
2. **Open the page in a real browser.** Start the dev or preview server and run
   the bundled checker against the page you built:

   ```bash
   node .claude/skills/senior-frontend/scripts/check_ui.mjs "http://localhost:5173/#/team" --out .ui-check
   ```

   Point it only at your own dev or preview server. It loads the page at
   375 px and 1280 px, saves screenshots, reports console
   errors, horizontal overflow, unlabeled controls, images without size or
   alt, and walks the page with Tab to show the focus order and any stop with no
   visible focus. It uses Playwright from the project or a global install; if
   neither exists, say so instead of skipping silently. (Adjust the path if the
   skill is installed under `~/.claude/skills/`.)
3. **Look at the screenshots.** Read them; do not just confirm they exist.
4. **Exercise the unhappy paths**: force the error state, search for nothing,
   remove the last item, submit an invalid value, use only the keyboard.
5. Delete the screenshots and output folder when done (or keep them out of git).

If you cannot run a browser in this environment, say exactly what you could not
verify. "It builds" is not "it works".

## 7. Report what you did

End with a short report:

- What you built and which existing components and tokens you reused.
- The states you handled (loading, empty, error, …).
- What you verified and how (commands run, checker output, screenshots looked
  at), and anything you could not verify.
- Follow-ups you deliberately left out.

## Red flags: stop and fix

- You wrote a new `<button>` style in a project that has a `Button` component.
- The error from the API only reaches `console.error`.
- An icon button has no accessible name, or every row's button has the same one.
- A `<div>` or `<li>` has an `onClick`.
- A `useEffect` copies props or state into other state.
- Remove deletes on the first click with no confirm or undo.
- You are about to say "done" and have not opened the page.

## References

- `references/ui-checklist.md`: interface review checklist (accessibility,
  focus, forms, motion, content, images, navigation, touch, theming, i18n,
  hydration), adapted from Vercel's Web Interface Guidelines (MIT).
- `references/react-patterns.md`: state, effects, data fetching, composition
  and performance rules with short examples, drawing on the React docs and
  Vercel's agent-skills (MIT).
- `scripts/check_ui.mjs` (with `scripts/page-audit.mjs`): the browser checker
  used in step 6 (Node 18+).
- `references/NOTICE.md`: copyright and license of the adapted sources.
