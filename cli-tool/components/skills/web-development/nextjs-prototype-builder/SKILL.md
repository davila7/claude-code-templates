---
name: nextjs-prototype-builder
description: Build polished, demoable Next.js prototypes with dark or light glassmorphism design, drag-and-drop grids, guided tours, search palettes, and static export deployment. Use when creating dashboard-style prototypes for any domain from product requirements.
---

# Next.js Prototype Builder

## Overview

Rapidly build polished, interactive Next.js prototypes with a glassmorphism design system (dark or light). Given product requirements and domain context, this skill scaffolds a complete static-export prototype with KPI dashboards, data tables, drag-and-drop grids, search palettes, notification panels, guided tours, and deployment to Cloudflare Pages/Vercel.

**Stack:** Next.js 15 + React 19 + Tailwind CSS 3.4 + Lucide icons + TypeScript
**Output:** Static HTML export — no server required

## Build Workflow

### Step 1: Requirements Gathering

Before building, collect:

- **Domain** — What industry/product is this? (e.g., reinsurance, healthcare, logistics)
- **Screens** — List all pages/views needed (dashboard, list, detail, settings)
- **Entities** — Core data types (e.g., Submissions, Claims, Agents)
- **Persona** — Who is the primary user? (e.g., Senior Underwriter, Operations Manager)
- **Brand** — Name, accent color preference, tagline
- **Theme** — Dark (default) or Light. Dark suits data-dense dashboards and command centers. Light suits care/healthcare, consumer-facing, and collaborative tools.

### Step 2: Scaffold from Template

```bash
python3 <skill-path>/scripts/scaffold.py \
  --name "my-project" \
  --brand "ACME" \
  --accent cyan \
  --theme dark \
  --target ./my-project
```

This copies `assets/template/` to the target directory, applies theme + brand + accent customizations, and prints next steps.

Then:
```bash
cd my-project && npm install
```

### Step 3: Design System Customization

The template ships with a complete glassmorphism design system in `globals.css`. Customize:

1. **Theme** — Dark (translucent dark cards on dark bg) or Light (white cards with layered shadows on gray bg)
2. **Accent color** — Replace `cyan` references if using a different primary color
3. **Brand fonts** — Update `layout.tsx` font imports (default: DM Sans + JetBrains Mono + Syne)
4. **Surface palette** — Adjust `tailwind.config.ts` surface colors if needed

See `references/design-system.md` for full token reference including both theme variants.

### Step 4: Define Mock Data Layer

Edit `src/data/mock.ts`:

1. Define TypeScript types for your domain entities
2. Create realistic mock arrays (6-10 entries each with varied statuses)
3. Add computed helper data (feeds, aggregations)

See `references/mock-data-guide.md` for patterns.

### Step 5: Build Navigation

Edit `src/components/Sidebar.tsx`:

1. Update `navItems` array with your pages
2. Import matching Lucide icons
3. Add badges for counts where appropriate
4. Create route directories under `src/app/` for each page

### Step 6: Build Pages

For each page, follow these patterns:

**Dashboard** (root `page.tsx`):
- KPI cards row using `<KPICard>` component
- Activity feed / recent items table
- Summary charts / status panels

**List pages** (e.g., `submissions/page.tsx`):
- `<Header>` with title and action buttons
- Filter bar with status badges
- Data table with full-row click → detail page
- Use `router.push()` for navigation

**Detail pages** (e.g., `submissions/[id]/page.tsx`):
- Server/client split for static export (see component-patterns.md)
- `page.tsx` — server component with `generateStaticParams()`
- `client.tsx` — `'use client'` component with all interactive logic
- Breadcrumb navigation via `<Header breadcrumbs={[...]}>`

**Grid/calendar pages** (e.g., `roster/page.tsx`):
- Drag-and-drop grid using `@dnd-kit/core` (see component-patterns.md § Drag-and-Drop Grid)
- Mutable state with `useState` for data the user can rearrange
- Droppable cells with visual feedback, draggable cards with ghost overlay
- Optional read-only mode for view-only roles

### Step 7: Add Interactive Features

**Guided Tour** — Edit `src/components/TourProvider.tsx`:
1. Define tour steps array with `target` (CSS selector), `title`, `content`, `placement`
2. Add `id` attributes to target elements in your pages
3. Tour auto-starts on first visit, stores completion in localStorage

**Notifications** — Edit notification data in `src/components/Header.tsx`:
1. Update the `notifications` array with domain-relevant alerts
2. Customize notification types: `critical`, `warning`, `info`, `success`

**Search Palette** — Edit search logic in `src/components/Header.tsx`:
1. Update `buildResults()` to search your mock data entities
2. Customize result types and display format

**Drag-and-Drop** — For grid/calendar pages:
1. Install `@dnd-kit/core` (`npm install @dnd-kit/core`)
2. Follow the DnD Grid pattern in `references/component-patterns.md`
3. Use `PointerSensor` with `distance: 5` to disambiguate click vs drag

### Step 8: Optional — Add AI Chat Panel

If the prototype needs an AI chat interface, see `references/component-patterns.md` § AI Chat Panel for the pattern. This involves:
- Creating an `AgentChatPanel.tsx` component
- Adding mock response logic
- Wiring suggestion chips from entity capabilities

### Step 9: Deploy

```bash
# Build static export
npm run build

# Deploy to Cloudflare Pages
bash deploy.sh my-project

# Or: Vercel
npx vercel --prod

# Or: GitHub Pages
# Push /out directory
```

See `references/deployment-guide.md` for platform-specific details.

## Key Design Principles

### Both Themes

1. **Glass everything** — Use `.glass` and `.glass-hover` classes on all cards
2. **Glow accents** — Apply `.glow-cyan`, `.glow-emerald`, etc. on KPI cards
3. **Stagger animations** — Wrap card grids in `.stagger` for sequential fade-in
4. **Micro-interactions** — Use `.card-shine`, hover transforms, border color transitions
5. **Font sizes** — Use rem-based sizes: `text-[0.68rem]` labels, `text-[0.82rem]` body, `text-[1.85rem]` KPI values
6. **Spacing** — Consistent padding: `p-5` cards, `p-6` main, `gap-4` grids

### Dark Theme

7. **Borders** — Always `border-white/[0.06]` for subtle separation
8. **Text hierarchy** — `text-slate-200` primary, `text-slate-400` secondary, `text-slate-600` muted
9. **Badges** — `bg-{color}-400/10 text-{color}-400`
10. **Backgrounds** — Translucent dark layers: `bg-white/[0.02]` through `bg-white/[0.04]`

### Light Theme

7. **Borders** — Always `border-slate-200` or `border-slate-200/80` for subtle separation
8. **Text hierarchy** — `text-slate-800` primary, `text-slate-500` secondary, `text-slate-400` muted
9. **Badges** — `bg-{color}-50 text-{color}-600 ring-1 ring-{color}-200/40`
10. **Backgrounds** — White cards with layered shadows: `inset 0 1px 0 rgba(255,255,255,0.8)` top-edge highlight
11. **Sidebar** — `bg-surface-1` with soft right shadow, gradient wash at top
12. **Header** — Semi-transparent white (`bg-white/70 backdrop-blur-xl`) with subtle bottom shadow

## Resources

### scripts/
- `scaffold.py` — CLI to copy template and customize name/brand/accent/theme

### references/
- `design-system.md` — Color tokens, animations, glassmorphism, glow system (dark + light)
- `component-patterns.md` — Server/client split, sidebar, header, KPI, badge, tour, tables, drag-and-drop grid
- `mock-data-guide.md` — Type patterns, realistic data, helpers
- `deployment-guide.md` — Static export, Cloudflare Pages, Vercel, GitHub Pages

### assets/
- `template/` — Copyable Next.js boilerplate ready to customize (dark theme by default)
