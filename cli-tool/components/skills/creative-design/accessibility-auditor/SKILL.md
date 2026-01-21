---
name: Accessibility Auditor
description: Web accessibility specialist for WCAG compliance, ARIA implementation, and inclusive design. Use when auditing websites for accessibility issues, implementing WCAG 2.1 AA/AAA standards, testing with screen readers, or ensuring ADA compliance. Expert in semantic HTML, keyboard navigation, and assistive technology compatibility.
---

# Accessibility Auditor

Comprehensive guidance for creating accessible web experiences that comply with WCAG standards and serve users of all abilities effectively.

## When to Use This Skill

Use this skill when:
- Auditing websites for accessibility compliance
- Implementing WCAG 2.1 Level AA or AAA standards
- Fixing accessibility violations and errors
- Testing with screen readers (NVDA, JAWS, VoiceOver)
- Ensuring keyboard navigation works correctly
- Implementing ARIA attributes and landmarks
- Preparing for ADA or Section 508 compliance audits
- Designing inclusive user experiences

## WCAG 2.1 Principles (POUR)

### 1. Perceivable
Users must be able to perceive the information being presented.

### 2. Operable
Users must be able to operate the interface.

### 3. Understandable
Users must be able to understand the information and interface.

### 4. Robust
Content must be robust enough to work with current and future technologies.

## Common Accessibility Issues & Fixes

### 1. Missing Alt Text for Images

**❌ Problem:**
```html
<img src="/products/shoes.jpg">
```

**✅ Solution:**
```html
<!-- Informative image -->
<img src="/products/shoes.jpg" alt="Red Nike Air Max running shoes with white swoosh">

<!-- Decorative image -->
<img src="/decorative-pattern.svg" alt="" role="presentation">

<!-- Logo that links -->
<a href="/">
  <img src="/logo.png" alt="Company Name - Home">
</a>
```

**Rules:**
- Informative images: Describe the content/function
- Decorative images: Use empty alt (alt="")
- Functional images: Describe the action
- Complex images: Provide detailed description nearby

### 2. Low Color Contrast

**❌ Problem:**
```css
/* Contrast ratio 2.5:1 - Fails WCAG */
.text {
  color: #767676;
  background: #ffffff;
}
```

**✅ Solution:**
```css
/* Contrast ratio 4.5:1+ - Passes AA */
.text {
  color: #595959;
  background: #ffffff;
}

/* Contrast ratio 7:1+ - Passes AAA */
.text-high-contrast {
  color: #333333;
  background: #ffffff;
}
```

**Requirements:**
- Normal text (< 18px): 4.5:1 minimum (AA), 7:1 enhanced (AAA)
- Large text (≥ 18px or ≥ 14px bold): 3:1 minimum (AA), 4.5:1 enhanced (AAA)
- UI components and graphics: 3:1 minimum

### 3. Non-Semantic HTML

**❌ Problem:**
```html
<div class="button" onclick="submitForm()">Submit</div>
<div class="heading">Page Title</div>
<div class="nav-menu">...</div>
```

**✅ Solution:**
```html
<button type="submit" onclick="submitForm()">Submit</button>
<h1>Page Title</h1>
<nav aria-label="Main navigation">...</nav>
```

**Semantic Elements:**
- `<button>` for buttons
- `<a>` for links
- `<h1>` - `<h6>` for headings (hierarchical)
- `<nav>`, `<main>`, `<aside>`, `<article>`, `<section>` for landmarks
- `<ul>`, `<ol>`, `<li>` for lists
- `<table>`, `<th>`, `<td>` for tabular data

### 4. Missing Form Labels

**❌ Problem:**
```html
<input type="email" placeholder="Enter your email">
```

**✅ Solution:**
```html
<!-- Explicit label -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email">

<!-- Implicit label -->
<label>
  Email Address
  <input type="email" name="email">
</label>

<!-- Hidden label (for tight layouts) -->
<label for="search" class="sr-only">Search</label>
<input type="text" id="search" placeholder="Search...">
```

**Best Practices:**
- Every form field must have an associated label
- Labels should be visible (don't rely on placeholder)
- Use aria-label only when visual label isn't possible
- Group related fields with `<fieldset>` and `<legend>`

### 5. Keyboard Navigation Issues

**❌ Problem:**
```html
<div onclick="handleClick()">Click me</div>
<a href="javascript:void(0)" onclick="doSomething()">Action</a>
```

**✅ Solution:**
```html
<!-- Use proper button -->
<button onclick="handleClick()">Click me</button>

<!-- If div required, make it accessible -->
<div
  role="button"
  tabindex="0"
  onclick="handleClick()"
  onkeydown="handleKeyPress(event)"
>
  Click me
</div>

<script>
function handleKeyPress(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleClick();
  }
}
</script>
```

**Keyboard Requirements:**
- All interactive elements must be keyboard accessible
- Visible focus indicators (outline or custom styling)
- Logical tab order (matches visual flow)
- Skip links for repetitive content
- No keyboard traps (users can navigate away)

### 6. Missing ARIA Landmarks

**❌ Problem:**
```html
<div class="header">...</div>
<div class="main-content">...</div>
<div class="sidebar">...</div>
<div class="footer">...</div>
```

**✅ Solution:**
```html
<header role="banner">
  <nav aria-label="Main navigation">...</nav>
</header>

<main role="main">
  <h1>Page Title</h1>
  <article>...</article>
</main>

<aside role="complementary" aria-label="Related articles">
  ...
</aside>

<footer role="contentinfo">
  ...
</footer>
```

**Common Landmarks:**
- `banner` - Site header
- `navigation` - Navigation menus
- `main` - Primary content (one per page)
- `complementary` - Supporting content
- `contentinfo` - Site footer
- `search` - Search functionality
- `form` - Form regions

### 7. Inaccessible Modals/Dialogs

**❌ Problem:**
```html
<div class="modal">
  <div class="content">
    Modal content
    <button onclick="closeModal()">Close</button>
  </div>
</div>
```

**✅ Solution:**
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <h2 id="modal-title">Confirm Action</h2>
  <p id="modal-desc">Are you sure you want to delete this item?</p>

  <button onclick="confirmAction()">Confirm</button>
  <button onclick="closeModal()">Cancel</button>
</div>

<script>
// Focus management
function openModal() {
  const modal = document.querySelector('[role="dialog"]');
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  // Store previous focus
  previousFocus = document.activeElement;

  // Focus first element
  focusableElements[0].focus();

  // Trap focus
  modal.addEventListener('keydown', trapFocus);
}

function closeModal() {
  // Return focus
  if (previousFocus) previousFocus.focus();
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;

  const focusableElements = Array.from(
    modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    lastElement.focus();
    event.preventDefault();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    firstElement.focus();
    event.preventDefault();
  }
}
</script>
```

**Modal Requirements:**
- `role="dialog"` or `role="alertdialog"`
- `aria-modal="true"` to indicate modal behavior
- `aria-labelledby` pointing to title
- `aria-describedby` for description (optional)
- Focus management (trap and restore)
- Close on Escape key
- Prevent background scrolling

### 8. Missing Skip Links

**✅ Solution:**
```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<header>
  <nav>...</nav>
</header>

<main id="main-content" tabindex="-1">
  <!-- Page content -->
</main>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>
```

## ARIA Best Practices

### ARIA Attributes Reference

**States:**
- `aria-checked` - Checkbox/radio state
- `aria-disabled` - Disabled state
- `aria-expanded` - Expanded/collapsed state
- `aria-hidden` - Hidden from assistive technology
- `aria-pressed` - Toggle button state
- `aria-selected` - Selected state

**Properties:**
- `aria-label` - Accessible name
- `aria-labelledby` - ID reference for label
- `aria-describedby` - ID reference for description
- `aria-live` - Live region updates
- `aria-required` - Required field
- `aria-invalid` - Validation state

### Live Regions

```html
<!-- Polite: Wait for pause in speech -->
<div aria-live="polite" aria-atomic="true">
  Item added to cart
</div>

<!-- Assertive: Interrupt immediately -->
<div aria-live="assertive" role="alert">
  Error: Payment failed
</div>

<!-- Status message -->
<div role="status" aria-live="polite">
  Saving changes...
</div>
```

### Custom Components

**Accordion:**
```html
<div class="accordion">
  <button
    aria-expanded="false"
    aria-controls="panel-1"
    id="accordion-1"
  >
    Section 1
  </button>
  <div id="panel-1" role="region" aria-labelledby="accordion-1" hidden>
    Panel content
  </div>
</div>
```

**Tabs:**
```html
<div role="tablist" aria-label="Content sections">
  <button
    role="tab"
    aria-selected="true"
    aria-controls="panel-1"
    id="tab-1"
  >
    Tab 1
  </button>
  <button
    role="tab"
    aria-selected="false"
    aria-controls="panel-2"
    id="tab-2"
    tabindex="-1"
  >
    Tab 2
  </button>
</div>

<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  Panel 1 content
</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  Panel 2 content
</div>
```

## Testing Checklist

### Automated Testing
- [ ] Run axe DevTools or WAVE browser extension
- [ ] Check HTML validation (W3C Validator)
- [ ] Test color contrast ratios
- [ ] Verify heading hierarchy
- [ ] Check for missing alt text

### Manual Testing
- [ ] Navigate entire site using only keyboard (Tab, Enter, Escape, Arrow keys)
- [ ] Test with screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Verify focus indicators are visible
- [ ] Check form validation messages are announced
- [ ] Test modal focus trapping
- [ ] Verify skip links work
- [ ] Test with browser zoom at 200%
- [ ] Check page reflow at different viewport sizes
- [ ] Disable JavaScript and verify core functionality
- [ ] Test with Windows High Contrast mode

### Screen Reader Testing

**VoiceOver (Mac):**
- Enable: Cmd + F5
- Navigate: Control + Option + Arrow keys
- Read all: Control + Option + A

**NVDA (Windows):**
- Navigate: Arrow keys (browse mode) or Tab (focus mode)
- Read all: NVDA + Down Arrow
- Elements list: NVDA + F7

**Test Scenarios:**
- Can users understand page structure?
- Are headings descriptive and hierarchical?
- Are form labels clear and associated?
- Are error messages announced?
- Can users complete key tasks without vision?

## Accessibility Statement

Include on website:

```markdown
# Accessibility Statement

We are committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.

## Conformance Status
This website is partially conformant with WCAG 2.1 Level AA. "Partially conformant" means that some parts of the content do not fully conform to the accessibility standard.

## Feedback
We welcome your feedback on the accessibility of this site. Please contact us:
- Email: accessibility@example.com
- Phone: +1-555-0123

## Known Issues
- [List any known accessibility issues and planned fixes]

Last updated: [Date]
```

## Resources

**Tools:**
- axe DevTools (browser extension)
- WAVE (web accessibility evaluation tool)
- Lighthouse (Chrome DevTools)
- Colour Contrast Analyser
- Screen readers: NVDA, JAWS, VoiceOver

**Guidelines:**
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

Accessibility is not optional—it's a fundamental requirement for creating inclusive web experiences. Prioritize it from the start of every project, not as an afterthought.
