# Design System Starter

A comprehensive Claude Code skill for creating and evolving production-ready design systems with design tokens, component architecture, accessibility guidelines, and documentation templates.

## Purpose

This skill helps you build robust, scalable design systems that ensure visual consistency and exceptional user experiences across your products. It provides structured guidance for:

- Defining and organizing design tokens (colors, typography, spacing, shadows)
- Architecting components using atomic design methodology
- Implementing theming and dark mode support
- Ensuring WCAG 2.1 Level AA accessibility compliance
- Creating comprehensive component documentation
- Establishing maintainable design system workflows

## When to Use

Use this skill when you need to:

- Create a new design system from scratch
- Standardize UI patterns across multiple products
- Implement design tokens for consistent styling
- Structure components using atomic design principles
- Ensure accessibility compliance (WCAG 2.1 AA)
- Set up theming and dark mode support
- Document component libraries effectively
- Migrate from inconsistent UI patterns to a unified system

## How It Works

The skill provides comprehensive guidance and templates organized around five core areas:

### 1. Design Tokens
Structured JSON templates for defining foundational design decisions:
- **Color systems**: Primitive colors (50-950 scale) and semantic tokens (brand, text, background, feedback)
- **Typography**: Font families, sizes, weights, line heights, letter spacing
- **Spacing**: Consistent scale based on 4px or 8px units
- **Border radius**: Reusable corner rounding values
- **Shadows**: Elevation system for depth

### 2. Component Architecture
Atomic design methodology for building UI:
- **Atoms**: Primitive components (Button, Input, Label, Icon)
- **Molecules**: Simple compositions (FormField, SearchBar, Card)
- **Organisms**: Complex compositions (Navigation, Modal, ProductGrid)
- **Templates**: Page layouts
- **Pages**: Specific instances with real content

### 3. Accessibility
Built-in WCAG 2.1 Level AA compliance:
- Color contrast validation (4.5:1 for normal text, 3:1 for large text)
- Keyboard navigation patterns
- ARIA attributes and screen reader support
- Focus management

### 4. Theming
Multiple approaches for light/dark mode:
- CSS custom properties
- Tailwind CSS dark mode utilities
- Styled Components ThemeProvider

### 5. Documentation
Standards for component documentation:
- Component purpose and usage
- Props API with types and defaults
- Accessibility notes
- Common examples

## Key Features

### Design Token System
- W3C design tokens format
- Primitive and semantic color systems
- Typography scales with accessibility in mind
- Consistent spacing based on mathematical scale
- Shadow system for elevation

### Component Templates
- TypeScript-first component templates
- Polymorphic component patterns
- Compound component API design
- Variant and size systems
- Complete accessibility support

### Bundled Resources
The skill includes ready-to-use templates and references:
- `templates/design-tokens-template.json` - Complete token structure
- `templates/component-template.tsx` - React component boilerplate
- `references/component-examples.md` - Full implementations with variants
- `checklists/design-system-checklist.md` - Audit checklist

### Accessibility First
- WCAG 2.1 Level AA compliance by default
- Color contrast guidelines and testing recommendations
- Keyboard navigation patterns
- ARIA best practices
- Screen reader support patterns

## Usage Examples

### Example 1: Create a New Design System

```
Create a design system for my React app with dark mode support
```

The skill will guide you through:
1. Setting up design tokens (colors, typography, spacing)
2. Creating atomic components (Button, Input, Card)
3. Implementing dark mode with CSS variables
4. Ensuring accessibility compliance
5. Setting up documentation structure

### Example 2: Add Design Tokens

```
Set up design tokens for colors and spacing using the 8px scale
```

Provides:
- Color token structure (primitive + semantic)
- Spacing scale based on 8px units
- JSON format compatible with Style Dictionary
- CSS variable implementation

### Example 3: Component Architecture

```
Design component structure using atomic design for my dashboard
```

Delivers:
- Breakdown of atoms, molecules, organisms needed
- Component hierarchy and relationships
- Props API design patterns
- Composition guidelines

### Example 4: Accessibility Audit

```
Ensure WCAG 2.1 compliance for my button components
```

Checks:
- Color contrast ratios
- Keyboard navigation support
- ARIA attributes
- Focus states
- Screen reader announcements

### Example 5: Theming Implementation

```
Implement theming with dark mode using CSS variables
```

Provides:
- CSS custom property structure
- Light/dark theme definitions
- Theme switching logic
- Component integration patterns

## Triggers

The skill activates on these common phrases:

| Trigger Phrase | What It Does |
|---------------|--------------|
| "Create a design system" | Full design system setup |
| "Set up design tokens" | Token structure and implementation |
| "Design component structure" | Atomic design architecture |
| "Ensure WCAG compliance" | Accessibility guidelines and patterns |
| "Implement dark mode" | Theming and dark mode support |
| "Component architecture" | Component organization patterns |
| "Accessibility guidelines" | WCAG 2.1 AA compliance |

## Output Examples

### Design Tokens Output
Complete JSON structure with:
- Color primitives (50-950 scale for each hue)
- Semantic color tokens mapped to primitives
- Typography scale (xs to 5xl)
- Spacing scale (0 to 24)
- Border radius and shadow tokens

### Component Architecture Output
- Atomic design hierarchy diagram
- Component inventory by category
- Props interface definitions
- Implementation examples with TypeScript
- Accessibility notes for each component

### Theming Output
- Theme structure interface
- Light and dark theme definitions
- CSS variable mapping
- Theme provider setup
- Component integration patterns

### Accessibility Checklist Output
- Color contrast validation results
- Keyboard navigation requirements
- ARIA attribute recommendations
- Screen reader testing notes
- Focus management patterns

## Design Philosophy

The skill is built on four core principles:

1. **Consistency Over Creativity**: Predictable patterns reduce cognitive load and help users learn once, apply everywhere

2. **Accessible by Default**: WCAG 2.1 Level AA compliance minimum, keyboard navigation built-in, screen reader support from the start

3. **Scalable and Maintainable**: Design tokens enable global changes, component composition reduces duplication

4. **Developer-Friendly**: Clear API contracts, comprehensive documentation, easy to integrate and customize

## Integration

Works seamlessly with popular tools and frameworks:
- **React/TypeScript**: Primary target with complete TypeScript support
- **Style Dictionary**: Compatible token format for multi-platform output
- **Tailwind CSS**: Design token mapping to Tailwind config
- **Styled Components**: Theme provider integration
- **Storybook**: Documentation templates and story patterns
- **Figma**: Token naming aligned with Figma variables

## Related Skills

- `landing-page-guide-v2`: Uses design system principles for landing pages
- `nextjs15-init`: Can initialize projects with design system structure
- `mui`: Material-UI specific patterns (alternative approach)

## License

MIT

## Version

1.0.0
