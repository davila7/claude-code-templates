# Cloudflare Claude Code Sandbox

Execute Claude Code in an isolated Cloudflare Workers sandbox environment with AI-powered code execution.

## Description

This component sets up Cloudflare Sandbox SDK integration to run Claude Code in a secure, isolated cloud environment. Built on Cloudflare's container-based sandboxes with Durable Objects for persistent execution.

## Features

- **Isolated Execution**: Run Claude Code in secure Cloudflare Workers sandboxes
- **AI Code Executor**: Turn natural language into executable Python/Node.js code
- **Real-time Streaming**: Stream execution output as it happens
- **Persistent Storage**: Use Durable Objects for stateful sandbox sessions
- **Global Distribution**: Leverage Cloudflare's edge network for low latency
- **Component Installation**: Automatically install agents and commands in sandbox

## Requirements

- Cloudflare Account (Workers Paid plan for Durable Objects)
- Anthropic API Key
- Node.js 16.17.0+
- Docker (for local development)
- Wrangler CLI

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  User Request (Natural Language)                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Worker (API Endpoint)                   │
│  • POST /execute                                    │
│  • Receives question/prompt                         │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Claude AI (via Anthropic SDK)                      │
│  • Generates Python/TypeScript code                 │
│  • Returns executable implementation                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Sandbox (Durable Object)                │
│  • Isolated container execution                     │
│  • Python/Node.js runtime                          │
│  • File system access                              │
│  • Real-time streaming output                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Results                                            │
│  • Generated code                                   │
│  • Execution output                                │
│  • Error messages (if any)                         │
└─────────────────────────────────────────────────────┘
```

## Usage

```bash
# Execute a prompt in Cloudflare sandbox
npx claude-code-templates@latest --sandbox cloudflare --prompt "Calculate the 10th Fibonacci number"

# Pass API keys directly
npx claude-code-templates@latest --sandbox cloudflare \
  --anthropic-api-key your_anthropic_key \
  --prompt "Create a web scraper"

# Install components and execute
npx claude-code-templates@latest --sandbox cloudflare \
  --agent frontend-developer \
  --command setup-react \
  --anthropic-api-key your_anthropic_key \
  --prompt "Create a modern todo app"

# Deploy your own Cloudflare Worker sandbox
cd .claude/sandbox/cloudflare
npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

## Environment Setup

The component creates:
- `.claude/sandbox/cloudflare/src/index.ts` - Worker with sandbox logic
- `.claude/sandbox/cloudflare/wrangler.toml` - Cloudflare configuration
- `.claude/sandbox/cloudflare/package.json` - Node.js dependencies
- `.claude/sandbox/cloudflare/launcher.ts` - TypeScript launcher script
- `.claude/sandbox/cloudflare/monitor.ts` - Real-time monitoring tool

## API Key Configuration

### Option 1: CLI Parameters (Recommended)
```bash
npx claude-code-templates@latest --sandbox cloudflare \
  --anthropic-api-key your_anthropic_api_key \
  --prompt "Your prompt here"
```

### Option 2: Wrangler Secrets
```bash
cd .claude/sandbox/cloudflare
npx wrangler secret put ANTHROPIC_API_KEY
# Paste your API key when prompted
```

### Option 3: Environment Variables
```bash
export ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Or create .dev.vars file:
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Note**: Wrangler secrets are required for production deployment. CLI parameters work for local execution only.

## How it Works

1. User sends natural language request (e.g., "What's the factorial of 5?")
2. Cloudflare Worker receives request via POST /execute
3. Claude generates executable Python/TypeScript code via Anthropic API
4. Code is written to sandbox file system
5. Sandbox executes code in isolated container
6. Results stream back in real-time
7. Worker returns both code and execution output

## Deployment

### Local Development
```bash
cd .claude/sandbox/cloudflare
npm install
npm run dev

# Test locally
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "What is 2^10?"}'
```

### Production Deployment
```bash
# Set API key secret
npx wrangler secret put ANTHROPIC_API_KEY

# Deploy to Cloudflare Workers
npx wrangler deploy

# Wait 2-3 minutes for container provisioning
npx wrangler containers list

# Test deployment
curl -X POST https://your-worker.your-subdomain.workers.dev/execute \
  -H "Content-Type: application/json" \
  -d '{"question": "Calculate factorial of 5"}'
```

## Security Benefits

- **Container Isolation**: Each execution runs in isolated Cloudflare container
- **No Local Access**: Sandboxes have no access to your local system
- **Resource Limits**: Automatic CPU time and memory constraints
- **Temporary Execution**: Containers destroyed after execution
- **Edge Security**: Cloudflare's security infrastructure built-in

## Advanced Features

### Code Interpreter API
```typescript
// Use built-in code interpreter instead of exec
import { getCodeInterpreter } from '@cloudflare/sandbox';

const interpreter = getCodeInterpreter(env.Sandbox, 'user-id');
const result = await interpreter.notebook.execCell('print(2**10)');
```

### Streaming Output
```typescript
// Stream execution results in real-time
return new Response(
  new ReadableStream({
    async start(controller) {
      const result = await sandbox.exec('python script.py', {
        onStdout: (data) => controller.enqueue(data),
        onStderr: (data) => controller.enqueue(data)
      });
      controller.close();
    }
  })
);
```

### Persistent Sessions
```typescript
// Maintain sandbox state across requests
const sandbox = getSandbox(env.Sandbox, userId);
await sandbox.writeFile('/data/state.json', JSON.stringify(state));
// Later...
const state = await sandbox.readFile('/data/state.json');
```

## Examples

```bash
# Mathematical computation
npx claude-code-templates@latest --sandbox cloudflare \
  --prompt "Calculate the 100th Fibonacci number"

# Data analysis
npx claude-code-templates@latest --sandbox cloudflare \
  --prompt "What is the mean of [10, 20, 30, 40, 50]?"

# String manipulation
npx claude-code-templates@latest --sandbox cloudflare \
  --prompt "Reverse the string 'Hello World'"

# Web development
npx claude-code-templates@latest --sandbox cloudflare \
  --agent frontend-developer \
  --prompt "Create a responsive navigation bar"
```

## Comparison with E2B

| Feature | Cloudflare Sandbox | E2B Sandbox |
|---------|-------------------|-------------|
| **Provider** | Cloudflare Workers | E2B.dev |
| **Infrastructure** | Cloudflare Edge Network | Cloud VMs |
| **Pricing** | $5/month (Workers Paid) | Usage-based |
| **Cold Start** | ~100ms | ~2-3 seconds |
| **Max Duration** | 30 seconds (Workers) | Up to hours |
| **Languages** | Python, Node.js | Full Linux environment |
| **Global** | Yes (edge network) | Single region |
| **Best For** | Fast, lightweight tasks | Long-running operations |

## Troubleshooting

### Container Not Ready
```bash
# After first deployment, wait 2-3 minutes
npx wrangler containers list

# Check container status
npx wrangler tail
```

### API Key Issues
```bash
# Verify secret is set
npx wrangler secret list

# Update secret
npx wrangler secret put ANTHROPIC_API_KEY
```

### Local Development Issues
```bash
# Ensure Docker is running
docker ps

# Clear wrangler cache
rm -rf .wrangler

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Performance Tips

1. **Use Code Interpreter API** for better Python performance
2. **Implement caching** for frequently used code patterns
3. **Stream output** for long-running operations
4. **Use Durable Objects** for session persistence
5. **Deploy to multiple regions** (automatic with Workers)

## Template Information

- **Provider**: Cloudflare Workers + Sandbox SDK
- **Runtime**: V8 isolates with container sandboxes
- **Languages**: Python 3.x, Node.js
- **Timeout**: 30 seconds (Workers), configurable for Durable Objects
- **Memory**: 128MB default
- **Storage**: Ephemeral (use Durable Objects for persistence)

## Resources

- [Cloudflare Sandbox SDK Docs](https://developers.cloudflare.com/sandbox/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Anthropic API Documentation](https://docs.anthropic.com/)

## Next Steps

After installation:
1. Set up Cloudflare account and get API credentials
2. Install Wrangler CLI: `npm install -g wrangler`
3. Configure secrets: `npx wrangler secret put ANTHROPIC_API_KEY`
4. Deploy your worker: `npx wrangler deploy`
5. Test with example requests
6. Customize sandbox configuration for your use case

## License

Uses Cloudflare Sandbox SDK (open source) and requires Cloudflare Workers Paid plan ($5/month) for Durable Objects support.
