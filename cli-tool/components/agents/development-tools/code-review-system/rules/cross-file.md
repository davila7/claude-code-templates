# Cross-File Vulnerability Detection Rules

## Leveraging 200K Context Window for Multi-File Analysis

This rule set detects vulnerabilities that only manifest when analyzing multiple files together. These bugs are invisible in single-file reviews.

## Critical Cross-File Vulnerabilities

### 1. Authentication Bypass Across Files
**Pattern**: Auth check in one file, bypass in another

**File A** (`middleware/auth.js`):
```javascript
// Checks authentication
function requireAuth(req, res, next) {
  if (req.headers.authorization) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

**File B** (`routes/admin.js`):
```javascript
// ❌ Bypasses auth by accessing user directly
app.get('/admin/users', (req, res) => {
  // No requireAuth middleware!
  const users = db.query('SELECT * FROM users');
  res.json(users);
});
```

**Detection**:
- Auth middleware defined but not used on sensitive routes
- Routes accessing protected resources without middleware
- Inconsistent auth patterns across route files

**Impact**: Complete authentication bypass, unauthorized access
**Confidence**: 94%

**Fix**: Ensure all sensitive routes use auth middleware

---

### 2. SQL Injection Chain
**Pattern**: Sanitization in one file, injection in another

**File A** (`utils/sanitize.js`):
```javascript
// Sanitizes user input
function sanitizeInput(input) {
  return input.replace(/['"]/g, '');
}
```

**File B** (`services/user.js`):
```javascript
// ❌ Uses unsanitized input
async function findUser(email) {
  // Bypasses sanitization by using raw input
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return await db.query(query);
}
```

**File C** (`routes/user.js`):
```javascript
// Calls service with raw input
app.get('/user', (req, res) => {
  const user = await findUser(req.query.email); // Not sanitized!
  res.json(user);
});
```

**Detection**:
- Sanitization function exists but not used
- Database queries with string interpolation
- Route handlers passing raw input to services

**Impact**: SQL injection despite sanitization code existing
**Confidence**: 96%

---

### 3. Circular Dependency Deadlock
**Pattern**: Modules importing each other

**File A** (`services/user.js`):
```javascript
const { getPostCount } = require('./post');

class UserService {
  async getUser(id) {
    const user = await db.findUser(id);
    user.postCount = await getPostCount(id);
    return user;
  }
}
```

**File B** (`services/post.js`):
```javascript
const { getUser } = require('./user');

async function getPostCount(userId) {
  const user = await getUser(userId); // Circular!
  return user.posts.length;
}
```

**Detection**:
- Module A requires Module B
- Module B requires Module A
- Potential initialization deadlock

**Impact**: Module loading fails, application won't start
**Confidence**: 98%

---

### 4. State Synchronization Bug
**Pattern**: Shared state modified in multiple files

**File A** (`store/cart.js`):
```javascript
let cartItems = [];

export function addToCart(item) {
  cartItems.push(item);
}

export function getCart() {
  return cartItems;
}
```

**File B** (`components/CartButton.js`):
```javascript
import { addToCart } from '../store/cart';

function CartButton({ item }) {
  const handleClick = () => {
    addToCart(item);
    // No state update notification!
  };
}
```

**File C** (`components/CartDisplay.js`):
```javascript
import { getCart } from '../store/cart';

function CartDisplay() {
  const [items, setItems] = useState(getCart());
  // Never updates when cart changes!
}
```

**Detection**:
- Shared mutable state across files
- No event system or state management
- Components reading stale state

**Impact**: UI shows wrong data, user confusion
**Confidence**: 91%

---

### 5. CORS Misconfiguration Chain
**Pattern**: CORS set in one file, credentials in another

**File A** (`middleware/cors.js`):
```javascript
app.use(cors({
  origin: '*',  // Allows all origins
  credentials: false
}));
```

**File B** (`routes/api.js`):
```javascript
app.post('/api/transfer', (req, res) => {
  // ❌ Sends credentials despite CORS config
  res.cookie('session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'none'  // Allows cross-site!
  });
});
```

**Detection**:
- CORS allows all origins
- Cookies with sameSite: 'none'
- Credentials sent cross-origin

**Impact**: CSRF vulnerability, session hijacking
**Confidence**: 93%

---

### 6. Environment Variable Leak
**Pattern**: Secret in one file, logged in another

**File A** (`.env`):
```
DATABASE_PASSWORD=super_secret_password
API_KEY=sk_live_abc123xyz
```

**File B** (`config/database.js`):
```javascript
const dbConfig = {
  password: process.env.DATABASE_PASSWORD
};
```

**File C** (`utils/logger.js`):
```javascript
// ❌ Logs entire config including secrets
function logConfig() {
  console.log('Config:', JSON.stringify(process.env));
}
```

**Detection**:
- Environment variables contain secrets
- Logging code that dumps env vars
- No secret filtering in logs

**Impact**: Secrets exposed in logs, security breach
**Confidence**: 95%

---

### 7. Permission Escalation Chain
**Pattern**: Permission check in one file, bypass in another

**File A** (`middleware/permissions.js`):
```javascript
function requireAdmin(req, res, next) {
  if (req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
}
```

**File B** (`routes/user.js`):
```javascript
// Uses admin check
app.delete('/users/:id', requireAdmin, deleteUser);
```

**File C** (`routes/profile.js`):
```javascript
// ❌ Bypasses admin check
app.put('/profile/:id', (req, res) => {
  // Can modify any user's profile!
  await db.updateUser(req.params.id, req.body);
});
```

**Detection**:
- Permission middleware exists
- Some routes use it, others don't
- Inconsistent authorization patterns

**Impact**: Privilege escalation, unauthorized modifications
**Confidence**: 92%

---

### 8. Data Flow Vulnerability
**Pattern**: Validation in one file, bypass in another

**File A** (`validators/user.js`):
```javascript
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
```

**File B** (`routes/register.js`):
```javascript
// Uses validation
app.post('/register', (req, res) => {
  if (!validateEmail(req.body.email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  await createUser(req.body);
});
```

**File C** (`routes/admin.js`):
```javascript
// ❌ Bypasses validation
app.post('/admin/create-user', (req, res) => {
  // No validation!
  await createUser(req.body);
});
```

**Detection**:
- Validation function exists
- Some routes use it, others don't
- Multiple entry points to same function

**Impact**: Invalid data in database, application errors
**Confidence**: 90%

---

### 9. Rate Limiting Bypass
**Pattern**: Rate limit in one route, bypass in another

**File A** (`middleware/rateLimit.js`):
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
```

**File B** (`routes/api.js`):
```javascript
// Protected
app.post('/api/login', limiter, handleLogin);
```

**File C** (`routes/auth.js`):
```javascript
// ❌ Same functionality, no rate limit
app.post('/auth/signin', handleLogin);
```

**Detection**:
- Rate limiting middleware exists
- Multiple routes to same functionality
- Some routes lack rate limiting

**Impact**: Brute force attacks, DoS vulnerability
**Confidence**: 94%

---

### 10. Inconsistent Error Handling
**Pattern**: Errors handled in one file, exposed in another

**File A** (`middleware/errorHandler.js`):
```javascript
function errorHandler(err, req, res, next) {
  // Sanitizes errors
  res.status(500).json({ error: 'Internal server error' });
}
```

**File B** (`routes/api.js`):
```javascript
// Uses error handler
app.use(errorHandler);
```

**File C** (`routes/debug.js`):
```javascript
// ❌ Exposes full error
app.get('/debug/test', (req, res) => {
  try {
    // ...
  } catch (error) {
    res.json({ error: error.stack }); // Leaks stack trace!
  }
});
```

**Detection**:
- Error handler middleware exists
- Some routes bypass it
- Stack traces or sensitive info in responses

**Impact**: Information disclosure, aids attackers
**Confidence**: 89%

---

## Architectural Anti-Patterns

### 11. God Object Across Files
**Pattern**: One object/module doing everything

**Detection**:
- Module imported by 20+ other files
- Module has 50+ exports
- High coupling across codebase

**Impact**: Hard to maintain, test, and scale
**Confidence**: 87%

---

### 12. Tight Coupling Chain
**Pattern**: Changes in one file break many others

**Detection**:
- File A imports File B
- File B imports File C
- File C imports File D
- Deep dependency chains (5+ levels)

**Impact**: Fragile codebase, hard to refactor
**Confidence**: 85%

---

### 13. Inconsistent Patterns
**Pattern**: Same problem solved differently in different files

**File A**: Uses async/await
**File B**: Uses promises with .then()
**File C**: Uses callbacks

**Detection**:
- Multiple patterns for same operation
- No consistent style
- Mixed paradigms

**Impact**: Confusion, bugs, hard to maintain
**Confidence**: 82%

---

### 14. Missing Abstraction Layer
**Pattern**: Database queries scattered across files

**Detection**:
- Raw SQL in 10+ files
- No repository pattern
- Direct database access everywhere

**Impact**: Hard to change database, test, or optimize
**Confidence**: 86%

---

### 15. Configuration Sprawl
**Pattern**: Config values hardcoded in multiple files

**Detection**:
- Same constant defined in multiple files
- No central config
- Magic numbers everywhere

**Impact**: Hard to change settings, inconsistencies
**Confidence**: 88%

---

## Detection Strategy

### Phase 1: Build Dependency Graph
```markdown
1. Parse all imports/requires
2. Build module dependency tree
3. Identify circular dependencies
4. Calculate coupling metrics
```

### Phase 2: Trace Data Flow
```markdown
1. Identify entry points (routes, handlers)
2. Trace data through function calls
3. Track validation, sanitization, auth
4. Find gaps in security chain
```

### Phase 3: Pattern Analysis
```markdown
1. Identify security patterns (auth, validation)
2. Find where patterns are used
3. Find where patterns are missing
4. Flag inconsistencies
```

### Phase 4: Cross-Reference
```markdown
1. Match middleware definitions to usage
2. Match validation functions to routes
3. Match auth checks to protected resources
4. Find bypasses and gaps
```

## Quick Reference

| Vulnerability | Severity | Confidence | Files Involved |
|--------------|----------|------------|----------------|
| Auth Bypass | 🔴 Critical | 94% | 2-3 |
| SQL Injection Chain | 🔴 Critical | 96% | 3-4 |
| Circular Dependency | 🔴 Critical | 98% | 2+ |
| State Sync Bug | ⚠️ High | 91% | 3+ |
| CORS Misconfig | ⚠️ High | 93% | 2-3 |
| Secret Leak | 🔴 Critical | 95% | 2-3 |
| Permission Escalation | 🔴 Critical | 92% | 3+ |
| Validation Bypass | ⚠️ High | 90% | 3+ |
| Rate Limit Bypass | ⚠️ High | 94% | 2-3 |
| Error Exposure | ⚠️ High | 89% | 2-3 |

## Analysis Approach

### For Each Review:
1. **Load Full Context**: Use 200K window to load entire codebase
2. **Build Graphs**: Create dependency and data flow graphs
3. **Pattern Match**: Find security patterns and their usage
4. **Cross-Reference**: Match definitions to usage
5. **Flag Gaps**: Identify missing patterns and bypasses
6. **Prioritize**: Rank by severity and confidence
7. **Report**: Provide file-by-file breakdown with fixes

### Output Format:
```markdown
## Cross-File Vulnerability: Authentication Bypass

**Severity**: 🔴 Critical
**Confidence**: 94%
**Files Involved**: 3

### The Issue
Auth middleware defined in `middleware/auth.js` but not used on admin routes in `routes/admin.js`.

### Data Flow
1. `routes/admin.js:15` - Admin route defined
2. No auth middleware applied
3. Direct database access to sensitive data
4. `middleware/auth.js:5` - Auth middleware exists but unused

### Impact
Any user can access admin endpoints without authentication.

### Fix
Apply auth middleware to all admin routes:
```javascript
app.get('/admin/users', requireAuth, requireAdmin, getUsers);
```

### Similar Issues
- `routes/admin.js:23` - Another unprotected route
- `routes/api.js:45` - Missing auth check
```

## Prevention

1. **Consistent Patterns**: Use same security patterns everywhere
2. **Central Config**: Single source of truth for settings
3. **Abstraction Layers**: Repository pattern for data access
4. **Automated Checks**: CI/CD to enforce patterns
5. **Code Reviews**: Multi-file analysis in every review
6. **Documentation**: Document security patterns and usage
7. **Testing**: Integration tests across files
8. **Linting**: Custom rules for pattern enforcement
