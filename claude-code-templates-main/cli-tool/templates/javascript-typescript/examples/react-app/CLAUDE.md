# CLAUDE.md - React Application

This file provides guidance to Claude Code when working with React applications using TypeScript.

## Project Type

This is a React application with TypeScript support.

## Development Commands

### Component Development
- **`/component`** - Create React components with TypeScript
- **`/hooks`** - Create and manage React hooks
- **`/state-management`** - Implement state management solutions

### Testing and Quality
- **`/test`** - Run tests and create test files
- **`/lint`** - Run linting and fix code style issues
- **`/typescript-migrate`** - Migrate JavaScript files to TypeScript

### Development Workflow
- **`/npm-scripts`** - Run npm scripts and package management
- **`/debug`** - Debug React applications
- **`/refactor`** - Refactor and optimize code

## Framework-Specific Guidelines

### React Best Practices
- Use functional components with hooks
- Implement proper TypeScript typing for props and state
- Follow React performance optimization patterns
- Use proper component composition patterns

### State Management
- Use useState for local component state
- Consider useContext for shared state
- Implement Redux Toolkit for complex state management
- Use Zustand for lightweight state management

### Component Architecture
- Keep components small and focused
- Use custom hooks for reusable logic
- Implement proper prop drilling prevention
- Follow component testing best practices

### Performance Optimization
- Use React.memo for expensive components
- Implement proper dependency arrays in useEffect
- Use useMemo and useCallback judiciously
- Optimize bundle size with code splitting

## TypeScript Configuration

The project uses strict TypeScript configuration:
- Strict type checking enabled
- Proper interface definitions for props
- Generic type support for reusable components
- Integration with React's built-in types

## Testing Strategy

- Unit tests with Jest and React Testing Library
- Component testing with proper mocking
- Integration tests for complex workflows
- E2E tests for critical user journeys

## File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `UserCard.tsx`)
- Hooks: `use` prefix in `camelCase` (e.g., `useApiData.ts`)
- Types: `types.ts` or inline interfaces
- Tests: `ComponentName.test.tsx`

## Recommended Libraries

- **State Management**: Redux Toolkit, Zustand, Context API
- **Styling**: Styled-components, Emotion, Tailwind CSS
- **Forms**: React Hook Form, Formik
- **Routing**: React Router v6
- **HTTP Client**: Axios, SWR, React Query
- **Testing**: Jest, React Testing Library, Cypress