# Vue Components

Create Vue Single File Components for $ARGUMENTS following project conventions.

## Task

Create or optimize Vue components based on the requirements:

1. **Analyze project structure**: Check existing Vue components to understand patterns, conventions, and file organization
2. **Examine Vue setup**: Identify Vue version (2/3), TypeScript usage, and Composition/Options API preference
3. **Check styling approach**: Determine if using CSS modules, SCSS, styled-components, or other styling methods
4. **Review testing patterns**: Check existing component tests to understand testing framework and conventions
5. **Create component structure**: Generate SFC with template, script, and style sections
6. **Implement component**: Write TypeScript interfaces, props, emits, and component logic
7. **Add accessibility**: Include proper ARIA attributes and semantic HTML
8. **Create tests**: Write comprehensive component tests following project patterns
9. **Add documentation**: Include JSDoc comments and usage examples

## Component Requirements

- Follow project's TypeScript conventions and interfaces
- Use existing component patterns and naming conventions
- Implement proper props validation and typing
- Add appropriate event emissions with TypeScript signatures
- Include scoped styles following project's styling approach
- Add proper accessibility attributes (ARIA, semantic HTML)
- Consider responsive design if applicable

## Vue Patterns to Consider

Based on the component type:
- **Composition API**: For Vue 3 projects with `<script setup>`
- **Options API**: For Vue 2 or legacy Vue 3 projects
- **Composables**: Extract reusable logic into composables
- **Provide/Inject**: For deep component communication
- **Slots**: For flexible component content
- **Teleport**: For portal-like functionality (Vue 3)

## Important Notes

- ALWAYS examine existing components first to understand project patterns
- Use the same Vue API style (Composition vs Options) as the project
- Follow project's folder structure for components
- Don't install new dependencies without asking
- Consider component performance (v-memo, computed properties)
- Add proper TypeScript types for all props and emits