# React Hooks

Create or optimize React hooks for $ARGUMENTS following project conventions.

## Task

Analyze the request and create appropriate React hooks:

1. **Examine existing hooks**: Check project for existing custom hooks patterns and conventions
2. **Identify hook type**: Determine if creating new custom hook, optimizing existing hook, or implementing specific hook pattern
3. **Check TypeScript usage**: Verify if project uses TypeScript and follow typing conventions
4. **Implement hook**: Create hook with proper:
   - Naming convention (use prefix)
   - TypeScript types and interfaces
   - Proper dependency arrays
   - Error handling
   - Performance optimizations
5. **Add tests**: Create comprehensive unit tests using project's testing framework
6. **Add documentation**: Include JSDoc comments and usage examples

## Common Hook Patterns

When creating hooks, consider these patterns based on the request:
- **Data fetching**: API calls, loading states, error handling
- **State management**: Local state, derived state, state persistence
- **Side effects**: Event listeners, timers, subscriptions
- **Context consumption**: Theme, auth, app state
- **Form handling**: Input management, validation, submission
- **Performance**: Memoization, debouncing, throttling

## Requirements

- Follow existing project hook conventions
- Use TypeScript if project uses it
- Include proper cleanup in useEffect
- Add error boundaries where appropriate
- Write tests that cover all hook functionality
- IMPORTANT: Always check existing hooks first to understand project patterns

## Notes

- Ask for clarification if the hook requirements are ambiguous
- Suggest optimizations for existing hooks if relevant
- Consider accessibility implications for UI-related hooks