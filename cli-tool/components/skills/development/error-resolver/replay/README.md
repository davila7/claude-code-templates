# Replay System

The replay system records successful error resolutions for future reference, enabling faster problem-solving when similar errors occur.

## How It Works

```
1. Encounter Error
       |
       v
2. Check Replay History -----> Match Found? ---> Apply Known Solution
       |                             |
       No Match                      |
       |                             v
       v                        Verify & Done
3. Analyze & Resolve
       |
       v
4. Record Solution ---------> .claude/error-solutions/
       |
       v
5. Future Benefit
```

## Directory Structure

```
project/
└── .claude/
    └── error-solutions/
        ├── nodejs-module-not-found-express.yaml
        ├── react-hydration-mismatch-date.yaml
        ├── postgres-connection-refused.yaml
        └── ...
```

## Recording Solutions

### When to Record

Record a solution when:
- You spent significant time debugging
- The error is likely to recur
- The solution isn't obvious
- Team members might encounter same issue

### How to Record

1. Copy the template:
```bash
mkdir -p .claude/error-solutions
cp solution-template.yaml .claude/error-solutions/<error-signature>.yaml
```

2. Fill in the details:
```yaml
id: "nodejs-module-not-found-express"
created: "2024-01-15T10:30:00Z"

error:
  type: "dependency"
  category: "ModuleNotFound"
  language: "nodejs"
  pattern: "Cannot find module 'express'"
  context: "Starting Node.js server"

diagnosis:
  root_cause: "Express package not installed"
  factors:
    - "npm install not run after git clone"
    - "package.json missing express"

solution:
  immediate:
    - "Run: npm install express"
  proper:
    - "Add express to package.json if missing"
    - "Run: npm install"

verification:
  - "Run: node server.js"
  - "Check server starts without error"

prevention:
  - "Document npm install in README"
  - "Use npm ci in CI/CD"

metadata:
  tags: ["nodejs", "npm", "dependency"]
```

## Error Signature Generation

Create consistent signatures for matching:

### Pattern: `[language]-[category]-[specific]`

Examples:
- `nodejs-module-not-found-express`
- `react-hydration-mismatch-date`
- `python-import-error-circular`
- `postgres-connection-refused-docker`
- `docker-permission-denied-volume`

### Normalizing Error Messages

Replace specific values with placeholders:

| Original | Normalized |
|----------|------------|
| `Cannot find module 'express'` | `Cannot find module '{module}'` |
| `User 12345 not found` | `User {id} not found` |
| `Connection refused 127.0.0.1:5432` | `Connection refused {host}:{port}` |

## Lookup Process

When encountering an error:

### 1. Generate Signature

```
Error: Cannot find module 'lodash'
  |
  v
Category: ModuleNotFound
Language: nodejs
  |
  v
Pattern: nodejs-module-not-found-*
```

### 2. Search Solutions

```bash
# Find matching solutions
ls .claude/error-solutions/ | grep "nodejs-module-not-found"
```

### 3. Check Match Quality

```yaml
# Compare error pattern
error:
  pattern: "Cannot find module '{module}'"  # Matches!

# Check context
context: "Starting Node.js server"  # Same context!
```

### 4. Apply Solution

Follow the steps in `solution.immediate` or `solution.proper`.

### 5. Update Metadata

```yaml
metadata:
  occurrences: 6  # Increment
  last_resolved: "2024-01-20T14:30:00Z"  # Update
```

## Best Practices

### Writing Good Solutions

1. **Be Specific**
   ```yaml
   # Bad
   root_cause: "Something wrong with dependencies"

   # Good
   root_cause: "Express package not in node_modules because npm install wasn't run after cloning"
   ```

2. **Include Commands**
   ```yaml
   commands:
     - "npm install express"
     - "npm ls express"  # Verify installation
   ```

3. **Document Verification**
   ```yaml
   verification:
     - "Server starts without error"
     - "GET /api/health returns 200"
   ```

4. **Add Prevention**
   ```yaml
   prevention:
     - "Add postinstall check script"
     - "Document setup in README"
   ```

### Organizing Solutions

**By Language/Framework:**
```
nodejs-*.yaml
python-*.yaml
react-*.yaml
```

**By Error Type:**
```
*-connection-refused-*.yaml
*-module-not-found-*.yaml
*-permission-denied-*.yaml
```

### Team Sharing

1. **Version Control**
   ```bash
   # Add to git
   git add .claude/error-solutions/
   git commit -m "Add error solution: nodejs-module-not-found-express"
   ```

2. **Review Solutions**
   - Include solutions in code review
   - Validate accuracy before merging

3. **Maintain Currency**
   - Update solutions when better fixes found
   - Remove obsolete solutions
   - Add timestamps for relevance

## Integration with Error Resolver

When using the error-resolver skill:

1. **Automatic Lookup**: Check replay history first
2. **Match Scoring**: Rate match quality (exact > pattern > category)
3. **Solution Application**: Apply known solution if high confidence
4. **Gap Analysis**: Identify missing patterns to record
5. **Continuous Learning**: Record new solutions after resolution

## Example Solutions

### Simple: Missing Dependency

```yaml
id: "nodejs-module-not-found-express"
error:
  type: "dependency"
  pattern: "Cannot find module 'express'"
solution:
  immediate:
    - "npm install express"
```

### Complex: Race Condition

```yaml
id: "react-state-update-unmounted"
error:
  type: "runtime"
  pattern: "Can't perform a React state update on an unmounted component"
  context: "Async operation completing after component unmount"
diagnosis:
  root_cause: "useEffect cleanup not cancelling async operations"
  factors:
    - "fetch() or setTimeout() completing after unmount"
    - "No cleanup function in useEffect"
solution:
  proper:
    - "Add cleanup function to useEffect"
    - "Use AbortController for fetch"
    - "Track mounted state with ref"
  code_change: |
    useEffect(() => {
      const controller = new AbortController()
      fetch(url, { signal: controller.signal })
        .then(res => res.json())
        .then(setData)
      return () => controller.abort()
    }, [url])
```

### Environment-Specific: Docker

```yaml
id: "docker-permission-denied-volume"
error:
  type: "permission"
  pattern: "permission denied: '/app/data'"
  context: "Docker container cannot write to mounted volume"
diagnosis:
  root_cause: "Container user doesn't have write permission to host directory"
  factors:
    - "Container runs as non-root user"
    - "Host directory owned by different user"
solution:
  immediate:
    - "chmod 777 /host/path"  # Quick but not secure
  proper:
    - "Match container user ID to host user"
    - "Use named volume instead of bind mount"
  commands:
    - "chown -R 1000:1000 /host/path"
```
