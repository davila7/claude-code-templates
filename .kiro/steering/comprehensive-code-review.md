---
inclusion: auto
---

# Comprehensive Code Review & Automated Checks Guide

When performing code reviews or building new features, systematically verify all areas to ensure the code passes all automated checks and gets full marks.

## Understanding Automated Checks

### GitHub Actions - Component Security Validation / Security Audit
**What it checks:**
- Scans for exposed secrets, API keys, and credentials in code
- Detects hardcoded passwords, tokens, and sensitive data
- Checks for known security vulnerabilities in dependencies
- Validates security best practices in code patterns
- Scans for common vulnerabilities (SQL injection, XSS, CSRF)

**How it works:**
- Runs automated security scanners on pull requests
- Uses pattern matching to detect secrets
- Checks against vulnerability databases (CVE, npm audit)
- Analyzes code for security anti-patterns

### Vercel - Deployment Checks
**What it checks:**
- **Vercel Agent Review**: AI-powered code review for deployment issues
- **Vercel Preview Comments**: Feedback on preview deployments
- **Vercel Deployments**: Actual build and deployment success for each project
  - `aitmpl` - Main application deployment
  - `aitmpl-dashboard` - Dashboard deployment
  - `claude-code-templates` - Templates deployment

**How it works:**
- Builds the project in Vercel's environment
- Validates environment variables are set
- Checks build commands execute successfully
- Verifies output directory contains valid build artifacts
- Tests that the deployment is accessible

### Cubic AI Code Reviewer
**What it checks:**
- Code quality and best practices
- Potential bugs and logic errors
- Performance issues
- Code style and conventions
- Complexity and maintainability

**How it works:**
- AI analyzes code changes in the PR
- Provides inline comments on issues
- Suggests improvements and optimizations
- Flags potential problems before human review

---

## Systematic Code Review Checklist

When building features or reviewing code, check these areas systematically:

## 1. SECURITY AUDIT

### Secrets & Credentials
- [ ] No API keys, passwords, or tokens hardcoded in code
- [ ] No credentials in environment files committed to git
- [ ] No sensitive data in console.log statements
- [ ] No authentication tokens in client-side code
- [ ] All secrets use environment variables
- [ ] `.env` files are in `.gitignore`

**How to check:**
```bash
# Search for potential secrets
grep -r "api_key\|apiKey\|API_KEY\|password\|secret\|token" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" .

# Check for hardcoded URLs with credentials
grep -r "://.*:.*@" --include="*.js" --include="*.ts" .
```

### Vulnerability Scanning
- [ ] Run `npm audit` or `yarn audit` to check dependencies
- [ ] No high or critical severity vulnerabilities
- [ ] Dependencies are up to date
- [ ] No deprecated packages in use

**How to check:**
```bash
npm audit
npm audit fix  # Fix automatically if possible
```

### Input Validation & Sanitization
- [ ] All user inputs are validated
- [ ] SQL queries use parameterized statements (no string concatenation)
- [ ] HTML output is properly escaped (prevent XSS)
- [ ] File uploads are validated (type, size, content)
- [ ] API endpoints validate request data

**Code patterns to check:**
```javascript
// Γ¥î BAD: SQL Injection vulnerability
const query = `SELECT * FROM users WHERE id = ${userId}`;

// Γ£à GOOD: Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// Γ¥î BAD: XSS vulnerability
element.innerHTML = userInput;

// Γ£à GOOD: Safe text content
element.textContent = userInput;
// OR use a sanitization library
element.innerHTML = DOMPurify.sanitize(userInput);
```

### Authentication & Authorization
- [ ] Authentication is required for protected routes
- [ ] Authorization checks are in place (user permissions)
- [ ] JWT tokens are validated properly
- [ ] Session management is secure
- [ ] CSRF protection is implemented for state-changing operations

---

## 2. BUILD & DEPLOYMENT (Vercel)

### Vercel Configuration
- [ ] `vercel.json` exists and is properly configured
- [ ] Build command is correct
- [ ] Output directory is specified correctly
- [ ] Environment variables are defined in Vercel dashboard
- [ ] Routes and redirects are configured properly

**Check vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "nextjs",
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Build Success
- [ ] Project builds without errors locally
- [ ] All imports resolve correctly
- [ ] No circular dependencies
- [ ] TypeScript compiles without errors
- [ ] No missing dependencies in package.json

**How to check:**
```bash
# Clean build test
rm -rf node_modules dist .next
npm install
npm run build

# Check for circular dependencies
npx madge --circular --extensions ts,tsx,js,jsx src/
```

### Environment Variables
- [ ] All required env vars are documented
- [ ] `.env.example` file exists with all variables
- [ ] No hardcoded environment-specific values
- [ ] Env vars are set in Vercel dashboard for each deployment

**Create .env.example:**
```bash
# Required environment variables
DATABASE_URL=
API_KEY=
NEXT_PUBLIC_API_URL=
```

### Path & Import Issues
- [ ] No absolute paths that break in deployment
- [ ] All imports use correct relative or aliased paths
- [ ] Public assets are in the correct directory
- [ ] No references to local file system paths

---

## 3. CODE QUALITY & BEST PRACTICES

### Naming Conventions
- [ ] Variables use camelCase: `userName`, `isActive`
- [ ] Constants use UPPER_SNAKE_CASE: `API_URL`, `MAX_RETRIES`
- [ ] Classes/Components use PascalCase: `UserProfile`, `DataTable`
- [ ] Files follow project conventions
- [ ] Functions have descriptive names that indicate their purpose

### Code Duplication
- [ ] No repeated code blocks (DRY principle)
- [ ] Common logic extracted to utility functions
- [ ] Shared components are reusable
- [ ] Configuration is centralized

**Refactoring example:**
```javascript
// Γ¥î BAD: Duplicated logic
function getUserName(user) {
  return user.firstName + ' ' + user.lastName;
}
function getAuthorName(author) {
  return author.firstName + ' ' + author.lastName;
}

// Γ£à GOOD: Extracted common logic
function getFullName(person) {
  return `${person.firstName} ${person.lastName}`;
}
```

### Dead Code & Unused Imports
- [ ] No commented-out code blocks
- [ ] No unused imports
- [ ] No unused variables or functions
- [ ] No unreachable code

**How to check:**
```bash
# ESLint can detect unused vars
npx eslint . --ext .js,.jsx,.ts,.tsx

# TypeScript can detect unused code
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

### Error Handling
- [ ] All async operations have error handling
- [ ] Try-catch blocks are used appropriately
- [ ] Errors are logged properly
- [ ] User-friendly error messages are shown
- [ ] Error boundaries are implemented (React)

**Error handling patterns:**
```javascript
// Γ£à GOOD: Proper error handling
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    // Show user-friendly message
    showErrorToast('Unable to load data. Please try again.');
    return null;
  }
}
```

### Performance
- [ ] No unnecessary re-renders (React)
- [ ] Large lists use virtualization
- [ ] Images are optimized and lazy-loaded
- [ ] No memory leaks (event listeners cleaned up)
- [ ] Expensive operations are memoized

---

## 4. TYPESCRIPT/JAVASCRIPT STANDARDS

### Type Safety
- [ ] No `any` types unless absolutely necessary
- [ ] All function parameters are typed
- [ ] All function return types are specified
- [ ] Interfaces/types are defined for complex objects
- [ ] Proper use of generics where applicable

**TypeScript best practices:**
```typescript
// Γ¥î BAD: Using any
function processData(data: any): any {
  return data.value;
}

// Γ£à GOOD: Proper typing
interface DataItem {
  value: string;
  id: number;
}

function processData(data: DataItem): string {
  return data.value;
}
```

### Null/Undefined Handling
- [ ] Null checks are in place where needed
- [ ] Optional chaining (`?.`) is used appropriately
- [ ] Nullish coalescing (`??`) is used for default values
- [ ] No potential "Cannot read property of undefined" errors

**Safe null handling:**
```typescript
// Γ£à GOOD: Safe property access
const userName = user?.profile?.name ?? 'Anonymous';

// Γ£à GOOD: Safe array access
const firstItem = items?.[0];

// Γ£à GOOD: Safe function call
const result = callback?.();
```

### Async/Await
- [ ] Promises are properly awaited
- [ ] No unhandled promise rejections
- [ ] Async functions have proper error handling
- [ ] No mixing of async/await and .then()

**Async patterns:**
```javascript
// Γ£à GOOD: Proper async/await
async function loadUserData(userId) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchUserPosts(userId);
    return { user, posts };
  } catch (error) {
    console.error('Error loading user data:', error);
    throw error;
  }
}
```

---

## 5. REACT STANDARDS (if applicable)

### Component Structure
- [ ] Components are in PascalCase files: `UserProfile.tsx`
- [ ] One component per file (unless small related components)
- [ ] Props are properly typed with interfaces
- [ ] Components are functional (not class-based unless necessary)

### Hooks Usage
- [ ] `useState` is used correctly
- [ ] `useEffect` has proper dependency arrays
- [ ] No missing dependencies in useEffect
- [ ] Custom hooks follow `use` prefix convention
- [ ] Hooks are not called conditionally

**Hook best practices:**
```typescript
// Γ£à GOOD: Proper useEffect dependencies
useEffect(() => {
  fetchData(userId);
}, [userId]); // userId is in dependency array

// Γ¥î BAD: Missing dependency
useEffect(() => {
  fetchData(userId);
}, []); // userId should be in array

// Γ£à GOOD: Cleanup in useEffect
useEffect(() => {
  const subscription = subscribeToData();
  return () => subscription.unsubscribe();
}, []);
```

### Performance Optimization
- [ ] `useMemo` for expensive calculations
- [ ] `useCallback` for function props to prevent re-renders
- [ ] `React.memo` for components that render often with same props
- [ ] Keys are used properly in lists (not array index)

### Accessibility
- [ ] All images have `alt` attributes
- [ ] Buttons and links have descriptive text
- [ ] Form inputs have associated labels
- [ ] ARIA attributes are used where needed
- [ ] Keyboard navigation works properly
- [ ] Color contrast meets WCAG standards

**Accessibility examples:**
```jsx
// Γ£à GOOD: Accessible form
<label htmlFor="email">Email Address</label>
<input id="email" type="email" aria-required="true" />

// Γ£à GOOD: Accessible button
<button aria-label="Close dialog" onClick={handleClose}>
  <CloseIcon />
</button>

// Γ£à GOOD: Accessible image
<img src="/logo.png" alt="Company Logo" />
```

---

## 6. COMMENTS & DOCUMENTATION

### Code Comments
- [ ] Complex logic has explanatory comments
- [ ] Comments explain "why", not "what"
- [ ] No commented-out code
- [ ] TODOs have context and assignee if possible
- [ ] JSDoc comments for public functions

**Comment best practices:**
```javascript
// Γ£à GOOD: Explains why
// Using setTimeout to debounce rapid clicks and prevent duplicate submissions
setTimeout(handleSubmit, 300);

// Γ¥î BAD: States the obvious
// Set the name variable to user.name
const name = user.name;

/**
 * Calculates the total price including tax and discounts
 * @param {number} basePrice - The base price before calculations
 * @param {number} taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @param {number} discount - Discount amount to subtract
 * @returns {number} Final price after tax and discount
 */
function calculateTotal(basePrice, taxRate, discount) {
  return (basePrice - discount) * (1 + taxRate);
}
```

### Documentation
- [ ] README.md is up to date
- [ ] Setup instructions are clear
- [ ] API endpoints are documented
- [ ] Environment variables are documented
- [ ] Complex features have documentation

---

## 7. FILE & FOLDER STRUCTURE

### Organization
- [ ] Files are in appropriate directories
- [ ] Related files are grouped together
- [ ] No deeply nested directories (max 3-4 levels)
- [ ] Naming conventions are consistent

**Recommended structure:**
```
src/
Γö£ΓöÇΓöÇ components/       # Reusable UI components
Γö£ΓöÇΓöÇ pages/           # Page components
Γö£ΓöÇΓöÇ features/        # Feature-specific code
Γö£ΓöÇΓöÇ hooks/           # Custom React hooks
Γö£ΓöÇΓöÇ utils/           # Utility functions
Γö£ΓöÇΓöÇ services/        # API services
Γö£ΓöÇΓöÇ types/           # TypeScript types
Γö£ΓöÇΓöÇ styles/          # Global styles
ΓööΓöÇΓöÇ config/          # Configuration files
```

### Import Paths
- [ ] Imports use consistent path style (relative vs absolute)
- [ ] Path aliases are configured if needed (`@/components`)
- [ ] No circular dependencies between modules

**Import best practices:**
```typescript
// Γ£à GOOD: Using path aliases
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';

// Γ£à GOOD: Relative imports for nearby files
import { helper } from './utils/helper';
```

---

## 8. ENVIRONMENT & CONFIGURATION

### Environment Variables
- [ ] All env vars are documented in `.env.example`
- [ ] No sensitive data in `.env` files in git
- [ ] `.env` is in `.gitignore`
- [ ] Env vars are validated at startup
- [ ] Different configs for dev/staging/production

**Environment setup:**
```javascript
// Γ£à GOOD: Validate required env vars
const requiredEnvVars = ['DATABASE_URL', 'API_KEY', 'JWT_SECRET'];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

### .gitignore
- [ ] `node_modules/` is ignored
- [ ] `.env` and `.env.local` are ignored
- [ ] Build output directories are ignored
- [ ] IDE-specific files are ignored
- [ ] OS-specific files are ignored (.DS_Store)

**Essential .gitignore entries:**
```
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Build output
dist/
build/
.next/
out/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

---

## OUTPUT FORMAT FOR CODE REVIEWS

When performing a code review, structure findings as follows:

### CRITICAL ISSUES (Must fix before merge)
Issues that will break the build, expose security vulnerabilities, or cause runtime errors.

Example:
- **Exposed API key in `src/config.ts`**: Remove hardcoded API key on line 15 and use environment variable instead: `process.env.API_KEY`

### HIGH PRIORITY (Should fix)
Issues that significantly impact code quality, performance, or maintainability.

Example:
- **Missing error handling in `fetchUserData()`**: Add try-catch block to handle network failures and show user-friendly error message

### MEDIUM PRIORITY (Nice to fix)
Issues that improve code quality but don't block deployment.

Example:
- **Code duplication in user components**: Extract common user display logic into a shared `UserCard` component

### LOW PRIORITY (Optional improvements)
Suggestions for future improvements or optimizations.

Example:
- **Consider memoizing expensive calculation**: The `calculateStats()` function could benefit from `useMemo` to avoid recalculation on every render

---

## CHECKLIST FOR FULL MARKS

Before submitting a PR or completing a feature, verify:

### Security
- [ ] No security vulnerabilities
- [ ] No exposed secrets or API keys
- [ ] Input validation is implemented
- [ ] Authentication/authorization is proper

### Build & Deployment
- [ ] Build succeeds without errors
- [ ] All environment variables configured
- [ ] No hardcoded paths or values
- [ ] Dependencies are up to date

### Code Quality
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Proper error handling
- [ ] No dead code or unused imports

### Documentation
- [ ] Code is well-documented
- [ ] Complex logic has comments
- [ ] README is updated if needed

### Performance & Accessibility
- [ ] No performance issues
- [ ] Accessibility standards met (if applicable)
- [ ] Images optimized and have alt text

### Testing
- [ ] Existing tests pass
- [ ] New features have tests (if required)
- [ ] Edge cases are handled

---

## Quick Pre-Commit Checklist

Run these commands before committing:

```bash
# 1. Lint check
npm run lint

# 2. Type check
npm run type-check  # or: npx tsc --noEmit

# 3. Security audit
npm audit

# 4. Build test
npm run build

# 5. Run tests
npm test

# 6. Check for secrets (if you have a tool)
npx secretlint "**/*"
```

---

## Automated Check Simulation

To simulate what automated checks will find:

### Security Scan
```bash
# Check for secrets
git secrets --scan

# Audit dependencies
npm audit --audit-level=moderate

# Check for common vulnerabilities
npx snyk test
```

### Build Verification
```bash
# Clean build
rm -rf node_modules dist .next
npm ci
npm run build
```

### Code Quality
```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Check complexity
npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0
```

---

## Summary

By systematically checking all these areas, you ensure:
- Γ£à GitHub Actions security audit passes
- Γ£à Vercel deployments succeed
- Γ£à AI code reviewer finds no critical issues
- Γ£à Code is production-ready
- Γ£à Team review will be smooth

**Remember**: Prevention is better than fixing issues after they're found by automated checks. Build quality in from the start.
