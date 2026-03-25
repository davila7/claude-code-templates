# Node.js Error Patterns

Common Node.js errors with diagnosis and solutions.

## Module Errors

### MODULE_NOT_FOUND

```
Error: Cannot find module 'package-name'
```

**Causes**:
1. Package not installed
2. Typo in import/require
3. node_modules corrupted
4. Wrong relative path

**Solutions**:
```bash
# Install missing package
npm install package-name

# If corrupted node_modules
rm -rf node_modules package-lock.json
npm install

# Check if package exists
npm ls package-name
```

**Prevention**: Use `npm ci` in CI/CD, add postinstall check.

---

### ERR_MODULE_NOT_FOUND (ESM)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'x' imported from y
```

**Causes**:
1. ESM import without file extension
2. Package doesn't support ESM
3. Missing `"type": "module"` in package.json

**Solutions**:
```javascript
// Add file extension for local imports
import { foo } from './utils.js'  // Not './utils'

// For CommonJS packages, use createRequire
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pkg = require('commonjs-package')
```

---

## Network Errors

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
# Check if port is in use
lsof -i :3000
netstat -an | grep 3000

# Check if service is running
ps aux | grep node
```

**Solutions**:
1. Start the server first
2. Verify port number matches
3. Check firewall rules

---

### ENOTFOUND

```
Error: getaddrinfo ENOTFOUND hostname
```

**Causes**:
1. Invalid hostname/URL
2. DNS resolution failure
3. No internet connection

**Diagnosis**:
```bash
# Test DNS resolution
nslookup hostname
dig hostname

# Test connectivity
ping hostname
curl -I https://hostname
```

**Solutions**:
1. Check URL spelling
2. Try IP address instead of hostname
3. Check /etc/hosts file
4. Check DNS settings

---

### ETIMEDOUT

```
Error: connect ETIMEDOUT
```

**Causes**:
1. Network too slow
2. Server overloaded
3. Firewall silently dropping

**Solutions**:
```javascript
// Increase timeout
const axios = require('axios')
axios.get(url, { timeout: 30000 })

// With fetch
const controller = new AbortController()
setTimeout(() => controller.abort(), 30000)
fetch(url, { signal: controller.signal })
```

---

## File System Errors

### ENOENT

```
Error: ENOENT: no such file or directory, open 'path/to/file'
```

**Causes**:
1. File doesn't exist
2. Wrong path (relative vs absolute)
3. Typo in filename

**Diagnosis**:
```bash
# Check if file exists
ls -la path/to/file

# Check current working directory
pwd

# List directory contents
ls -la path/to/
```

**Solutions**:
```javascript
// Check before accessing
const fs = require('fs')
if (fs.existsSync(filePath)) {
  // proceed
}

// Use path.join for cross-platform
const path = require('path')
const filePath = path.join(__dirname, 'data', 'file.json')
```

---

### EACCES

```
Error: EACCES: permission denied
```

**Causes**:
1. No read/write permission
2. File owned by another user
3. Directory not accessible

**Diagnosis**:
```bash
# Check permissions
ls -la /path/to/file

# Check ownership
stat /path/to/file
```

**Solutions**:
```bash
# Change permissions (careful!)
chmod 644 /path/to/file  # read/write for owner, read for others
chmod 755 /path/to/dir   # execute for directories

# Change ownership
sudo chown $USER:$USER /path/to/file

# For npm global packages
sudo chown -R $USER /usr/local/lib/node_modules
```

---

### EMFILE

```
Error: EMFILE: too many open files
```

**Causes**:
1. Opening files without closing
2. System file descriptor limit reached
3. Watching too many files

**Solutions**:
```bash
# Check current limit
ulimit -n

# Increase limit (temporary)
ulimit -n 10000

# Increase limit (permanent) - add to ~/.bashrc or /etc/security/limits.conf
# * soft nofile 10000
# * hard nofile 10000
```

```javascript
// Use streams for large files
const stream = fs.createReadStream(file)
stream.on('close', () => {
  // file handle released
})

// Use graceful-fs
const fs = require('graceful-fs')
```

---

## Syntax/Parse Errors

### SyntaxError: Unexpected token

```
SyntaxError: Unexpected token '<'
```

**Common Causes by Token**:

| Token | Likely Cause |
|-------|--------------|
| `<` | HTML returned instead of JSON (API error, 404 page) |
| `}` | Missing opening brace or extra closing |
| `{` | Missing closing brace |
| `)` | Missing opening parenthesis |
| `import` | Using ESM in CommonJS context |
| `await` | await outside async function |

**Solutions**:
```javascript
// For '<' - check API response
const res = await fetch(url)
console.log(res.status, await res.text())  // Debug first

// For import in CommonJS
// Either use require():
const pkg = require('package')

// Or add to package.json:
{ "type": "module" }
```

---

### SyntaxError: Cannot use import statement outside a module

```
SyntaxError: Cannot use import statement outside a module
```

**Solutions**:

Option 1: Use ESM
```json
// package.json
{ "type": "module" }
```

Option 2: Use .mjs extension
```bash
mv index.js index.mjs
```

Option 3: Convert to CommonJS
```javascript
// Change
import express from 'express'
// To
const express = require('express')
```

---

## Type Errors

### TypeError: Cannot read property 'x' of undefined

```
TypeError: Cannot read properties of undefined (reading 'name')
```

**Causes**:
1. Object is undefined/null
2. Async operation not awaited
3. Wrong object structure

**Solutions**:
```javascript
// Optional chaining
const name = user?.profile?.name

// Nullish coalescing
const name = user?.name ?? 'default'

// Guard clause
if (!user || !user.profile) {
  return null
}

// Destructuring with defaults
const { name = 'default' } = user || {}
```

---

### TypeError: x is not a function

```
TypeError: callback is not a function
```

**Causes**:
1. Variable is not a function
2. Import failed silently
3. Wrong export type (default vs named)

**Diagnosis**:
```javascript
console.log(typeof callback)  // Should be 'function'
console.log(callback)         // See what it actually is
```

**Solutions**:
```javascript
// Check before calling
if (typeof callback === 'function') {
  callback()
}

// Fix import - named vs default
// Wrong:
import myFunc from './module'  // when it's named export
// Correct:
import { myFunc } from './module'

// Or vice versa
// Wrong:
import { myFunc } from './module'  // when it's default export
// Correct:
import myFunc from './module'
```

---

## Async Errors

### UnhandledPromiseRejectionWarning

```
UnhandledPromiseRejectionWarning: Error: something went wrong
```

**Causes**:
1. Promise rejected without .catch()
2. async function error without try/catch
3. Missing await

**Solutions**:
```javascript
// Always handle promise rejections
promise
  .then(result => {})
  .catch(error => console.error(error))

// Or use try/catch with async/await
async function main() {
  try {
    const result = await someAsyncOperation()
  } catch (error) {
    console.error('Error:', error)
  }
}

// Global handler (last resort)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason)
})
```

---

### ERR_INVALID_CALLBACK

```
TypeError [ERR_INVALID_CALLBACK]: Callback must be a function
```

**Causes**:
1. Passing non-function where callback expected
2. Missing callback argument
3. Mixing callback and promise APIs

**Solutions**:
```javascript
// Wrong - mixing styles
fs.readFile('file.txt', 'utf8')  // Missing callback

// Correct - callback style
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) throw err
  console.log(data)
})

// Correct - promise style
const fs = require('fs').promises
const data = await fs.readFile('file.txt', 'utf8')
```

---

## Memory Errors

### JavaScript heap out of memory

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Causes**:
1. Memory leak
2. Processing large data in memory
3. Infinite loop creating objects

**Solutions**:
```bash
# Increase memory limit
node --max-old-space-size=4096 app.js

# For npm scripts
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

```javascript
// Use streams for large files
const stream = fs.createReadStream('large-file.json')
stream.on('data', chunk => {
  // Process chunk by chunk
})

// Clear references
let data = loadLargeData()
processData(data)
data = null  // Allow garbage collection
```

**Diagnosis**:
```javascript
// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage()
  console.log(`Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`)
}, 5000)
```

---

## Process Errors

### SIGTERM / SIGINT

```
Process exited with SIGTERM
```

**Causes**:
1. Process killed externally (Ctrl+C, kill command)
2. Container orchestrator stopping container
3. System shutdown

**Solutions**:
```javascript
// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received (Ctrl+C)')
  process.exit(0)
})
```

---

## NPM Errors

### ERESOLVE unable to resolve dependency tree

```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Causes**:
1. Peer dependency conflict
2. Package version mismatch
3. npm 7+ stricter resolution

**Solutions**:
```bash
# See the conflict
npm install --legacy-peer-deps

# Or force install (use carefully)
npm install --force

# Better: fix the conflict
npm ls package-name  # See which versions are installed
npm why package-name  # See why it's installed
```

---

### EINTEGRITY

```
npm ERR! EINTEGRITY sha512-xxx
```

**Causes**:
1. Corrupted cache
2. Package modified after caching
3. Network issues during download

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Remove and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Quick Reference Table

| Error Code | Category | Quick Fix |
|------------|----------|-----------|
| `MODULE_NOT_FOUND` | Dependency | `npm install <pkg>` |
| `ECONNREFUSED` | Network | Start the server |
| `ENOTFOUND` | Network | Check URL/hostname |
| `ENOENT` | Filesystem | Check file path exists |
| `EACCES` | Permission | `chmod` or `chown` |
| `EMFILE` | Filesystem | Increase ulimit |
| `heap out of memory` | Memory | `--max-old-space-size` |
| `Unexpected token` | Syntax | Check file content type |
| `not a function` | Type | Check import/export |
| `ERESOLVE` | NPM | `--legacy-peer-deps` |
