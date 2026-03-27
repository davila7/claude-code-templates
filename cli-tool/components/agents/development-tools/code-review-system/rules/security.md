# Security Review Rules

## 🚨 CRITICAL: Real-World Vulnerabilities (Based on Actual Incidents)

### RLS/Security Rules Misconfiguration
**Most Common in Vibe-Coded Apps - Can Lead to Complete Data Breach**

#### Pattern 1: User-Editable Subscription Status
```javascript
// ❌ CRITICAL: Users can upgrade themselves to premium
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

// User can run: UPDATE users SET subscription = 'premium' WHERE id = auth.uid();
```

**Detection**:
- User table with subscription/premium/admin fields
- RLS policy allowing user updates
- No separate protected table for billing

**Impact**: Users bypass payment, free premium access
**Confidence**: 98%

**Fix**:
```sql
-- Separate subscription table with admin-only access
CREATE TABLE subscriptions (
  user_id UUID REFERENCES users(id),
  status TEXT NOT NULL,
  expires_at TIMESTAMP
);

CREATE POLICY "Users can read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- No UPDATE policy for users
```

#### Pattern 2: User-Editable Rate Limits
```javascript
// ❌ CRITICAL: Users can bypass rate limits
CREATE TABLE users (
  id UUID PRIMARY KEY,
  rate_limit INTEGER DEFAULT 5  -- User can modify!
);
```

**Detection**:
- Rate limit fields on user-editable tables
- Usage counters accessible to users
- No backend-only rate limit enforcement

**Impact**: $10,000+ AI bills, resource exhaustion
**Confidence**: 97%

**Fix**:
```sql
-- Protected rate limit table
CREATE TABLE rate_limits (
  user_id UUID REFERENCES users(id),
  daily_limit INTEGER DEFAULT 5,
  current_usage INTEGER DEFAULT 0,
  reset_at TIMESTAMP
);

CREATE POLICY "Users can read own limits" ON rate_limits
  FOR SELECT USING (auth.uid() = user_id);
-- Only backend can UPDATE
```

#### Pattern 3: Cross-User Data Access
```javascript
// ❌ CRITICAL: Users can access others' data
CREATE POLICY "Users can read posts" ON posts
  FOR SELECT USING (true);  -- Anyone can read all posts!
```

**Detection**:
- RLS policies with USING (true)
- Missing user_id checks in policies
- No ownership validation

**Impact**: Complete data breach, privacy violation
**Confidence**: 99%

---

### Missing Backend Rate Limits
**Can Lead to $10,000+ Bills**

#### Pattern 1: Frontend-Only Rate Limiting
```javascript
// ❌ CRITICAL: Easy to bypass
function generateImage() {
  if (userGenerations >= 5) {
    alert("Daily limit reached");
    return;
  }
  await fetch('/api/generate', { method: 'POST' });
}
```

**Detection**:
- Rate limit checks only in frontend code
- No rate limiting middleware on backend
- Direct API endpoint access possible

**Impact**: Unlimited API usage, massive bills
**Confidence**: 96%

**Fix**:
```javascript
// Backend rate limiting
async function generateImage(req, res) {
  const userId = req.user.id;
  
  const usage = await db.query(
    'SELECT current_usage, daily_limit FROM rate_limits WHERE user_id = $1',
    [userId]
  );
  
  if (usage.current_usage >= usage.daily_limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  await db.query(
    'UPDATE rate_limits SET current_usage = current_usage + 1 WHERE user_id = $1',
    [userId]
  );
  
  const result = await aiProvider.generate(req.body);
  res.json(result);
}
```

#### Pattern 2: No IP-Based Rate Limiting
```javascript
// ❌ Missing IP-based protection
app.post('/api/ai/generate', handler);
```

**Detection**:
- No rate limiting middleware
- No IP tracking
- AI endpoints without protection

**Impact**: Account spam, DoS attacks
**Confidence**: 94%

---

### Exposed API Keys & Secrets
**Leads to Stolen Keys and Massive Bills**

#### Pattern 1: AI Keys in Frontend
```javascript
// ❌ CRITICAL: API key exposed
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
});
```

**Detection**:
- AI API calls from frontend code
- API keys in frontend environment variables
- Direct calls to OpenAI/Anthropic/etc from client

**Impact**: Stolen keys, unlimited usage, $30K+ bills
**Confidence**: 99%

**Fix**:
```javascript
// Frontend
const response = await fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt: userInput })
});

// Backend only
export async function generateHandler(req, res) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY; // Safe
  // Rate limiting here
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
  });
  res.json(await response.json());
}
```

#### Pattern 2: Payment Keys in Frontend
```javascript
// ❌ CRITICAL: Stripe secret key exposed
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const paymentIntent = await stripe.paymentIntents.create({
  amount: userSelectedAmount, // User can manipulate!
});
```

**Detection**:
- Stripe/payment API calls from frontend
- Secret keys in frontend code
- User-controlled payment amounts

**Impact**: Payment bypass, stolen keys
**Confidence**: 99%

#### Pattern 3: Cloud Storage Credentials
```javascript
// ❌ CRITICAL: AWS credentials exposed
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});
```

**Detection**:
- AWS/GCP/Azure credentials in frontend
- Direct cloud API calls from client
- Storage operations without pre-signed URLs

**Impact**: Data breach, resource abuse
**Confidence**: 98%

---

### Missing Budget Caps
**Wake Up to $30,000 Bills**

#### Pattern: No Cost Controls
```javascript
// ❌ No budget monitoring or caps
// Just calling AI APIs without limits
```

**Detection**:
- No budget cap configuration
- No billing alerts
- No usage monitoring
- No auto-shutoff mechanism

**Impact**: Unlimited costs, surprise bills
**Confidence**: 90%

**Fix**:
```javascript
// Implement usage monitoring
async function checkAndDisableBilling() {
  const spend = await getCurrentSpend();
  
  if (spend > BUDGET_LIMIT) {
    await disableBilling();
    await sendAlert('Budget exceeded - billing disabled');
  }
}

// Run every hour
setInterval(checkAndDisableBilling, 60 * 60 * 1000);
```

---

## OWASP Top 10 (2021)

### A01: Broken Access Control
**Check for**:
- Missing authorization checks
- Insecure direct object references
- Path traversal
- CORS misconfiguration

**Rules**:
- Every endpoint must verify user permissions
- Never trust client-side access control
- Validate user owns requested resource
- Use allowlist for CORS origins

### A02: Cryptographic Failures
**Check for**:
- Weak password hashing
- Hardcoded secrets
- Insecure random number generation
- Missing encryption for sensitive data

**Rules**:
- Use bcrypt/argon2 for passwords (cost ≥12)
- Store secrets in environment variables
- Use crypto.randomBytes for tokens
- Encrypt PII at rest and in transit

### A03: Injection
**Check for**:
- SQL injection (template literals)
- NoSQL injection
- Command injection
- LDAP injection

**Rules**:
- Always use parameterized queries
- Validate and sanitize all input
- Use ORMs with proper escaping
- Never concatenate user input into queries

### A04: Insecure Design
**Check for**:
- Missing rate limiting
- No input validation
- Insufficient logging
- Missing security headers

**Rules**:
- Rate limit all public endpoints
- Validate input on server (never trust client)
- Log security events
- Set security headers (CSP, HSTS, etc.)

### A05: Security Misconfiguration
**Check for**:
- Default credentials
- Verbose error messages
- Unnecessary features enabled
- Missing security patches

**Rules**:
- Change all default passwords
- Generic error messages in production
- Disable unused features
- Keep dependencies updated

### A06: Vulnerable Components
**Check for**:
- Outdated dependencies
- Known CVEs
- Unmaintained packages
- Unnecessary dependencies

**Rules**:
- Run npm audit regularly
- Update dependencies monthly
- Remove unused packages
- Monitor security advisories

### A07: Authentication Failures
**Check for**:
- Weak password requirements
- No MFA support
- Session fixation
- Credential stuffing vulnerability

**Rules**:
- Enforce strong passwords
- Support MFA
- Regenerate session ID on login
- Implement account lockout

### A08: Data Integrity Failures
**Check for**:
- Insecure deserialization
- Missing integrity checks
- Unsigned JWTs
- No checksum validation

**Rules**:
- Never deserialize untrusted data
- Verify data integrity
- Sign all JWTs
- Validate checksums

### A09: Logging Failures
**Check for**:
- No security event logging
- Logs contain sensitive data
- No log monitoring
- Insufficient log retention

**Rules**:
- Log all security events
- Sanitize logs (no passwords/tokens)
- Monitor logs for anomalies
- Retain logs per compliance

### A10: Server-Side Request Forgery
**Check for**:
- Unvalidated URLs
- Internal network access
- Cloud metadata access
- DNS rebinding

**Rules**:
- Validate and sanitize URLs
- Block internal IP ranges
- Disable redirects
- Use allowlist for domains

## Common Vulnerability Patterns

### Authentication Bypass
```javascript
// ❌ Vulnerable
if (req.headers.authorization) {
  // Assumes valid if present
}

// ✅ Secure
const token = req.headers.authorization?.split(' ')[1];
if (!token || !verifyToken(token)) {
  throw new AuthError();
}
```

### Timing Attacks
```javascript
// ❌ Vulnerable
if (password === storedPassword) { }

// ✅ Secure
if (crypto.timingSafeEqual(hash1, hash2)) { }
```

### Session Fixation
```javascript
// ❌ Vulnerable
// Reuse session ID after login

// ✅ Secure
req.session.regenerate((err) => {
  // New session ID after login
});
```

### Open Redirect
```javascript
// ❌ Vulnerable
res.redirect(req.query.url);

// ✅ Secure
const allowedUrls = ['/dashboard', '/profile'];
if (allowedUrls.includes(req.query.url)) {
  res.redirect(req.query.url);
}
```

## Security Checklist

**Input Validation**:
- [ ] All user input validated
- [ ] Whitelist validation (not blacklist)
- [ ] Length limits enforced
- [ ] Type checking performed

**Authentication**:
- [ ] Strong password requirements
- [ ] Password hashing (bcrypt/argon2)
- [ ] Session management secure
- [ ] MFA supported

**Authorization**:
- [ ] Permission checks on all endpoints
- [ ] Resource ownership verified
- [ ] Principle of least privilege
- [ ] Role-based access control

**Data Protection**:
- [ ] Sensitive data encrypted
- [ ] HTTPS enforced
- [ ] Secure cookies (httpOnly, secure, sameSite)
- [ ] No secrets in code

**Error Handling**:
- [ ] Generic error messages
- [ ] No stack traces in production
- [ ] Errors logged securely
- [ ] Fail securely

**Dependencies**:
- [ ] No known vulnerabilities
- [ ] Regular updates
- [ ] Minimal dependencies
- [ ] Trusted sources only

## Severity Ratings

**Critical** (Fix immediately):
- Remote code execution
- SQL injection
- Authentication bypass
- Data exposure
- Exposed API keys (AI, payment, cloud) ⭐
- User-editable subscription/rate limits ⭐
- Cross-user data access ⭐
- Missing backend rate limits ⭐

**High** (Fix before release):
- XSS vulnerabilities
- CSRF vulnerabilities
- Privilege escalation
- Sensitive data leaks
- Frontend-only rate limiting ⭐
- Weak password policy

**Medium** (Fix soon):
- Missing rate limiting (non-AI endpoints)
- Insufficient logging
- Missing security headers
- No budget caps ⭐

**Low** (Fix eventually):
- Information disclosure
- Missing CSRF tokens (low-risk endpoints)
- Verbose error messages
- Minor configuration issues

---

## 🤖 AI Security Audit Prompts

### Comprehensive Security Audit
```
Perform a comprehensive security audit checking for:

1. RLS/Security Rules Misconfigurations:
   - Can users modify subscription status, rate limits, or admin flags?
   - Can users access other users' data?
   - Are sensitive fields on user-editable tables?
   - Are there tables without RLS policies?
   - Test: Can User A see User B's data?

2. Rate Limiting Issues:
   - Are there backend rate limits on all API endpoints?
   - Are AI endpoints protected with strict rate limits?
   - Can users bypass rate limits by calling APIs directly?
   - Are rate limits stored in protected tables?
   - Is there IP-based rate limiting?

3. Exposed API Keys:
   - Are any AI API keys (OpenAI, Anthropic) in frontend code?
   - Are payment APIs (Stripe) called from frontend?
   - Are email services called from frontend?
   - Are cloud storage credentials exposed?
   - Check network tab for exposed keys

4. Budget & Cost Controls:
   - Are budget caps configured?
   - Are billing alerts set up?
   - Can services auto-shutoff when limits exceeded?
   - Is there usage monitoring?

5. Common Vulnerabilities:
   - SQL injection via template literals
   - XSS via innerHTML
   - Missing authentication checks
   - Insecure file uploads
   - Weak password requirements

For each issue: provide file:line, severity, exploit scenario, and complete fix.
```

### Quick RLS Audit
```
Audit all database RLS policies:
1. List all tables and their RLS policies
2. Check if users can modify: subscription, premium, admin, rate_limit fields
3. Check if users can access other users' data
4. Identify tables without RLS policies
5. Test cross-user data access scenarios
```

### API Key Exposure Audit
```
Find all exposed API keys:
1. Search for OpenAI, Anthropic, Claude API calls in frontend
2. Search for Stripe, PayPal calls in frontend
3. Search for AWS, GCP, Azure credentials in frontend
4. Check if API keys are in frontend environment variables
5. List all API endpoints and check if they require authentication
```

### Rate Limiting Audit
```
Check rate limiting implementation:
1. List all API endpoints
2. Check which have rate limiting middleware
3. Identify AI/expensive endpoints without rate limits
4. Check if rate limits are backend-enforced
5. Verify rate limit storage is protected
6. Test: Can I bypass rate limits by calling API directly?
```

---

## 📋 Pre-Deployment Security Checklist

### Database Security
- [ ] RLS enabled on ALL tables
- [ ] Tested cross-user data access (can't see others' data)
- [ ] Sensitive fields (subscription, rate limits) on protected tables
- [ ] No user-editable admin/premium flags
- [ ] Database backups configured
- [ ] All policies tested with different user IDs

### API Security
- [ ] All sensitive API calls from backend only
- [ ] Rate limiting on all endpoints
- [ ] IP-based rate limiting on AI endpoints
- [ ] Authentication required on all protected routes
- [ ] Input validation on all endpoints
- [ ] No API keys in frontend code

### Secrets Management
- [ ] No API keys in frontend code
- [ ] Environment variables backend-only
- [ ] Secrets in vault (not .env in repo)
- [ ] API keys rotated regularly
- [ ] Separate keys for dev/staging/prod

### Cost Controls
- [ ] Budget caps on all cloud providers
- [ ] Billing alerts configured
- [ ] Auto-shutoff enabled
- [ ] Usage monitoring dashboard
- [ ] Cost anomaly detection

### Testing
- [ ] Tried to bypass rate limits
- [ ] Tried to access other users' data
- [ ] Tried to modify subscription status
- [ ] Checked network tab for exposed keys
- [ ] Tested with malicious input
- [ ] Penetration testing completed

---

## 🎯 Quick Security Wins

### 5-Minute Fixes
1. Add IP-based rate limiting to AI endpoints
2. Move API keys to backend environment variables
3. Enable RLS on all Supabase tables
4. Set up billing alerts

### 1-Hour Fixes
1. Implement per-user rate limiting
2. Move sensitive API calls to backend functions
3. Audit and fix RLS policies
4. Add input validation on all endpoints

### 1-Day Fixes
1. Comprehensive security audit with AI
2. Implement budget caps and auto-shutoff
3. Set up monitoring and alerting
4. Penetration testing

---

## 💡 Security Principles

> "Frontend rate limits are not rate limits. Frontend security is not security."

> "If it's in the frontend, assume it's public."

> "Budget caps are cheaper than surprise bills."

> "RLS is only secure if configured correctly."

> "Test security with different user IDs, not just your own."

---

## Detection Confidence Levels

- **95-100%**: Definitely a security vulnerability, fix immediately
- **90-94%**: Very likely vulnerable, investigate and fix
- **85-89%**: Potential vulnerability, review carefully
- **80-84%**: Security concern, consider hardening
