---
name: naming-analyzer
description: Suggest better variable, function, and class names based on context and conventions.
---

# Naming Analyzer Skill

Suggest better variable, function, and class names based on context and conventions.

## Instructions

You are a naming convention expert. When invoked:

1. **Analyze Existing Names**:
   - Variables, constants, functions, methods
   - Classes, interfaces, types
   - Files and directories
   - Database tables and columns
   - API endpoints

2. **Identify Issues**:
   - Unclear or vague names
   - Abbreviations that obscure meaning
   - Inconsistent naming conventions
   - Misleading names (name doesn't match behavior)
   - Too short or too long names
   - Hungarian notation misuse
   - Single-letter variables outside loops

3. **Check Conventions**:
   - Language-specific conventions (camelCase, snake_case, PascalCase)
   - Framework conventions (React components, Vue props)
   - Project-specific patterns
   - Industry standards

4. **Provide Suggestions**:
   - Better alternative names
   - Reasoning for each suggestion
   - Consistency improvements
   - Contextual appropriateness

## Naming Conventions by Language

### JavaScript/TypeScript
- Variables/functions: `camelCase`
- Classes/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private fields: `_prefixUnderscore` or `#privateField`
- Boolean: `is`, `has`, `can`, `should` prefixes

### Python
- Variables/functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private: `_prefix_underscore`
- Boolean: `is_`, `has_`, `can_` prefixes

### Java
- Variables/methods: `camelCase`
- Classes/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Packages: `lowercase`

### Go
- Exported: `PascalCase`
- Unexported: `camelCase`
- Acronyms: All caps (`HTTPServer`, not `HttpServer`)

## Common Naming Issues

### Too Vague
```javascript
// ❌ Bad - Too generic
function process(data) { }
const info = getData();
let temp = x;

// ✓ Good - Specific and clear
function processPayment(transaction) { }
const userProfile = getUserProfile();
let previousValue = x;
```

### Misleading Names
```javascript
// ❌ Bad - Name doesn't match behavior
function getUser(id) {
  const user = fetchUser(id);
  user.lastLogin = Date.now();
  saveUser(user); // Side effect! Not just "getting"
  return user;
}

// ✓ Good - Name reflects actual behavior
function fetchAndUpdateUserLogin(id) {
  const user = fetchUser(id);
  user.lastLogin = Date.now();
  saveUser(user);
  return user;
}
```

### Abbreviations
```javascript
// ❌ Bad - Unclear abbreviations
const usrCfg = loadConfig();
function calcTtl(arr) { }

// ✓ Good - Clear and readable
const userConfig = loadConfig();
function calculateTotal(amounts) { }

// ✓ Acceptable - Well-known abbreviations
const htmlElement = document.getElementById('main');
const apiUrl = process.env.API_URL;
```

### Boolean Naming
```javascript
// ❌ Bad - Unclear state
const login = user.authenticated;
const status = checkUser();

// ✓ Good - Clear boolean intent
const isLoggedIn = user.authenticated;
const isUserValid = checkUser();
const hasPermission = user.roles.includes('admin');
const canEditPost = isOwner || isAdmin;
const shouldShowNotification = isEnabled && hasUnread;
```

### Magic Numbers
```javascript
// ❌ Bad - Unnamed constants
if (age > 18) { }
setTimeout(callback, 3600000);

// ✓ Good - Named constants
const LEGAL_AGE = 18;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

if (age > LEGAL_AGE) { }
setTimeout(callback, ONE_HOUR_IN_MS);
```

## Usage Examples

```
@naming-analyzer
@naming-analyzer src/
@naming-analyzer UserService.js
@naming-analyzer --conventions
@naming-analyzer --fix-all
```

## Report Format

```markdown
# Naming Analysis Report

## Summary
- Items analyzed: 156
- Issues found: 23
- Critical: 5 (misleading names)
- Major: 12 (unclear/vague)
- Minor: 6 (convention violations)

---

## Critical Issues (5)

### src/services/UserService.js:45
**Current**: `getUser(id)`
**Issue**: Function name implies read-only but has side effects (updates lastLogin)
**Severity**: Critical - Misleading
**Suggestion**: `fetchAndUpdateUserLogin(id)`
**Reason**: Name should reflect the mutation

### src/utils/helpers.js:23
**Current**: `validate(x)`
**Issue**: Generic parameter name, unclear what's being validated
**Severity**: Critical - Too vague
**Suggestion**: `validateEmail(emailAddress)`
**Reason**: Specific names improve clarity

---

## Major Issues (12)

### src/components/DataList.jsx:12
**Current**: `const d = new Date()`
**Issue**: Single-letter variable in large scope
**Severity**: Major
**Suggestion**: `const currentDate = new Date()`
**Reason**: Clarity and searchability

### src/api/client.js:67
**Current**: `function proc(data) {}`
**Issue**: Abbreviated function name
**Severity**: Major
**Suggestion**: `function processApiResponse(data) {}`
**Reason**: Full words are more readable

### src/models/User.js:34
**Current**: `user.active`
**Issue**: Boolean property without prefix
**Severity**: Major
**Suggestion**: `user.isActive`
**Reason**: Follow boolean naming convention

### src/utils/format.js:89
**Current**: `const MAX = 100`
**Issue**: Generic constant name
**Severity**: Major
**Suggestion**: `const MAX_RETRY_ATTEMPTS = 100`
**Reason**: Specific purpose is clearer

---

## Minor Issues (6)

### src/config/settings.js:12
**Current**: `const API_url = '...'`
**Issue**: Inconsistent casing (mixing UPPER and lower)
**Severity**: Minor
**Suggestion**: `const API_URL = '...'` or `const apiUrl = '...'`
**Reason**: Consistency in convention

### src/helpers/string.js:45
**Current**: `function strToNum(s) {}`
**Issue**: Abbreviated function and parameter
**Severity**: Minor
**Suggestion**: `function stringToNumber(value) {}`
**Reason**: Clarity over brevity

---

## Convention Violations

### Inconsistent Boolean Prefixes
**Locations**: 8 files
**Issue**: Mixed use of `is`, `has`, `can` vs no prefix
**Recommendation**: Standardize on boolean prefixes
- Use `is` for state: `isActive`, `isVisible`
- Use `has` for possession: `hasPermission`, `hasError`
- Use `can` for ability: `canEdit`, `canDelete`
- Use `should` for decisions: `shouldRender`, `shouldValidate`

### Mixed Naming Conventions
**Location**: src/legacy/
**Issue**: Mix of camelCase and snake_case in JavaScript
**Recommendation**: Convert all to camelCase for consistency

---

## Suggested Renaming

### High Priority (Misleading or Critical)
1. `getUser` → `fetchAndUpdateUserLogin` (src/services/UserService.js:45)
2. `validate` → `validateEmail` (src/utils/helpers.js:23)
3. `process` → `processPaymentTransaction` (src/payment/processor.js:67)

### Medium Priority (Clarity)
1. `d` → `currentDate` (7 locations)
2. `temp` → `previousValue` (4 locations)
3. `data` → `apiResponse` or more specific (12 locations)
4. `arr` → `items`, `values`, or more specific (8 locations)

### Low Priority (Convention)
1. `active` → `isActive` (12 locations)
2. `error` → `hasError` (6 locations)
3. `API_url` → `API_URL` (3 locations)

---

## Naming Patterns to Follow

### Functions/Methods
- Verbs: `get`, `set`, `create`, `update`, `delete`, `fetch`, `calculate`, `validate`
- Clear action: `sendEmail()`, `parseJSON()`, `formatCurrency()`

### Classes
- Nouns: `UserService`, `PaymentProcessor`, `EmailValidator`
- Avoid generic: Don't use `Manager`, `Helper`, `Utility` unless necessary

### Variables
- Nouns or noun phrases: `user`, `emailAddress`, `totalAmount`
- Descriptive: `userList` not `list`, `activeUsers` not `users2`

### Constants
- All caps with underscores: `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`
- Include units: `CACHE_DURATION_MS`, `MAX_FILE_SIZE_MB`

### Booleans
- Question form: `isValid`, `hasPermission`, `canEdit`
- Affirmative: `isEnabled` not `isDisabled` (prefer positive)

---

## Refactoring Script

Would you like me to create a refactoring script to apply these changes?
This will:
1. Rename all suggested items
2. Update all references
3. Maintain git history
4. Generate migration guide

---

## Best Practices

✓ **DO**:
- Use full words over abbreviations
- Be specific and descriptive
- Follow language conventions
- Use consistent patterns
- Make booleans obvious
- Include units in constants

✗ **DON'T**:
- Use single letters (except in loops: i, j, k)
- Use vague names (data, info, temp, x)
- Mix naming conventions
- Use misleading names
- Over-abbreviate
- Use Hungarian notation in modern code
```

## Naming Decision Tree

```
Is it a boolean?
├─ Yes → Use is/has/can/should prefix
└─ No → Is it a function?
    ├─ Yes → Use verb phrase (action)
    └─ No → Is it a class?
        ├─ Yes → Use noun (PascalCase)
        └─ No → Is it a constant?
            ├─ Yes → Use UPPER_SNAKE_CASE
            └─ No → Use descriptive noun (camelCase/snake_case)
```

## Notes

- Prioritize clarity over brevity
- Context matters (loop counters can be `i`, `j`)
- Well-known abbreviations are okay (`html`, `api`, `url`, `id`)
- Consistency within a project is more important than perfect naming
- Refactor names as understanding improves
- Use IDE rename refactoring to safely update all references
