---
title: Plan to Steering Converter
inclusion: auto
---

# Plan to Steering File Converter

## 🎯 Automatic Trigger
This steering file is ALWAYS active. When the user says "$plan" followed by a plan document name or path, you MUST:

1. Read the specified plan document from `docs/plan/`
2. Convert it into a comprehensive steering file
3. Apply the core UI design system to all components
4. Save to `.kiro/steering/` with appropriate fileMatch pattern
5. Follow the exact structure and patterns shown below

## Example Usage
```
User: "$plan INTERACTIVE_TUTORIALS_IMPLEMENTATION.md"
You: [Read plan, create steering file with UI design system]

User: "$plan github-integration-dashboard"
You: [Read plan, create steering file with UI design system]
```

## Process

### 1. Read the Plan Document
- Locate the plan file in `docs/plan/`
- Parse the content to understand the feature
- Extract key sections: architecture, components, database schema, API routes, etc.

### 2. Create Steering File
Generate a steering file in `.kiro/steering/` with:

**Frontmatter:**
```yaml
---
title: [Feature Name]
inclusion: fileMatch
fileMatchPattern: "**/{feature-keyword}*.{ts,tsx,astro,sql,md}"
---
```

**Required Sections:**
1. Overview
2. Architecture (Data Flow, Key Files)
3. Database Schema (if applicable)
4. API Integration (if applicable)
5. Component Guidelines
6. Development Guidelines
7. Testing
8. Performance Optimization
9. Error Handling
10. Common Tasks
11. Best Practices
12. Troubleshooting
13. Documentation Links
14. Future Enhancements

### 3. Apply Consistent UI Design System
All UI components must follow the core design system established in the app.

---

## Core UI Design System

### Design Philosophy
- **Dark Theme First**: All components use dark backgrounds
- **Minimal & Clean**: Subtle borders, generous spacing
- **Consistent Typography**: Small, readable font sizes
- **Smooth Interactions**: Hover states, transitions, animations
- **Information Density**: Compact but readable

### Color Palette

#### Background Colors
```css
bg-[#0a0a0a]     /* Primary background - darkest */
bg-[#111]        /* Secondary background - hover states */
bg-[#1a1a1a]     /* Tertiary background - elevated surfaces */
```

#### Border Colors
```css
border-[#1f1f1f]  /* Primary border - default */
border-[#2a2a2a]  /* Secondary border - hover/focus */
border-[#333]     /* Tertiary border - active states */
```

#### Text Colors
```css
text-[#ededed]    /* Primary text - headings, important */
text-[#999]       /* Secondary text - body, labels */
text-[#666]       /* Tertiary text - muted, metadata */
```

#### Accent Colors
```css
/* Primary Accent (Blue) */
bg-[#3b82f6]      /* Primary action buttons */
hover:bg-[#2563eb] /* Hover state */
text-[#3b82f6]    /* Links, icons */

/* Success (Green) */
bg-emerald-500/10  /* Background */
text-emerald-400   /* Text */

/* Warning (Yellow) */
bg-yellow-500/10   /* Background */
text-yellow-400    /* Text */

/* Error (Red) */
bg-red-500/10      /* Background */
text-red-400       /* Text */

/* Info (Pink) */
bg-pink-500/10     /* Background */
text-pink-400      /* Text */
```

### Typography Scale

#### Font Sizes
```css
text-[15px]  /* Page titles, main headings */
text-[13px]  /* Card titles, button text */
text-[12px]  /* Body text, descriptions */
text-[11px]  /* Metadata, timestamps */
text-[10px]  /* Badges, tags, labels */
```

#### Font Weights
```css
font-semibold  /* Headings (600) */
font-medium    /* Buttons, labels (500) */
font-normal    /* Body text (400) */
```

#### Line Heights
```css
leading-relaxed  /* Body text (1.625) */
leading-normal   /* Default (1.5) */
leading-tight    /* Compact text (1.25) */
```

### Spacing System

#### Padding
```css
p-3   /* Compact cards (12px) */
p-4   /* Standard cards (16px) */
p-6   /* Page containers (24px) */
px-2  /* Inline elements (8px) */
py-1  /* Badges (4px) */
py-2  /* Buttons (8px) */
```

#### Gaps
```css
gap-1    /* Tight spacing (4px) */
gap-2    /* Standard spacing (8px) */
gap-3    /* Medium spacing (12px) */
gap-4    /* Large spacing (16px) */
```

#### Margins
```css
mt-0.5  /* Subtle spacing (2px) */
mt-1    /* Tight spacing (4px) */
mt-2    /* Standard spacing (8px) */
mt-3    /* Medium spacing (12px) */
mb-4    /* Section spacing (16px) */
```

### Border Radius

```css
rounded-lg    /* Cards, buttons (8px) */
rounded-xl    /* Large cards (12px) */
rounded-full  /* Badges, avatars (9999px) */
```

### Component Patterns

#### Card Component
```tsx
<div className="group bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#111] rounded-xl p-4 transition-all duration-200">
  {/* Card content */}
</div>
```

#### Button - Primary
```tsx
<button className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[13px] font-medium transition-all shadow-sm">
  Action
</button>
```

#### Button - Secondary
```tsx
<button className="px-4 py-2 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] rounded-lg text-[13px] font-medium text-[#999] transition-all">
  Action
</button>
```

#### Input Field
```tsx
<input
  type="text"
  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-[12px] text-[#ededed] placeholder:text-[#666] px-3 py-2 outline-none focus:bg-[#111] focus:ring-1 focus:ring-[#2a2a2a] transition-all"
  placeholder="Enter text..."
/>
```

#### Select Dropdown
```tsx
<select className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-[12px] text-[#999] px-2.5 py-1.5 outline-none focus:bg-[#111] cursor-pointer">
  <option value="">Select option</option>
</select>
```

#### Badge
```tsx
<span className="px-2 py-0.5 text-[10px] rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
  Label
</span>
```

#### Icon Button
```tsx
<button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] transition-all">
  <svg className="w-4 h-4 text-[#999]" />
</button>
```

#### Loading Spinner
```tsx
<div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#1f1f1f] border-t-[#3b82f6]"></div>
```

#### Empty State
```tsx
<div className="text-center py-12">
  <svg className="mx-auto h-12 w-12 text-[#333]" />
  <h3 className="mt-2 text-[13px] font-medium text-[#ededed]">No items found</h3>
  <p className="mt-1 text-[12px] text-[#666]">Get started by creating one</p>
</div>
```

### Layout Patterns

#### Page Header
```tsx
<div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
  <div>
    <h1 className="text-[15px] font-semibold text-[#ededed]">Page Title</h1>
    <p className="text-[12px] text-[#666] mt-0.5">Description</p>
  </div>
  <button className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[13px] font-medium">
    Action
  </button>
</div>
```

#### Filter Bar
```tsx
<div className="flex items-center gap-2 px-6 py-3">
  {/* Search */}
  <div className="relative">
    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]" />
    <input
      type="text"
      placeholder="Search..."
      className="w-44 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-[12px] pl-8 pr-3 py-1.5"
    />
  </div>
  
  {/* Filters */}
  <select className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-[12px] px-2.5 py-1.5">
    <option>Filter</option>
  </select>
</div>
```

#### Grid Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-6 pb-6">
  {/* Cards */}
</div>
```

#### Two Column Layout
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
  {/* Left column */}
  {/* Right column */}
</div>
```

### Interactive States

#### Hover Effects
```css
/* Cards */
hover:border-[#2a2a2a]
hover:bg-[#111]
group-hover:text-[#fff]

/* Buttons */
hover:bg-[#2563eb]
hover:bg-[#111]

/* Scale */
hover:scale-105
```

#### Focus States
```css
focus:bg-[#111]
focus:ring-1
focus:ring-[#2a2a2a]
outline-none
```

#### Active States
```css
active:scale-95
active:bg-[#1e40af]
```

#### Disabled States
```css
disabled:opacity-50
disabled:cursor-not-allowed
```

### Transitions

```css
transition-all          /* All properties */
transition-colors       /* Color changes only */
transition-transform    /* Transform only */
duration-200           /* 200ms - default */
duration-300           /* 300ms - slower */
```

### Responsive Design

#### Breakpoints
```css
/* Mobile first approach */
sm:   /* 640px */
md:   /* 768px */
lg:   /* 1024px */
xl:   /* 1280px */
2xl:  /* 1536px */
```

#### Common Patterns
```tsx
{/* Mobile: 1 col, Tablet: 2 cols, Desktop: 3 cols */}
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

{/* Hide on mobile, show on desktop */}
<div className="hidden lg:block">

{/* Full width on mobile, fixed on desktop */}
<div className="w-full lg:w-64">
```

### Accessibility

#### Required Attributes
```tsx
{/* Buttons */}
<button aria-label="Close dialog">

{/* Images */}
<img alt="Description" />

{/* Links */}
<a href="#" aria-label="Navigate to page">

{/* Form inputs */}
<input aria-label="Search" />
<label htmlFor="input-id">Label</label>
```

#### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use `tabIndex={0}` for custom interactive elements
- Implement focus indicators
- Support Enter/Space for activation

#### Screen Readers
- Use semantic HTML (`<nav>`, `<main>`, `<article>`)
- Add ARIA labels where needed
- Provide text alternatives for icons
- Use proper heading hierarchy

### Animation Patterns

#### Loading States
```tsx
{/* Spinner */}
<div className="animate-spin rounded-full h-6 w-6 border-2 border-[#1f1f1f] border-t-[#3b82f6]" />

{/* Pulse */}
<div className="animate-pulse bg-[#1f1f1f] h-4 rounded" />

{/* Skeleton */}
<div className="space-y-3">
  <div className="h-4 bg-[#1f1f1f] rounded animate-pulse" />
  <div className="h-4 bg-[#1f1f1f] rounded animate-pulse w-5/6" />
</div>
```

#### Entrance Animations
```tsx
{/* Fade in */}
<div className="animate-fade-in">

{/* Slide up */}
<div className="animate-slide-up">

{/* Scale in */}
<div className="animate-scale-in">
```

### Icon System

#### Icon Sizes
```css
w-3 h-3    /* 12px - inline text */
w-3.5 h-3.5 /* 14px - small buttons */
w-4 h-4    /* 16px - standard */
w-5 h-5    /* 20px - medium */
w-6 h-6    /* 24px - large */
```

#### Icon Colors
```css
text-[#999]  /* Default */
text-[#666]  /* Muted */
text-[#3b82f6] /* Accent */
```

#### Common Icons (Heroicons)
```tsx
{/* Search */}
<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
</svg>

{/* Plus */}
<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
</svg>

{/* Eye */}
<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
</svg>

{/* Heart */}
<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
</svg>

{/* Refresh */}
<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
</svg>
```

### Data Display Patterns

#### Stat Card
```tsx
<div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl p-4">
  <div className="flex items-center justify-between mb-2">
    <span className="text-[12px] text-[#666]">Label</span>
    <svg className="w-4 h-4 text-[#3b82f6]" />
  </div>
  <div className="text-[20px] font-semibold text-[#ededed]">1,234</div>
  <div className="text-[11px] text-emerald-400 mt-1">+12% from last week</div>
</div>
```

#### List Item
```tsx
<div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#0a0a0a] transition-colors">
  <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center">
    <svg className="w-4 h-4 text-[#3b82f6]" />
  </div>
  <div className="flex-1 min-w-0">
    <div className="text-[13px] font-medium text-[#ededed]">Title</div>
    <div className="text-[11px] text-[#666]">Description</div>
  </div>
  <div className="text-[11px] text-[#666]">Metadata</div>
</div>
```

#### Timeline Item
```tsx
<div className="flex gap-3">
  <div className="flex flex-col items-center">
    <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
    <div className="w-px h-full bg-[#1f1f1f]" />
  </div>
  <div className="flex-1 pb-4">
    <div className="text-[13px] font-medium text-[#ededed]">Event</div>
    <div className="text-[11px] text-[#666] mt-0.5">Timestamp</div>
  </div>
</div>
```

### Form Patterns

#### Form Group
```tsx
<div className="space-y-1.5">
  <label className="text-[12px] font-medium text-[#999]">
    Label
  </label>
  <input
    type="text"
    className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-[12px] px-3 py-2"
  />
  <p className="text-[11px] text-[#666]">Helper text</p>
</div>
```

#### Checkbox
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="w-4 h-4 rounded border-[#1f1f1f] bg-[#0a0a0a] text-[#3b82f6] focus:ring-[#3b82f6]"
  />
  <span className="text-[12px] text-[#999]">Label</span>
</label>
```

#### Radio Button
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="radio"
    className="w-4 h-4 border-[#1f1f1f] bg-[#0a0a0a] text-[#3b82f6] focus:ring-[#3b82f6]"
  />
  <span className="text-[12px] text-[#999]">Option</span>
</label>
```

#### Textarea
```tsx
<textarea
  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-[12px] px-3 py-2 min-h-[100px] resize-y"
  placeholder="Enter text..."
/>
```

---

## Conversion Rules

### 1. File Naming
- Steering file name: `{feature-name}.md` (kebab-case)
- Match the plan document name
- Store in `.kiro/steering/`

### 2. FileMatch Pattern
- Extract key terms from feature name
- Use glob pattern: `**/{keyword}*.{ts,tsx,astro,sql,md}`
- Examples:
  - GitHub integration: `**/github*.{ts,tsx,astro,sql}`
  - Tutorials: `**/tutorial*.{ts,tsx,astro,md}`
  - Showcase: `**/showcase*.{ts,tsx,astro,sql}`

### 3. Content Structure
- Start with Overview (2-3 sentences)
- Architecture section with Data Flow and Key Files
- Component-specific guidelines
- Development workflow
- Testing procedures
- Troubleshooting guide
- Links to full documentation

### 4. Code Examples
- Use TypeScript for type safety
- Include complete, working examples
- Show both good and bad patterns
- Add inline comments for clarity

### 5. UI Components
- Always apply the core design system
- Use exact color values from the palette
- Follow spacing and typography scales
- Include hover/focus/active states
- Ensure responsive design
- Add accessibility attributes

### 6. Best Practices Section
- Code style guidelines
- Performance tips
- Security considerations
- Accessibility requirements

### 7. Documentation Links
- Link to full documentation in `docs/`
- Reference related steering files
- Include external resources if needed

---

## Example Workflow

When user says: `$plan INTERACTIVE_TUTORIALS_IMPLEMENTATION.md`

1. Read `docs/plan/INTERACTIVE_TUTORIALS_IMPLEMENTATION.md`
2. Extract key information:
   - Feature name: Interactive Tutorials
   - Key files: tutorial components, pages, content
   - Architecture: 4-step tutorial pattern
   - UI components: TutorialLayout, TutorialStep, etc.
3. Create `.kiro/steering/interactive-tutorials.md`
4. Apply fileMatch pattern: `**/tutorial*.{ts,tsx,astro,md}`
5. Structure content with all required sections
6. Apply core UI design system to all component examples
7. Add development guidelines and troubleshooting
8. Link to full documentation

---

## Quality Checklist

Before completing the conversion, verify:

- [ ] Frontmatter has correct title and fileMatch pattern
- [ ] Overview clearly explains the feature
- [ ] Architecture section shows data flow
- [ ] Key files are listed with descriptions
- [ ] All UI components use core design system
- [ ] Color values match the palette exactly
- [ ] Typography follows the scale
- [ ] Spacing is consistent
- [ ] Responsive design is included
- [ ] Accessibility attributes are present
- [ ] Code examples are complete and working
- [ ] Best practices are documented
- [ ] Troubleshooting section is helpful
- [ ] Documentation links are correct
- [ ] Future enhancements are listed

---

## Notes

- Always maintain consistency with existing steering files
- Use the same tone and structure
- Keep examples practical and realistic
- Focus on developer experience
- Make it easy to find information quickly
- Update this steering file as patterns evolve
