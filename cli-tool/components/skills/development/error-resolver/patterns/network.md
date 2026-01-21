# Network & API Error Patterns

Common network and API errors with diagnosis and solutions.

## HTTP Status Errors

### 400 Bad Request

```
HTTP 400 Bad Request
{"error": "Bad Request", "message": "Invalid JSON"}
```

**Causes**:
1. Malformed JSON body
2. Missing required fields
3. Invalid field values
4. Wrong Content-Type header

**Diagnosis**:
```bash
# Validate JSON
echo '{"key": "value"}' | jq .

# Check request
curl -v -X POST https://api.example.com/endpoint \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

**Solutions**:
```javascript
// Check Content-Type
fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',  // Not 'text/plain'
  },
  body: JSON.stringify(data),  // Not just data
})

// Validate before sending
if (!data.required_field) {
  throw new Error('Missing required_field')
}
```

---

### 401 Unauthorized

```
HTTP 401 Unauthorized
{"error": "Unauthorized", "message": "Invalid or expired token"}
```

**Causes**:
1. Missing auth token
2. Expired token
3. Invalid token format
4. Wrong auth scheme

**Solutions**:
```javascript
// Check Authorization header format
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,  // Note: "Bearer " prefix
  },
})

// Refresh token if expired
async function fetchWithAuth(url) {
  let response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (response.status === 401) {
    accessToken = await refreshToken()
    response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
  }

  return response
}
```

---

### 403 Forbidden

```
HTTP 403 Forbidden
{"error": "Forbidden", "message": "Insufficient permissions"}
```

**Causes**:
1. Authenticated but not authorized
2. Resource access denied
3. Rate limiting
4. IP blocked

**Different from 401**: 401 = "Who are you?" 403 = "I know who you are, but no."

**Solutions**:
- Check user permissions/roles
- Verify API key scopes
- Check rate limit headers
- Verify IP whitelist

---

### 404 Not Found

```
HTTP 404 Not Found
{"error": "Not Found", "message": "Resource not found"}
```

**Causes**:
1. Wrong URL/endpoint
2. Resource deleted
3. ID doesn't exist
4. Trailing slash issues

**Diagnosis**:
```bash
# Check URL is correct
curl -I https://api.example.com/users/123

# Try with/without trailing slash
curl https://api.example.com/users/
curl https://api.example.com/users
```

**Solutions**:
```javascript
// Handle 404 gracefully
const response = await fetch(`/api/users/${id}`)
if (response.status === 404) {
  return null  // Or throw custom error
}
return response.json()
```

---

### 405 Method Not Allowed

```
HTTP 405 Method Not Allowed
{"error": "Method Not Allowed", "allowed": ["GET", "POST"]}
```

**Causes**:
1. Using wrong HTTP method
2. Endpoint doesn't support method

**Solutions**:
```bash
# Check allowed methods
curl -I -X OPTIONS https://api.example.com/endpoint
# Look for Allow header

# Use correct method
curl -X POST https://api.example.com/users  # Not GET
```

---

### 429 Too Many Requests

```
HTTP 429 Too Many Requests
{"error": "Rate Limited", "retry_after": 60}
```

**Causes**:
1. Rate limit exceeded
2. Too many concurrent requests

**Solutions**:
```javascript
// Implement exponential backoff
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url)

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60
      await sleep(retryAfter * 1000 * (i + 1))
      continue
    }

    return response
  }
  throw new Error('Max retries exceeded')
}

// Rate limiting in client
const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'second',
})

async function limitedFetch(url) {
  await limiter.removeTokens(1)
  return fetch(url)
}
```

---

### 500 Internal Server Error

```
HTTP 500 Internal Server Error
```

**Causes**:
1. Server-side bug
2. Unhandled exception
3. Database error
4. Third-party service failure

**What you can do**:
1. Check if your request is valid
2. Retry later
3. Report to API provider with request details

---

### 502 Bad Gateway

```
HTTP 502 Bad Gateway
```

**Causes**:
1. Upstream server down
2. Proxy misconfiguration
3. Load balancer issues

**Solutions**:
- Usually temporary - retry later
- Check service status page
- Implement retry logic

---

### 503 Service Unavailable

```
HTTP 503 Service Unavailable
```

**Causes**:
1. Server overloaded
2. Maintenance mode
3. Capacity issues

**Solutions**:
```javascript
// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Retry with exponential backoff
async function fetchWithBackoff(url) {
  const maxRetries = 5

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url)
      if (response.status === 503) {
        await sleep(Math.pow(2, i) * 1000)  // 1s, 2s, 4s, 8s, 16s
        continue
      }
      return response
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(Math.pow(2, i) * 1000)
    }
  }
  throw new Error('Max retries exceeded')
}
```

---

### 504 Gateway Timeout

```
HTTP 504 Gateway Timeout
```

**Causes**:
1. Upstream server too slow
2. Long-running operation
3. Network timeout

**Solutions**:
- Increase timeout settings
- Use async/webhook pattern for long operations
- Implement pagination for large responses

---

## Connection Errors

### ECONNREFUSED

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Causes**:
1. Server not running
2. Wrong port
3. Firewall blocking

**Diagnosis**:
```bash
# Check if port is listening
lsof -i :3000
netstat -an | grep 3000
curl -v http://localhost:3000
```

**Solutions**:
1. Start the server
2. Check port configuration
3. Check firewall rules

---

### ENOTFOUND

```
Error: getaddrinfo ENOTFOUND api.example.com
```

**Causes**:
1. Invalid hostname
2. DNS resolution failure
3. No internet connection

**Diagnosis**:
```bash
# Test DNS
nslookup api.example.com
dig api.example.com
ping api.example.com
```

**Solutions**:
1. Check URL spelling
2. Try different DNS (8.8.8.8)
3. Check internet connection
4. Check /etc/hosts file

---

### ETIMEDOUT

```
Error: connect ETIMEDOUT
```

**Causes**:
1. Server not responding
2. Firewall silently dropping
3. Network congestion

**Solutions**:
```javascript
// Increase timeout
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000)

try {
  const response = await fetch(url, { signal: controller.signal })
  clearTimeout(timeoutId)
  return response
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request timed out')
  }
  throw error
}
```

---

### ECONNRESET

```
Error: read ECONNRESET
```

**Causes**:
1. Server closed connection unexpectedly
2. Network interruption
3. Server crashed

**Solutions**:
```javascript
// Implement retry logic
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url)
    } catch (error) {
      if (error.code === 'ECONNRESET' && i < retries - 1) {
        await sleep(1000 * (i + 1))
        continue
      }
      throw error
    }
  }
}
```

---

### SSL/TLS Errors

#### UNABLE_TO_VERIFY_LEAF_SIGNATURE

```
Error: unable to verify the first certificate
```

**Causes**:
1. Self-signed certificate
2. Missing intermediate certificate
3. Expired certificate

**Solutions**:
```javascript
// Development only - disable verification (NOT FOR PRODUCTION)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// Better - add CA certificate
const https = require('https')
const agent = new https.Agent({
  ca: fs.readFileSync('ca-cert.pem'),
})
fetch(url, { agent })
```

#### CERT_HAS_EXPIRED

```
Error: certificate has expired
```

**Solutions**:
1. Update server certificate
2. Check system time is correct
3. Update CA certificates: `update-ca-certificates`

---

## CORS Errors

### Access-Control-Allow-Origin

```
Access to fetch at 'https://api.example.com' from origin 'https://myapp.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Causes**:
1. Server doesn't allow cross-origin requests
2. Missing CORS headers
3. Credentials mode mismatch

**Solutions (Server-side)**:
```javascript
// Express.js
const cors = require('cors')
app.use(cors({
  origin: 'https://myapp.com',  // Or '*' for all (not recommended)
  credentials: true,
}))

// Manual headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://myapp.com')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  next()
})
```

**Solutions (Client-side workarounds)**:
```javascript
// Use proxy in development
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://api.example.com',
        changeOrigin: true,
      }
    }
  }
}

// Then fetch from /api instead
fetch('/api/endpoint')
```

---

### Preflight Request Failed

```
Response to preflight request doesn't pass access control check
```

**Causes**:
1. OPTIONS request not handled
2. Missing preflight headers

**Solutions**:
```javascript
// Handle OPTIONS request
app.options('*', cors())  // Express with cors

// Or manually
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.sendStatus(200)
})
```

---

## JSON Parsing Errors

### Unexpected token < in JSON

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Causes**:
1. Server returned HTML instead of JSON (error page, 404)
2. Wrong endpoint
3. Auth redirect

**Diagnosis**:
```javascript
const response = await fetch(url)
console.log('Status:', response.status)
console.log('Content-Type:', response.headers.get('content-type'))
const text = await response.text()
console.log('Body:', text.substring(0, 200))
```

**Solutions**:
```javascript
// Check response before parsing
const response = await fetch(url)

if (!response.ok) {
  const text = await response.text()
  throw new Error(`HTTP ${response.status}: ${text}`)
}

const contentType = response.headers.get('content-type')
if (!contentType?.includes('application/json')) {
  throw new Error(`Expected JSON, got ${contentType}`)
}

return response.json()
```

---

### Unexpected end of JSON input

```
SyntaxError: Unexpected end of JSON input
```

**Causes**:
1. Empty response body
2. Truncated response
3. Network interruption

**Solutions**:
```javascript
// Check for empty response
const text = await response.text()
if (!text) {
  return null  // Or default value
}
return JSON.parse(text)
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| 400 Bad Request | Client | Check JSON format, Content-Type |
| 401 Unauthorized | Auth | Check token, refresh if expired |
| 403 Forbidden | Auth | Check permissions, rate limits |
| 404 Not Found | Client | Verify URL, check resource exists |
| 429 Too Many Requests | Rate Limit | Implement backoff, reduce requests |
| 500 Internal Server Error | Server | Retry, report to provider |
| 503 Service Unavailable | Server | Retry with exponential backoff |
| ECONNREFUSED | Connection | Start server, check port |
| ENOTFOUND | DNS | Check hostname, DNS settings |
| ETIMEDOUT | Timeout | Increase timeout, check network |
| CORS blocked | Browser | Add CORS headers server-side |
| Unexpected token < | Parse | Check response is JSON not HTML |
