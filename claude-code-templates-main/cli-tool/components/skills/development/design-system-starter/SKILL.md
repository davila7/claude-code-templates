---
name: design-system-starter
description: Create and evolve design systems with design tokens, component architecture, accessibility guidelines, and documentation templates. Ensures consistent, scalable, and accessible UI across products.
license: MIT
metadata:
  version: 1.0.0
  tags: [design-system, ui, components, design-tokens, accessibility, frontend]
---

# Design System Starter

Build robust, scalable design systems that ensure visual consistency and exceptional user experiences.

---

## Quick Start

Just describe what you need:

```
Create a design system for my React app with dark mode support
```

That's it. The skill provides tokens, components, and accessibility guidelines.

---

## Triggers

| Trigger | Example |
|---------|---------|
| Create design system | "Create a design system for my app" |
| Design tokens | "Set up design tokens for colors and spacing" |
| Component architecture | "Design component structure using atomic design" |
| Accessibility | "Ensure WCAG 2.1 compliance for my components" |
| Dark mode | "Implement theming with dark mode support" |

---

## Quick Reference

| Task | Output |
|------|--------|
| Design tokens | Color, typography, spacing, shadows JSON |
| Component structure | Atomic design hierarchy (atoms, molecules, organisms) |
| Theming | CSS variables or ThemeProvider setup |
| Accessibility | WCAG 2.1 AA compliant patterns |
| Documentation | Component docs with props, examples, a11y notes |

---

## Bundled Resources

- `references/component-examples.md` - Complete component implementations
- `templates/design-tokens-template.json` - W3C design token format
- `templates/component-template.tsx` - React component template
- `checklists/design-system-checklist.md` - Design system audit checklist

---

## Design System Philosophy

### What is a Design System?

A design system is more than a component library—it's a collection of:

1. **Design Tokens**: Foundational design decisions (colors, spacing, typography)
2. **Components**: Reusable UI building blocks
3. **Patterns**: Common UX solutions and compositions
4. **Guidelines**: Rules, principles, and best practices
5. **Documentation**: How to use everything effectively

### Core Principles

**1. Consistency Over Creativity**
- Predictable patterns reduce cognitive load
- Users learn once, apply everywhere
- Designers and developers speak the same language

**2. Accessible by Default**
- WCAG 2.1 Level AA compliance minimum
- Keyboard navigation built-in
- Screen reader support from the start

**3. Scalable and Maintainable**
- Design tokens enable global changes
- Component composition reduces duplication
- Versioning and deprecation strategies

**4. Developer-Friendly**
- Clear API contracts
- Comprehensive documentation
- Easy to integrate and customize

---

## Design Tokens

Design tokens are the atomic design decisions that define your system's visual language.

### Token Categories

#### 1. Color Tokens

**Primitive Colors** (Raw values):
```json
{
  "color": {
    "primitive": {
      "blue": {
        "50": "#eff6ff",
        "100": "#dbeafe",
        "200": "#bfdbfe",
        "300": "#93c5fd",
        "400": "#60a5fa",
        "500": "#3b82f6",
        "600": "#2563eb",
        "700": "#1d4ed8",
        "800": "#1e40af",
        "900": "#1e3a8a",
        "950": "#172554"
      }
    }
  }
}
```

**Semantic Colors** (Contextual meaning):
```json
{
  "color": {
    "semantic": {
      "brand": {
        "primary": "{color.primitive.blue.600}",
        "primary-hover": "{color.primitive.blue.700}",
        "primary-active": "{color.primitive.blue.800}"
      },
      "text": {
        "primary": "{color.primitive.gray.900}",
        "secondary": "{color.primitive.gray.600}",
        "tertiary": "{color.primitive.gray.500}",
        "disabled": "{color.primitive.gray.400}",
        "inverse": "{color.primitive.white}"
      },
      "background": {
        "primary": "{color.primitive.white}",
        "secondary": "{color.primitive.gray.50}",
        "tertiary": "{color.primitive.gray.100}"
      },
      "feedback": {
        "success": "{color.primitive.green.600}",
        "warning": "{color.primitive.yellow.600}",
        "error": "{color.primitive.red.600}",
        "info": "{color.primitive.blue.600}"
      }
    }
  }
}
```

**Accessibility**: Ensure color contrast ratios meet WCAG 2.1 Level AA:
- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- UI components and graphics: 3:1 minimum

#### 2. Typography Tokens

```json
{
  "typography": {
    "fontFamily": {
      "sans": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "serif": "'Georgia', 'Times New Roman', serif",
      "mono": "'Fira Code', 'Courier New', monospace"
    },
    "fontSize": {
      "xs": "0.75rem",     // 12px
      "sm": "0.875rem",    // 14px
      "base": "1rem",      // 16px
      "lg": "1.125rem",    // 18px
      "xl": "1.25rem",     // 20px
      "2xl": "1.5rem",     // 24px
      "3xl": "1.875rem",   // 30px
      "4xl": "2.25rem",    // 36px
      "5xl": "3rem"        // 48px
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.25,
      "normal": 1.5,
      "relaxed": 1.75,
      "loose": 2
    },
    "letterSpacing": {
      "tight": "-0.025em",
      "normal": "0",
      "wide": "0.025em"
    }
  }
}
```

#### 3. Spacing Tokens

**Scale**: Use a consistent spacing scale (commonly 4px or 8px base)

```json
{
  "spacing": {
    "0": "0",
    "1": "0.25rem",   // 4px
    "2": "0.5rem",    // 8px
    "3": "0.75rem",   // 12px
    "4": "1rem",      // 16px
    "5": "1.25rem",   // 20px
    "6": "1.5rem",    // 24px
    "8": "2rem",      // 32px
    "10": "2.5rem",   // 40px
    "12": "3rem",     // 48px
    "16": "4rem",     // 64px
    "20": "5rem",     // 80px
    "24": "6rem"      // 96px
  }
}
```

**Component-Specific Spacing**:
```json
{
  "component": {
    "button": {
      "padding-x": "{spacing.4}",
      "padding-y": "{spacing.2}",
      "gap": "{spacing.2}"
    },
    "card": {
      "padding": "{spacing.6}",
      "gap": "{spacing.4}"
    }
  }
}
```

#### 4. Border Radius Tokens

```json
{
  "borderRadius": {
    "none": "0",
    "sm": "0.125rem",   // 2px
    "base": "0.25rem",  // 4px
    "md": "0.375rem",   // 6px
    "lg": "0.5rem",     // 8px
    "xl": "0.75rem",    // 12px
    "2xl": "1rem",      // 16px
    "full": "9999px"
  }
}
```

#### 5. Shadow Tokens

```json
{
  "shadow": {
    "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "sm": "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    "base": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    "md": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    "lg": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    "xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
  }
}
```

---

## Component Architecture

### Atomic Design Methodology

**Atoms** → **Molecules** → **Organisms** → **Templates** → **Pages**

#### Atoms (Primitive Components)
Basic building blocks that can't be broken down further.

**Examples:**
- Button
- Input
- Label
- Icon
- Badge
- Avatar

**Button Component:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```

See `references/component-examples.md` for complete Button implementation with variants, sizes, and styling patterns.

#### Molecules (Simple Compositions)
Groups of atoms that function together.

**Examples:**
- SearchBar (Input + Button)
- FormField (Label + Input + ErrorMessage)
- Card (Container + Title + Content + Actions)

**FormField Molecule:**
```typescript
interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}
```

See `references/component-examples.md` for FormField, Card (compound component pattern), Input with variants, Modal, and more composition examples.

#### Organisms (Complex Compositions)
Complex UI components made of molecules and atoms.

**Examples:**
- Navigation Bar
- Product Card Grid
- User Profile Section
- Modal Dialog

#### Templates (Page Layouts)
Page-level structures that define content placement.

**Examples:**
- Dashboard Layout (Sidebar + Header + Main Content)
- Marketing Page Layout (Hero + Features + Footer)
- Settings Page Layout (Tabs + Content Panels)

#### Pages (Specific Instances)
Actual pages with real content.

---

## Component API Design

### Props Best Practices

**1. Predictable Prop Names**
```typescript
// ✅ Good: Consistent naming
<Button variant="primary" size="md" />
<Input variant="outlined" size="md" />

// ❌ Bad: Inconsistent
<Button type="primary" sizeMode="md" />
<Input style="outlined" inputSize="md" />
```

**2. Sensible Defaults**
```typescript
// ✅ Good: Provides defaults
interface ButtonProps {
  variant?: 'primary' | 'secondary';  // Default: primary
  size?: 'sm' | 'md' | 'lg';          // Default: md
}

// ❌ Bad: Everything required
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  color: string;
  padding: string;
}
```

**3. Composition Over Configuration**
```typescript
// ✅ Good: Composable
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>

// ❌ Bad: Too many props
<Card
  title="Title"
  content="Content"
  footerContent="Actions"
  hasHeader={true}
  hasFooter={true}
/>
```

**4. Polymorphic Components**
Allow components to render as different HTML elements:
```typescript
<Button as="a" href="/login">Login</Button>
<Button as="button" onClick={handleClick}>Click Me</Button>
```

See `references/component-examples.md` for complete polymorphic component TypeScript patterns.

---

## Theming and Dark Mode

### Theme Structure

```typescript
interface Theme {
  colors: {
    brand: {
      primary: string;
      secondary: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
    background: {
      primary: string;
      secondary: string;
    };
    feedback: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  typography: {
    fontFamily: {
      sans: string;
      mono: string;
    };
    fontSize: Record<string, string>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadow: Record<string, string>;
}
```

### Dark Mode Implementation

**Approach 1: CSS Variables**
```css
:root {
  --color-bg-primary: #ffffff;
  --color-text-primary: #000000;
}

[data-theme="dark"] {
  --color-bg-primary: #1a1a1a;
  --color-text-primary: #ffffff;
}
```

**Approach 2: Tailwind CSS Dark Mode**
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

**Approach 3: Styled Components ThemeProvider**
```typescript
const lightTheme = { background: '#fff', text: '#000' };
const darkTheme = { background: '#000', text: '#fff' };

<ThemeProvider theme={isDark ? darkTheme : lightTheme}>
  <App />
</ThemeProvider>
```

---

## Accessibility Guidelines

### WCAG 2.1 Level AA Compliance

#### Color Contrast
- **Normal text** (< 18pt): 4.5:1 minimum
- **Large text** (≥ 18pt or ≥ 14pt bold): 3:1 minimum
- **UI components**: 3:1 minimum

**Tools**: Use contrast checkers like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

#### Keyboard Navigation
```typescript
// ✅ All interactive elements must be keyboard accessible
<button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</button>

// ✅ Focus management
<Modal>
  <FocusTrap>
    {/* Modal content */}
  </FocusTrap>
</Modal>
```

#### ARIA Attributes
Essential ARIA patterns:
- `aria-label`: Provide accessible names
- `aria-expanded`: Communicate expanded/collapsed state
- `aria-controls`: Associate controls with content
- `aria-live`: Announce dynamic content changes

#### Screen Reader Support
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`)
- Avoid div/span soup for interactive elements
- Provide meaningful labels for all controls

See `references/component-examples.md` for complete accessibility examples including Skip Links, focus traps, and ARIA patterns.

---

## Documentation Standards

### Component Documentation Template

Each component should document:
- **Purpose**: What the component does
- **Usage**: Import statement and basic example
- **Variants**: Available visual styles
- **Props**: Complete prop table with types, defaults, descriptions
- **Accessibility**: Keyboard support, ARIA attributes, screen reader behavior
- **Examples**: Common use cases with code

Use Storybook, Docusaurus, or similar tools for interactive documentation.

See `templates/component-template.tsx` for the standard component structure.

---

## Design System Workflow

### 1. Design Phase
- **Audit existing patterns**: Identify inconsistencies
- **Define design tokens**: Colors, typography, spacing
- **Create component inventory**: List all needed components
- **Design in Figma**: Create component library

### 2. Development Phase
- **Set up tooling**: Storybook, TypeScript, testing
- **Implement tokens**: CSS variables or theme config
- **Build atoms first**: Start with primitives
- **Compose upward**: Build molecules, organisms
- **Document as you go**: Write docs alongside code

### 3. Adoption Phase
- **Create migration guide**: Help teams adopt
- **Provide codemods**: Automate migrations when possible
- **Run workshops**: Train teams on usage
- **Gather feedback**: Iterate based on real usage

### 4. Maintenance Phase
- **Version semantically**: Major/minor/patch releases
- **Deprecation strategy**: Phase out old components gracefully
- **Changelog**: Document all changes
- **Monitor adoption**: Track usage across products

---

## Quick Start Checklist

When creating a new design system:

- [ ] Define design principles and values
- [ ] Establish design token structure (colors, typography, spacing)
- [ ] Create primitive color palette (50-950 scale)
- [ ] Define semantic color tokens (brand, text, background, feedback)
- [ ] Set typography scale and font families
- [ ] Establish spacing scale (4px or 8px base)
- [ ] Design atomic components (Button, Input, Label, etc.)
- [ ] Implement theming system (light/dark mode)
- [ ] Ensure WCAG 2.1 Level AA compliance
- [ ] Set up documentation (Storybook or similar)
- [ ] Create usage examples for each component
- [ ] Establish versioning and release strategy
- [ ] Create migration guides for adopting teams
