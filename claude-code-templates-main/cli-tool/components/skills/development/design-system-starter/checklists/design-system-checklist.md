# Design System Checklist

Use this comprehensive checklist when creating or auditing a design system.

---

## Foundation

### Design Principles

- [ ] **Principles Defined**: Core design principles documented (consistency, accessibility, simplicity, etc.)
- [ ] **Values Articulated**: Team values reflected in design decisions
- [ ] **Design Language Documented**: Visual design language explained (tone, personality)

### Design Tokens

#### Color Tokens
- [ ] **Primitive Colors Defined**: Base color palette (50-950 scale for each hue)
- [ ] **Semantic Colors Mapped**: Brand, text, background, border, feedback colors
- [ ] **Color Contrast Validated**: All text meets WCAG 2.1 Level AA (4.5:1 for normal text, 3:1 for large text)
- [ ] **Dark Mode Colors**: Dark theme variants defined (if applicable)
- [ ] **Token Naming**: Consistent, semantic naming (text-primary vs gray-900)

#### Typography Tokens
- [ ] **Font Families Selected**: Primary (sans), secondary (serif), mono fonts
- [ ] **Type Scale Established**: Font sizes from xs (12px) to 5xl (48px)
- [ ] **Font Weights Defined**: At least 3 weights (normal, medium, bold)
- [ ] **Line Heights Set**: Tight (headings), normal (body), relaxed (paragraphs)
- [ ] **Letter Spacing**: Defined for uppercase and large headings

#### Spacing Tokens
- [ ] **Spacing Scale Created**: Consistent scale (4px or 8px base)
- [ ] **Spacing Values**: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24
- [ ] **Component Spacing**: Specific spacing for components (button padding, card gap)

#### Other Tokens
- [ ] **Border Radius**: none, sm, base, md, lg, xl, 2xl, full
- [ ] **Shadows**: xs, sm, base, md, lg, xl
- [ ] **Transitions**: Duration and easing functions
- [ ] **Z-Index Scale**: Defined layering system

---

## Components

### Atomic Components (Atoms)

#### Button
- [ ] **Variants**: Primary, secondary, outline, ghost
- [ ] **Sizes**: sm, md, lg
- [ ] **States**: Default, hover, active, focus, disabled, loading
- [ ] **Icons**: Support for left/right icons
- [ ] **Full Width**: Option for full-width buttons
- [ ] **Accessibility**: Keyboard accessible, ARIA attributes

#### Input
- [ ] **Types**: Text, email, password, number, search
- [ ] **Sizes**: sm, md, lg
- [ ] **States**: Default, focus, error, disabled
- [ ] **Icons**: Support for left/right icons
- [ ] **Helper Text**: Support for hints and error messages
- [ ] **Accessibility**: Labels, ARIA descriptions

#### Checkbox & Radio
- [ ] **Sizes**: sm, md, lg
- [ ] **States**: Default, checked, indeterminate, disabled
- [ ] **Labels**: Properly associated labels
- [ ] **Accessibility**: Keyboard navigation, ARIA states

#### Select / Dropdown
- [ ] **Single Select**: Basic dropdown
- [ ] **Multi Select**: Multiple selection support
- [ ] **Search**: Searchable options (if applicable)
- [ ] **States**: Default, open, disabled
- [ ] **Accessibility**: Keyboard navigation, ARIA combobox

#### Badge
- [ ] **Variants**: Default, success, warning, error, info
- [ ] **Sizes**: sm, md, lg
- [ ] **Removable**: Option for dismiss button

#### Avatar
- [ ] **Sizes**: xs, sm, md, lg, xl
- [ ] **Fallback**: Initials or default icon
- [ ] **Status Indicator**: Online/offline dot (if applicable)

#### Icon
- [ ] **Icon Set**: Consistent icon library (Heroicons, Lucide, etc.)
- [ ] **Sizes**: 16px, 20px, 24px, 32px
- [ ] **Accessibility**: ARIA labels or aria-hidden

### Molecular Components (Molecules)

#### Form Field
- [ ] **Composition**: Label + Input + Helper/Error
- [ ] **Required Indicator**: Asterisk or (required) text
- [ ] **Error States**: Validation error display
- [ ] **Accessibility**: Proper label associations

#### Search Bar
- [ ] **Composition**: Input + Search button/icon
- [ ] **Clear Button**: X to clear search
- [ ] **Keyboard Support**: Enter to submit

#### Card
- [ ] **Variants**: Default, outlined, elevated
- [ ] **Composition**: Header, body, footer sections
- [ ] **Hover State**: If interactive
- [ ] **Clickable Area**: Full card clickable (if applicable)

#### Alert / Toast
- [ ] **Variants**: Success, warning, error, info
- [ ] **Dismissible**: Close button
- [ ] **Icons**: Contextual icons for each variant
- [ ] **Actions**: Optional action buttons

### Organism Components

#### Navigation Bar
- [ ] **Responsive**: Mobile hamburger menu
- [ ] **Logo**: Branding placement
- [ ] **Links**: Primary navigation links
- [ ] **Actions**: Login/signup buttons
- [ ] **Dropdown**: Nested menu support
- [ ] **Accessibility**: Keyboard navigation, ARIA navigation

#### Modal / Dialog
- [ ] **Overlay**: Background overlay
- [ ] **Close Button**: X button and ESC key
- [ ] **Focus Trap**: Focus stays within modal
- [ ] **Sizes**: sm, md, lg, full
- [ ] **Accessibility**: Focus management, ARIA dialog

#### Table
- [ ] **Header**: Column headers
- [ ] **Sortable**: Click to sort columns
- [ ] **Selectable**: Checkbox selection
- [ ] **Pagination**: Built-in or separate component
- [ ] **Responsive**: Mobile-friendly (stacked or scrollable)
- [ ] **Accessibility**: Proper table semantics

#### Pagination
- [ ] **Page Numbers**: Current and nearby pages
- [ ] **Previous/Next**: Arrow navigation
- [ ] **First/Last**: Jump to first/last page
- [ ] **Page Size**: Option to change items per page

---

## Patterns

### Layout Patterns

- [ ] **Grid System**: Responsive grid (12-column or flexbox/grid-based)
- [ ] **Container**: Max-width container for content
- [ ] **Stack**: Vertical spacing component
- [ ] **Cluster**: Horizontal spacing component
- [ ] **Sidebar Layout**: Sidebar + main content

### Form Patterns

- [ ] **Form Validation**: Client-side validation patterns
- [ ] **Multi-Step Forms**: Wizard/stepper component
- [ ] **Inline Editing**: Edit-in-place pattern
- [ ] **Auto-Save**: Periodic save pattern

### Navigation Patterns

- [ ] **Breadcrumbs**: Path navigation
- [ ] **Tabs**: Tab navigation component
- [ ] **Sidebar Navigation**: Collapsible sidebar
- [ ] **Mega Menu**: Large dropdown navigation

### Feedback Patterns

- [ ] **Loading States**: Skeletons, spinners, progress bars
- [ ] **Empty States**: Illustrations and CTAs for empty data
- [ ] **Error States**: User-friendly error pages (404, 500)
- [ ] **Success Confirmation**: Post-action feedback

---

## Accessibility (WCAG 2.1 Level AA)

### Perceivable

- [ ] **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- [ ] **Color Independence**: Information not conveyed by color alone
- [ ] **Text Alternatives**: Alt text for images
- [ ] **Captions**: Video/audio content has captions (if applicable)

### Operable

- [ ] **Keyboard Navigation**: All interactive elements keyboard accessible
- [ ] **Focus Indicators**: Visible focus states (outline, ring)
- [ ] **No Keyboard Traps**: Users can navigate away from all elements
- [ ] **Skip Links**: "Skip to main content" link
- [ ] **Touch Targets**: Minimum 44x44px for mobile

### Understandable

- [ ] **Language Attribute**: `<html lang="en">`
- [ ] **Labels**: Form inputs have labels
- [ ] **Error Messages**: Clear, specific error messages
- [ ] **Consistent Navigation**: Navigation is consistent across pages

### Robust

- [ ] **Valid HTML**: Markup validates
- [ ] **ARIA Attributes**: Proper ARIA labels, roles, states
- [ ] **Name, Role, Value**: Interactive elements have accessible name

---

## Documentation

### Component Documentation

- [ ] **Usage Examples**: Code examples for each component
- [ ] **Props API**: Table of props with types and defaults
- [ ] **Variants**: Visual examples of all variants
- [ ] **States**: Examples of all interactive states
- [ ] **Accessibility Notes**: Keyboard shortcuts, ARIA attributes
- [ ] **Do's and Don'ts**: Usage guidelines with examples

### Design Guidelines

- [ ] **When to Use**: Guidance on component selection
- [ ] **Composition**: How to combine components
- [ ] **Content Guidelines**: Copywriting standards
- [ ] **Spacing Guidelines**: How to apply spacing tokens
- [ ] **Responsive Patterns**: Mobile-first approach

### Getting Started

- [ ] **Installation**: How to install the design system
- [ ] **Setup**: Configuration instructions
- [ ] **Theming**: How to customize tokens
- [ ] **Migration Guide**: Upgrading from previous versions

---

## Tooling & Infrastructure

### Development Tools

- [ ] **Component Library**: React/Vue/Angular/Web Components
- [ ] **Storybook**: Component playground and documentation
- [ ] **TypeScript**: Type definitions for all components
- [ ] **Testing**: Unit and visual regression tests
- [ ] **Linting**: ESLint/Stylelint configured

### Build & Distribution

- [ ] **Package Manager**: NPM/Yarn package published
- [ ] **Versioning**: Semantic versioning (major.minor.patch)
- [ ] **Changelog**: All changes documented
- [ ] **Tree-Shaking**: Components importable individually
- [ ] **Bundle Size**: Optimized for performance

### Design Tools

- [ ] **Figma Library**: Component library in Figma
- [ ] **Design Tokens**: Tokens exported to Figma (Style Dictionary, Figma Tokens)
- [ ] **Shared Styles**: Colors, text styles, effects synced
- [ ] **Component Variants**: All variants available in Figma

---

## Theming & Customization

### Theme Support

- [ ] **Light Theme**: Default light mode
- [ ] **Dark Theme**: Dark mode variant
- [ ] **Theme Toggle**: Mechanism to switch themes
- [ ] **System Preference**: Respect OS theme preference
- [ ] **Persistent Choice**: Remember user's theme choice

### Customization

- [ ] **Token Override**: Ability to override design tokens
- [ ] **CSS Variables**: Tokens exposed as CSS variables
- [ ] **Theme API**: Programmatic theme customization
- [ ] **Brand Variants**: Support for multiple brands (if applicable)

---

## Quality Assurance

### Visual Testing

- [ ] **Visual Regression Tests**: Chromatic, Percy, or similar
- [ ] **Cross-Browser Testing**: Chrome, Firefox, Safari, Edge
- [ ] **Responsive Testing**: Mobile, tablet, desktop viewports
- [ ] **Dark Mode Testing**: All components in dark mode

### Functional Testing

- [ ] **Unit Tests**: Component logic tested
- [ ] **Integration Tests**: Component interactions tested
- [ ] **Accessibility Tests**: Automated a11y tests (axe, WAVE)

### Performance

- [ ] **Bundle Size**: < 100KB gzipped for core components
- [ ] **Lazy Loading**: Heavy components lazy-loaded
- [ ] **Tree-Shaking**: Unused components not included

---

## Governance

### Contribution Guidelines

- [ ] **CONTRIBUTING.md**: How to contribute
- [ ] **Code of Conduct**: Community standards
- [ ] **PR Template**: Standard pull request format
- [ ] **Review Process**: How contributions are reviewed

### Versioning & Deprecation

- [ ] **Semantic Versioning**: Follow SemVer
- [ ] **Deprecation Policy**: How long deprecated components are supported
- [ ] **Migration Guides**: Help for breaking changes
- [ ] **Release Notes**: What changed in each version

### Roadmap

- [ ] **Public Roadmap**: Future plans visible
- [ ] **Feedback Channel**: Users can request features
- [ ] **Regular Releases**: Predictable release schedule

---

## Adoption & Maintenance

### Onboarding

- [ ] **Getting Started Guide**: Quick start documentation
- [ ] **Tutorial**: Step-by-step walkthrough
- [ ] **Video Demos**: Recorded demos (optional)
- [ ] **Support Channel**: Slack, Discord, or forum

### Metrics

- [ ] **Adoption Tracking**: Monitor usage across products
- [ ] **Component Usage**: Which components are most used
- [ ] **Issue Tracking**: Bug reports and feature requests
- [ ] **Performance Metrics**: Bundle size, load times

### Iteration

- [ ] **Quarterly Reviews**: Regular design system audits
- [ ] **User Research**: Gather feedback from users
- [ ] **Component Deprecation**: Remove unused components
- [ ] **Design Updates**: Refresh styles periodically

---

## Pre-Launch Checklist

Before publishing v1.0:

- [ ] **All Atoms Complete**: Button, Input, Checkbox, Radio, Select, Badge, Avatar, Icon
- [ ] **Key Molecules Complete**: FormField, Card, Alert, SearchBar
- [ ] **Core Organisms Complete**: Modal, Navigation, Table, Pagination
- [ ] **Design Tokens Finalized**: Colors, typography, spacing locked
- [ ] **Accessibility Audit**: WCAG 2.1 Level AA compliance verified
- [ ] **Documentation Complete**: All components documented
- [ ] **Tests Passing**: 100% test pass rate
- [ ] **Figma Library Published**: Design library available
- [ ] **NPM Package Published**: Package available on NPM
- [ ] **Migration Guide**: From previous system or custom components

---

## Post-Launch

- [ ] **Announce Launch**: Internal announcement and blog post
- [ ] **Training Sessions**: Workshops for teams
- [ ] **Office Hours**: Regular Q&A sessions
- [ ] **Gather Feedback**: Collect early adopter feedback
- [ ] **Iterate Quickly**: Address issues in patch releases

---

**Checklist Version**: 1.0.0
**Skill**: design-system-starter v1.0.0
**Last Updated**: 2025-10-31
