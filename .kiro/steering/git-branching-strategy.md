---
inclusion: auto
---

# Git Branching Strategy & Feature Isolation

You are an AI software engineer working on a collaborative project using Git. Follow these rules STRICTLY to ensure clean, merge-safe feature development.

## Branching Strategy

### Branch Creation Rules
- **Every new feature MUST be developed in a new branch**
- **ALWAYS create the branch from the latest main branch**
- **NEVER create a branch from another feature branch**
- Use descriptive branch names: `feature/feature-name`, `fix/bug-name`, `enhancement/improvement-name`

### Branch Naming Conventions
```
feature/sidebar-enhancements
feature/dark-mode
feature/dark-mode-enhancements
fix/login-validation
enhancement/performance-optimization
```

## Feature Isolation

### One Feature Per Branch
- Each branch must contain ONLY one feature or improvement
- Do NOT mix multiple features in the same branch
- Keep changes focused and atomic
- If a feature has multiple parts, consider if they should be separate branches

### Examples of Proper Isolation
Γ£à **CORRECT:**
- Branch 1: `feature/sidebar-enhancements` - Only sidebar changes
- Branch 2: `feature/dark-mode` - Only dark mode implementation
- Branch 3: `feature/dark-mode-enhancements` - Only dark mode improvements

Γ¥î **INCORRECT:**
- Branch 1: `feature/ui-updates` - Contains sidebar, dark mode, and navigation changes (too broad)

## No Direct Merging

### Merge Policy
- **Do NOT merge branches yourself unless explicitly instructed**
- Assume branches will be merged later by the team
- Your code must be merge-safe and ready for integration
- Write code that anticipates future merges

## Merge Compatibility

### Conflict Prevention
- Write code in a way that ensures it will NOT break when merged with other feature branches
- **Avoid modifying the same lines/files unless necessary**
- If overlap is unavoidable, structure the code to minimize conflicts

### Strategies for Merge-Safe Code

#### 1. Modular Architecture
```javascript
// Γ£à GOOD: Separate, independent modules
// feature/dark-mode branch
export const darkModeConfig = { /* ... */ };

// feature/sidebar-enhancements branch
export const sidebarConfig = { /* ... */ };
```

```javascript
// Γ¥î BAD: Both features modifying the same config object
// This will cause merge conflicts
export const appConfig = {
  theme: 'dark',  // feature/dark-mode
  sidebar: { /* ... */ }  // feature/sidebar-enhancements
};
```

#### 2. Additive Changes
- Prefer adding new files over modifying existing ones
- Add new functions/components rather than modifying existing ones
- Use composition over modification

```javascript
// Γ£à GOOD: Adding new functionality
// feature/dark-mode
export const DarkModeToggle = () => { /* ... */ };

// feature/sidebar-enhancements
export const SidebarMenu = () => { /* ... */ };
```

#### 3. Configuration-Based Approach
```javascript
// Γ£à GOOD: Each feature adds its own config entry
// feature/dark-mode
export const darkModeFeature = {
  enabled: true,
  config: { /* ... */ }
};

// feature/sidebar-enhancements
export const sidebarFeature = {
  enabled: true,
  config: { /* ... */ }
};
```

#### 4. Avoid Shared State Modifications
- Don't modify global state that other features might use
- Use feature flags or configuration objects
- Keep feature logic isolated

## Stability Requirement

### Pre-Merge Checklist
Even before merging, each branch must:

- Γ£à **Build successfully** - No compilation or build errors
- Γ£à **Not break existing functionality** - All existing features work
- Γ£à **Follow project structure and conventions** - Consistent with codebase
- Γ£à **Pass all tests** - Unit, integration, and E2E tests pass
- Γ£à **No linting errors** - Code follows style guidelines
- Γ£à **Proper error handling** - No unhandled exceptions
- Γ£à **Documentation updated** - README, comments, and docs reflect changes

## Example Workflow

### Scenario: Multiple Related Features

**Feature 1: Dark Mode Foundation**
```bash
git checkout main
git pull origin main
git checkout -b feature/dark-mode
# Implement base dark mode functionality
# - Add theme context
# - Create theme provider
# - Add CSS variables for colors
```

**Feature 2: Dark Mode Toggle**
```bash
git checkout main
git pull origin main
git checkout -b feature/dark-mode-toggle
# Implement toggle component
# - Create toggle button component
# - Add toggle to header
# - Persist preference to localStorage
```

**Feature 3: Dark Mode Enhancements**
```bash
git checkout main
git pull origin main
git checkout -b feature/dark-mode-enhancements
# Add advanced features
# - Auto-detect system preference
# - Smooth transitions
# - Per-component theme overrides
```

### Integration Consideration
When these branches are merged together later:
- Theme context should work with toggle component
- Enhancements should extend base functionality
- No conflicts in CSS variable definitions
- All features work independently and together

## Code Quality Standards

### Modularity
- Keep code modular and reusable
- Use clear separation of concerns
- Avoid tight coupling between features

### Naming Conventions
- Use clear, descriptive names for variables, functions, and components
- Follow project naming conventions consistently
- Make intent obvious from the name

### Dependencies
- Avoid hard dependencies between features unless necessary
- Use dependency injection or configuration when features need to interact
- Document any cross-feature dependencies clearly

### File Organization
```
Γ£à GOOD: Separate feature directories
src/
  features/
    dark-mode/
      DarkModeProvider.tsx
      useDarkMode.ts
      darkMode.css
    sidebar/
      Sidebar.tsx
      useSidebar.ts
      sidebar.css
```

```
Γ¥î BAD: Mixed feature files
src/
  components/
    AppComponent.tsx  // Contains dark mode + sidebar logic
  styles/
    app.css  // Contains dark mode + sidebar styles
```

## Conflict Resolution Strategies

### When Conflicts Are Unavoidable

#### 1. Coordinate File Modifications
If multiple features must modify the same file:
- Add new code at different locations (top vs bottom)
- Use clear section comments
- Keep changes minimal and focused

```javascript
// Γ£à GOOD: Clear sections for different features
// === Dark Mode Feature ===
export const darkModeUtils = { /* ... */ };

// === Sidebar Feature ===
export const sidebarUtils = { /* ... */ };
```

#### 2. Use Feature Flags
```javascript
// Γ£à GOOD: Feature flags allow independent development
const features = {
  darkMode: process.env.FEATURE_DARK_MODE === 'true',
  enhancedSidebar: process.env.FEATURE_ENHANCED_SIDEBAR === 'true',
};

if (features.darkMode) {
  // Dark mode logic
}

if (features.enhancedSidebar) {
  // Sidebar logic
}
```

#### 3. Extension Points
Design code with extension points for future features:

```javascript
// Γ£à GOOD: Plugin-style architecture
const themePlugins = [];

// feature/dark-mode adds:
themePlugins.push(darkModePlugin);

// feature/high-contrast adds:
themePlugins.push(highContrastPlugin);
```

## Testing for Merge Safety

### Before Committing
1. **Pull latest main** - Ensure you're working with the latest code
2. **Test locally** - Verify your feature works in isolation
3. **Check for conflicts** - Mentally review what other features might touch
4. **Run full test suite** - Ensure nothing breaks
5. **Review your changes** - Look for potential conflict areas

### Code Review Considerations
When reviewing your own code before pushing:
- Would this conflict with common modification areas?
- Are there shared files that other features might modify?
- Is the code structured to minimize merge conflicts?
- Can this be refactored to be more isolated?

## Summary

Your goal: **Produce clean, independent, and merge-ready feature implementations that will work correctly when combined later into a single branch.**

### Key Principles
1. **Branch from main, always**
2. **One feature per branch**
3. **No self-merging**
4. **Write merge-safe code**
5. **Keep features isolated**
6. **Build successfully**
7. **Maintain stability**
8. **Think ahead to integration**

By following these guidelines, you ensure that:
- Features can be developed in parallel
- Merge conflicts are minimized
- Code quality remains high
- Integration is smooth and predictable
- The project remains stable throughout development
