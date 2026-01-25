# Figma Design Validation with MCP

Guide for validating UI implementation against Figma designs using Figma MCP.

---

## Prerequisites

**Required:**
- Figma MCP server configured
- Access to Figma design files
- Figma URLs for components/pages

**Setup:**
```bash
# Install Figma MCP (follow official docs)
# Configure API token
# Verify access to design files
```

---

## Validation Workflow

### Step 1: Get Design Specifications

**Using Figma MCP:**
```
"Get the specifications for the primary button from Figma file at [URL]"

Response includes:
- Dimensions (width, height)
- Colors (background, text, border)
- Typography (font, size, weight)
- Spacing (padding, margin)
- Border radius
- States (default, hover, active, disabled)
```

### Step 2: Inspect Implementation

**Browser DevTools:**
1. Inspect element
2. Check computed styles
3. Verify dimensions
4. Compare colors (use color picker)
5. Check typography
6. Test interactive states

### Step 3: Document Discrepancies

**Create test case or bug:**
```
TC-UI-001: Primary Button Visual Validation

Design (Figma):
- Size: 120x40px
- Background: #0066FF
- Border-radius: 8px
- Font: 16px Medium #FFFFFF

Implementation:
- Size: 120x40px ✓
- Background: #0052CC ✗ (wrong shade)
- Border-radius: 8px ✓
- Font: 16px Regular #FFFFFF ✗ (wrong weight)

Status: FAIL
Bugs: BUG-234, BUG-235
```

---

## What to Validate

### Layout & Spacing
- [ ] Component dimensions
- [ ] Padding (all sides)
- [ ] Margins
- [ ] Grid alignment
- [ ] Responsive breakpoints
- [ ] Container max-width

**Example Query:**
```
"Extract spacing values for the card component from Figma"
```

### Typography
- [ ] Font family
- [ ] Font size
- [ ] Font weight
- [ ] Line height
- [ ] Letter spacing
- [ ] Text color
- [ ] Text alignment

**Example Query:**
```
"Get typography specifications for all heading levels from Figma design system"
```

### Colors
- [ ] Background colors
- [ ] Text colors
- [ ] Border colors
- [ ] Shadow colors
- [ ] Gradient values
- [ ] Opacity values

**Example Query:**
```
"List all color tokens used in the navigation component"
```

### Components
- [ ] Icon sizes and colors
- [ ] Button states
- [ ] Input field styling
- [ ] Checkbox/radio appearance
- [ ] Dropdown styling
- [ ] Card components

**Example Query:**
```
"Compare the implemented dropdown menu with Figma design at [URL]"
```

### Interactive States
- [ ] Default state
- [ ] Hover state
- [ ] Active/pressed state
- [ ] Focus state
- [ ] Disabled state
- [ ] Loading state
- [ ] Error state

---

## Common Discrepancies

### Typography Mismatches
- Wrong font weight (e.g., Regular instead of Medium)
- Incorrect font size
- Missing line-height
- Color hex codes off by a shade

### Spacing Issues
- Padding not matching
- Inconsistent margins
- Grid misalignment
- Component spacing varies

### Color Differences
- Hex values off (#0066FF vs #0052CC)
- Opacity not applied
- Gradient angles wrong
- Shadow colors incorrect

### Responsive Behavior
- Breakpoints don't match
- Mobile layout different
- Tablet view inconsistent
- Scaling not as designed

---

## Test Case Template

```markdown
## TC-UI-XXX: [Component] Visual Validation

**Figma Design:** [URL to specific component]

### Desktop (1920x1080)

**Layout:**
- [ ] Width: XXXpx
- [ ] Height: XXXpx
- [ ] Padding: XXpx XXpx XXpx XXpx
- [ ] Margin: XXpx

**Typography:**
- [ ] Font: [Family] [Weight]
- [ ] Size: XXpx
- [ ] Line-height: XXpx
- [ ] Color: #XXXXXX

**Colors:**
- [ ] Background: #XXXXXX
- [ ] Border: Xpx solid #XXXXXX
- [ ] Shadow: XXpx XXpx XXpx rgba(X,X,X,X)

**Interactive States:**
- [ ] Hover: [changes]
- [ ] Active: [changes]
- [ ] Focus: [changes]
- [ ] Disabled: [changes]

### Tablet (768px)
- [ ] [Responsive changes]

### Mobile (375px)
- [ ] [Responsive changes]

### Status
- [ ] PASS - All match
- [ ] FAIL - Discrepancies found
- [ ] BLOCKED - Design incomplete
```

---

## Figma MCP Queries

### Component Specifications
```
"Get complete specifications for the [component name] from Figma at [URL]"
"Extract all button variants from the design system"
"List typography styles defined in Figma"
```

### Color System
```
"Show me all color tokens in the Figma design system"
"What colors are used in the navigation bar design?"
"Get the exact hex values for primary, secondary, and accent colors"
```

### Spacing & Layout
```
"What are the padding values for the card component?"
"Extract grid specifications from the page layout"
"Get spacing tokens (8px, 16px, 24px, etc.)"
```

### Responsive Breakpoints
```
"What are the defined breakpoints in this Figma design?"
"Show mobile vs desktop layout differences for [component]"
```

---

## Bug Report for UI Discrepancies

```markdown
# BUG-XXX: [Component] doesn't match Figma design

**Severity:** Medium (UI)
**Type:** Visual

## Design vs Implementation

**Figma Design:** [URL]

**Expected (from Figma):**
- Button background: #0066FF
- Font weight: 600 (Semi-bold)
- Padding: 12px 24px

**Actual (in implementation):**
- Button background: #0052CC ❌
- Font weight: 400 (Regular) ❌
- Padding: 12px 24px ✓

## Screenshots

- Figma design: [attach]
- Current implementation: [attach]
- Side-by-side comparison: [attach]

## Impact

Users see inconsistent branding. Button appears less prominent than designed.
```

---

## Automation Ideas

### Visual Regression Testing
- Capture screenshots
- Compare against Figma exports
- Highlight pixel differences
- Tools: Percy, Chromatic, BackstopJS

### Design Token Validation
- Extract Figma design tokens
- Compare with CSS variables
- Flag mismatches
- Automate with scripts

---

## Best Practices

**DO:**
- ✅ Always reference specific Figma URLs
- ✅ Test all component states
- ✅ Check responsive breakpoints
- ✅ Document exact values (not "close enough")
- ✅ Screenshot both design and implementation
- ✅ Test in multiple browsers

**DON'T:**
- ❌ Assume "it looks right"
- ❌ Skip hover/active states
- ❌ Ignore small color differences
- ❌ Test only on one screen size
- ❌ Forget to check typography
- ❌ Miss spacing issues

---

## Checklist for UI Test Cases

Per component:
- [ ] Figma URL documented
- [ ] Desktop layout validated
- [ ] Mobile/tablet responsive checked
- [ ] All interactive states tested
- [ ] Colors match exactly (use color picker)
- [ ] Typography specifications correct
- [ ] Spacing (padding/margins) accurate
- [ ] Icons match design
- [ ] Shadows/borders match
- [ ] Animations match timing/easing

---

## Quick Reference

| Element | What to Check | Tool |
|---------|---------------|------|
| Colors | Hex values exact | Browser color picker |
| Spacing | Padding/margin px | DevTools computed styles |
| Typography | Font, size, weight | DevTools font panel |
| Layout | Width, height, position | DevTools box model |
| States | Hover, active, focus | Manual interaction |
| Responsive | Breakpoint behavior | DevTools device mode |

---

**Remember:** Pixel-perfect implementation builds user trust and brand consistency.
