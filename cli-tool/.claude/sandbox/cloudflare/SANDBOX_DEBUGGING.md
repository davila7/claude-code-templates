# Cloudflare Sandbox Debugging Guide

## 🔍 Available Monitoring Tools

### 1. Launcher with Enhanced Logging
**File**: `launcher.ts`
- Detailed logging of each execution step
- Worker availability checks
- Code generation monitoring
- Fallback to direct execution if worker unavailable
- Colored terminal output for better readability

### 2. Real-time Monitor
**File**: `monitor.ts`
- Real-time performance metrics tracking
- Worker health monitoring
- Code generation time analysis
- Sandbox execution monitoring
- Memory usage tracking
- Comprehensive error reporting

### 3. Wrangler CLI Tools
**Built-in Cloudflare debugging tools**:
- `npx wrangler tail` - Real-time log streaming
- `npx wrangler containers list` - Container status
- `npx wrangler deployments list` - Deployment history
- `npx wrangler dev` - Local development server

## 🚨 Common Troubleshooting

### Problem: "Container not ready"
**Symptoms**:
```
Error: Container not ready. Please wait 2-3 minutes after deployment.
```

**Solutions**:
1. **Wait for provisioning**:
   ```bash
   # Check container status
   npx wrangler containers list

   # Expected output after provisioning:
   # ✓ Container ready for sandbox execution
   ```

2. **Verify deployment**:
   ```bash
   npx wrangler deployments list
   # Check deployment status and timestamp
   ```

3. **Check worker logs**:
   ```bash
   npx wrangler tail
   # Look for initialization errors
   ```

### Problem: "Worker not responding"
**Symptoms**:
```
❌ Worker health check failed: fetch failed
```

**Debugging Steps**:
1. **Verify worker is deployed**:
   ```bash
   npx wrangler deploy
   # Should return worker URL
   ```

2. **Test worker endpoint**:
   ```bash
   curl https://your-worker.your-subdomain.workers.dev
   # Should return usage instructions
   ```

3. **Check local development**:
   ```bash
   # For local testing
   npm run dev

   # Test local endpoint
   curl http://localhost:8787
   ```

### Problem: "Anthropic API key not set"
**Symptoms**:
```
Error: ANTHROPIC_API_KEY is required
```

**Solutions**:
1. **Set as Wrangler secret (Production)**:
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   # Paste your key when prompted
   ```

2. **Set in .dev.vars (Local Development)**:
   ```bash
   # Create .dev.vars file:
   echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .dev.vars
   ```

3. **Verify secret is set**:
   ```bash
   npx wrangler secret list
   # Should show ANTHROPIC_API_KEY
   ```

### Problem: "Sandbox execution timeout"
**Symptoms**:
```
Error: Sandbox execution exceeded 30 second timeout
```

**Solutions**:
1. **Use Durable Objects for longer operations**:
   ```typescript
   // In wrangler.toml, ensure Durable Objects are configured
   [[durable_objects.bindings]]
   name = "Sandbox"
   class_name = "Sandbox"
   ```

2. **Optimize code generation**:
   ```typescript
   // Request more concise code
   const prompt = `Generate SIMPLE Python code...`;
   ```

3. **Break into smaller tasks**:
   ```bash
   # Instead of complex operations, break into steps
   npx claude-code-templates --sandbox cloudflare \
     --prompt "Step 1: Create data structure"
   ```

### Problem: "Docker not running" (Local Development)
**Symptoms**:
```
Error: Docker daemon is not running
```

**Solutions**:
1. **Start Docker Desktop**:
   - macOS: Open Docker Desktop application
   - Linux: `sudo systemctl start docker`
   - Windows: Start Docker Desktop

2. **Verify Docker is running**:
   ```bash
   docker ps
   # Should list running containers
   ```

3. **Alternative: Deploy directly to Cloudflare**:
   ```bash
   # Skip local testing, deploy directly
   npx wrangler deploy
   ```

## 📊 Using the Monitor for Debugging

### Basic Monitoring Command:
```bash
# Monitor a simple operation
node monitor.ts "Calculate factorial of 5" your_api_key

# Monitor with custom worker URL
node monitor.ts "Fibonacci 10" your_api_key https://your-worker.workers.dev
```

### Monitor Output Example:
```
[14:32:15] ℹ 🚀 Starting enhanced Cloudflare sandbox monitoring
============================================================
🖥️  SYSTEM INFORMATION
============================================================

Node.js Version: v20.11.0
Platform: darwin
Architecture: arm64
Memory Usage: 45MB / 128MB

============================================================

[14:32:16] ℹ 🔍 Checking Cloudflare Worker health...
[14:32:16] ✓ Worker is responding
[14:32:16] ℹ    Status: 200 OK

[14:32:17] ℹ 🤖 Starting code generation with Claude...
[14:32:19] ✓ Code generated in 2147ms
[14:32:19] ℹ    Model: claude-sonnet-4-5-20250929
[14:32:19] ℹ    Tokens used: 156 in, 89 out
[14:32:19] ℹ    Code length: 234 characters

[14:32:19] ℹ ⚙️  Executing in Cloudflare Sandbox...
[14:32:21] ✓ Sandbox execution completed in 1856ms
[14:32:21] ℹ    Exit code: 0 (success)
[14:32:21] ℹ    Output length: 3 characters

============================================================
📊 PERFORMANCE METRICS
============================================================

Total Execution Time: 4123ms
  ├─ Code Generation: 2147ms
  └─ Sandbox Execution: 1856ms
Memory Usage: 48MB

Status: Success ✓
============================================================
```

## 🎯 Debugging Specific Scenarios

### 1. Code Generation Issues
```bash
# Use monitor to see exact Claude API interaction
node monitor.ts "Complex prompt that might fail"

# Look for:
# - Token usage (may hit limits)
# - Generated code preview
# - Model used (should be claude-sonnet-4-5)
```

### 2. Sandbox Execution Problems
```bash
# Check worker logs while testing
npx wrangler tail &
node launcher.ts "Test prompt"

# Look for:
# - Sandbox creation errors
# - File write failures
# - Python execution errors
```

### 3. Performance Issues
```bash
# Use monitor to identify bottlenecks
node monitor.ts "Your prompt"

# Compare metrics:
# - Code Generation Time (Claude API)
# - Sandbox Execution Time (Cloudflare)
# - Total Round Trip Time
```

### 4. Network/Deployment Issues
```bash
# Check deployments
npx wrangler deployments list

# View recent logs
npx wrangler tail --format=pretty

# Test worker health
curl -v https://your-worker.workers.dev
```

## 🛠 Advanced Configuration

### Enable Debug Mode:
```bash
# In wrangler.toml
[env.development]
vars = { DEBUG = "true" }

# Or in .dev.vars for local development
DEBUG=true
ANTHROPIC_API_KEY=your_key
```

### Custom Timeouts:
```typescript
// In src/index.ts
const result = await sandbox.exec('python /tmp/code.py', {
  timeout: 60000, // 60 seconds
});
```

### Verbose Logging:
```bash
# Set log level
export WRANGLER_LOG=debug

# Run with verbose output
npx wrangler deploy --verbose
```

## 📋 Debugging Checklist

### Before Reporting an Issue:
- [ ] Cloudflare Workers account active (Paid plan if using Durable Objects)
- [ ] Anthropic API key valid and has credits
- [ ] Worker deployed successfully (`npx wrangler deploy`)
- [ ] Waited 2-3 minutes after first deployment
- [ ] Containers provisioned (`npx wrangler containers list`)
- [ ] Secrets configured (`npx wrangler secret list`)
- [ ] Docker running (for local development)
- [ ] Used monitor tool for detailed metrics
- [ ] Checked worker logs (`npx wrangler tail`)
- [ ] Tested with simple prompt first

### Information to Include in Bug Reports:
- Full monitor output showing timestamps and metrics
- Worker URL or local development environment
- Exact prompt that caused the issue
- Components installed (if applicable)
- Worker logs from `npx wrangler tail`
- Container status from `npx wrangler containers list`
- Error messages with full stack traces
- Node.js and Wrangler versions

## 🚀 Performance Optimization Tips

### 1. Minimize Code Generation Time
```typescript
// Be specific to reduce Claude's thinking time
const prompt = `Generate a single Python function to calculate factorial.
Use recursion. Include only the function, no tests.`;
```

### 2. Use Code Interpreter API
```typescript
// Faster than exec for Python
import { getCodeInterpreter } from '@cloudflare/sandbox';
const interpreter = getCodeInterpreter(env.Sandbox, userId);
const result = await interpreter.notebook.execCell(pythonCode);
```

### 3. Implement Caching
```typescript
// Cache generated code for common prompts
const cacheKey = `code:${hashPrompt(prompt)}`;
let code = await env.CACHE.get(cacheKey);
if (!code) {
  code = await generateCode(prompt);
  await env.CACHE.put(cacheKey, code, { expirationTtl: 3600 });
}
```

### 4. Stream Responses
```typescript
// Stream output for better perceived performance
return new Response(
  new ReadableStream({
    async start(controller) {
      const result = await sandbox.exec(command, {
        onStdout: (data) => controller.enqueue(encoder.encode(data)),
      });
      controller.close();
    },
  })
);
```

## 🔗 Useful Commands Reference

### Deployment & Management
```bash
# Deploy worker
npx wrangler deploy

# Deploy to specific environment
npx wrangler deploy --env production

# Rollback deployment
npx wrangler rollback

# Delete deployment
npx wrangler delete
```

### Secrets Management
```bash
# Add secret
npx wrangler secret put SECRET_NAME

# List secrets
npx wrangler secret list

# Delete secret
npx wrangler secret delete SECRET_NAME
```

### Local Development
```bash
# Start dev server
npm run dev

# Start with specific port
npx wrangler dev --port 3000

# Start with remote Durable Objects
npx wrangler dev --remote
```

### Monitoring & Logs
```bash
# Tail logs in real-time
npx wrangler tail

# Tail with pretty formatting
npx wrangler tail --format=pretty

# Tail specific deployment
npx wrangler tail --deployment-id <id>

# Filter logs
npx wrangler tail --status error
```

### Container Management
```bash
# List containers
npx wrangler containers list

# Get container details
npx wrangler containers describe <container-id>
```

## 💡 Tips & Best Practices

1. **Always test locally first**: Use `npm run dev` before deploying
2. **Monitor metrics**: Use the monitor tool to track performance
3. **Check logs regularly**: Set up `npx wrangler tail` during testing
4. **Use environment-specific configs**: Separate dev/prod in wrangler.toml
5. **Implement error handling**: Catch and log all errors properly
6. **Set appropriate timeouts**: Balance between user experience and resource usage
7. **Use Durable Objects wisely**: Only for stateful operations
8. **Cache aggressively**: Reduce API calls with smart caching
9. **Stream when possible**: Better UX for long operations
10. **Version your deployments**: Tag releases for easy rollback

---

**With these tools and techniques, you can effectively debug and optimize your Cloudflare sandbox implementation.**
