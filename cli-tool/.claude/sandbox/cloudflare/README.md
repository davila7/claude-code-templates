# Cloudflare Claude Code Sandbox

Execute Claude Code in isolated Cloudflare Workers sandboxes with AI-powered code generation.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key
```bash
# For local development, create .dev.vars:
echo "ANTHROPIC_API_KEY=your-api-key-here" > .dev.vars

# For production, use wrangler secrets:
npx wrangler secret put ANTHROPIC_API_KEY
```

### 3. Local Development
```bash
# Start development server (requires Docker)
npm run dev

# In another terminal, test the endpoint:
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the 10th Fibonacci number?"}'
```

### 4. Deploy to Cloudflare
```bash
# Deploy worker
npx wrangler deploy

# Wait 2-3 minutes for container provisioning
npx wrangler containers list

# Test production endpoint
curl -X POST https://your-worker.your-subdomain.workers.dev/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "Calculate factorial of 5"}'
```

## Architecture

This sandbox combines three powerful technologies:

1. **Claude AI** (Anthropic) - Generates executable code from natural language
2. **Cloudflare Workers** - Runs at the edge for global low-latency access
3. **Sandbox SDK** - Provides isolated container execution

```
User Question → Cloudflare Worker → Claude AI → Generated Code → Sandbox → Results
```

## API Reference

### POST /execute

Execute a natural language question as code.

**Request:**
```json
{
  "question": "What is the 100th Fibonacci number?",
  "maxTokens": 2048,          // Optional: Max tokens for code generation
  "timeout": 30000,            // Optional: Execution timeout in ms
  "language": "python"         // Optional: "python" or "javascript"
}
```

**Response:**
```json
{
  "success": true,
  "question": "What is the 100th Fibonacci number?",
  "code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nprint(fibonacci(100))",
  "output": "354224848179261915075\n",
  "error": "",
  "sandboxId": "user-1234567890-abc123",
  "executionTime": 2147
}
```

### GET /health

Check worker health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-19T12:00:00.000Z",
  "worker": "cloudflare-claude-sandbox"
}
```

## Command Line Tools

### Launcher
Execute prompts directly from command line:

```bash
# Basic usage
node launcher.ts "Calculate factorial of 5"

# With custom worker URL
node launcher.ts "Fibonacci 10" "" your_api_key https://your-worker.workers.dev

# With components
node launcher.ts "Create a React app" "--agent frontend-developer" your_api_key
```

### Monitor
Monitor execution with detailed metrics:

```bash
# Monitor execution
node monitor.ts "Calculate factorial of 5" your_api_key

# Monitor production worker
node monitor.ts "Sum array" your_api_key https://your-worker.workers.dev
```

## Examples

### Mathematical Calculations
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the factorial of 20?"}'
```

### String Manipulation
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "Reverse the string Hello World"}'
```

### Data Analysis
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "Calculate the mean of [10, 20, 30, 40, 50]"}'
```

### JavaScript Execution
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Sort an array of numbers",
    "language": "javascript"
  }'
```

## Configuration

### Environment Variables

**Local Development (.dev.vars):**
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Production (Wrangler Secrets):**
```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

### Wrangler Configuration

Edit `wrangler.toml` to customize:

```toml
# Worker name (must be unique)
name = "my-custom-sandbox"

# Resource limits
[limits]
cpu_ms = 100  # CPU time per request

# Environment-specific configuration
[env.production]
vars = { ENVIRONMENT = "production" }
```

## Troubleshooting

### Container Not Ready
After first deployment, wait 2-3 minutes:
```bash
npx wrangler containers list
```

### Docker Issues (Local Development)
Ensure Docker is running:
```bash
docker ps
```

### API Key Not Set
For local development:
```bash
echo "ANTHROPIC_API_KEY=your-key" > .dev.vars
```

For production:
```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

### View Logs
```bash
# Real-time logs
npx wrangler tail

# Pretty formatted
npx wrangler tail --format=pretty
```

## Performance Tips

1. **Use specific prompts**: More specific questions generate faster code
2. **Implement caching**: Cache generated code for common questions
3. **Stream output**: Use streaming for long-running operations
4. **Set appropriate timeouts**: Balance between UX and resource usage
5. **Monitor metrics**: Use the monitor tool to identify bottlenecks

## Security

- Sandboxes are isolated containers with no network access
- Code execution is limited by timeout (default 30s)
- CPU and memory limits are enforced by Cloudflare
- API keys are stored as encrypted Wrangler secrets
- CORS is enabled for browser access (configure as needed)

## Cost Estimation

**Cloudflare Workers:**
- Free tier: 100,000 requests/day (limited Durable Objects)
- Paid plan ($5/month): 10M requests/month + unlimited Durable Objects

**Anthropic API:**
- Claude Sonnet 4.5: ~$3 per million input tokens
- Average request: ~200 tokens = $0.0006 per request

**Example costs for 10,000 requests/month:**
- Cloudflare: $5/month (paid plan)
- Anthropic: ~$6/month (avg 200 tokens/request)
- **Total: ~$11/month**

## Development

### Project Structure
```
cloudflare-claude-sandbox/
├── src/
│   └── index.ts           # Worker source code
├── launcher.ts            # CLI launcher tool
├── monitor.ts             # Monitoring tool
├── wrangler.toml          # Cloudflare configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── README.md              # This file
```

### Scripts
- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run tail` - View real-time logs
- `npm run launch` - Run launcher tool
- `npm run monitor` - Run monitoring tool
- `npm run type-check` - Check TypeScript types
- `npm test` - Run tests

## Resources

- [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check the [debugging guide](./SANDBOX_DEBUGGING.md)
2. Run the monitor tool for detailed metrics
3. Check Cloudflare worker logs: `npx wrangler tail`
4. Open an issue on GitHub

---

Built with ❤️ using Cloudflare Workers, Claude AI, and the Sandbox SDK
