# E2B Claude Code Sandbox

Execute Claude Code in an isolated E2B cloud sandbox environment.

## Description

This component sets up E2B (E2B.dev) integration to run Claude Code in a secure, isolated cloud environment. Perfect for executing code safely without affecting your local system.

## Features

- **Isolated Execution**: Run Claude Code in a secure cloud sandbox
- **Pre-configured Environment**: Ships with Claude Code already installed
- **API Integration**: Seamless connection to Anthropic's Claude API
- **Safe Code Execution**: Execute prompts without local system risks
- **Component Installation**: Automatically installs any components specified with CLI flags

## Requirements

- E2B API Key (get from https://e2b.dev/dashboard)
- Anthropic API Key
- Python 3.11+ (for E2B SDK)

## Usage

```bash
# Execute a prompt in E2B sandbox (requires API keys as environment variables or CLI parameters)
npx claude-code-templates@latest --sandbox e2b --prompt "Create a React todo app"

# Pass API keys directly as parameters
npx claude-code-templates@latest --sandbox e2b \
  --e2b-api-key your_e2b_key \
  --anthropic-api-key your_anthropic_key \
  --prompt "Create a React todo app"

# Install components and execute in sandbox
npx claude-code-templates@latest --sandbox e2b \
  --agent frontend-developer \
  --command setup-react \
  --e2b-api-key your_e2b_key \
  --anthropic-api-key your_anthropic_key \
  --prompt "Create a modern todo app with TypeScript"
```

## Environment Setup

The component will create:
- `.claude/sandbox/e2b-launcher.py` - Python script to launch E2B sandbox
- `.claude/sandbox/requirements.txt` - Python dependencies  
- `.claude/sandbox/.env.example` - Environment variables template

## API Key Configuration

You can provide API keys in two ways:

### Option 1: CLI Parameters (Recommended)
```bash
# Pass keys directly as command parameters
npx claude-code-templates@latest --sandbox e2b \
  --e2b-api-key your_e2b_api_key \
  --anthropic-api-key your_anthropic_api_key \
  --prompt "Your prompt here"
```

### Option 2: Environment Variables
Set these environment variables in your shell or `.env` file:
```bash
export E2B_API_KEY=your_e2b_api_key_here
export ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Or create .claude/sandbox/.env file:
E2B_API_KEY=your_e2b_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Note**: CLI parameters take precedence over environment variables.

## How it Works

1. Creates E2B sandbox with `anthropic-claude-code` template
2. Installs any specified components (agents, commands, etc.)
3. Executes your prompt using Claude Code inside the sandbox
4. Returns the complete output and any generated files
5. Automatically cleans up the sandbox after execution

## Security Benefits

- **Isolation**: Code runs in a separate cloud environment
- **No Local Impact**: No risk to your local system or files
- **Temporary**: Sandbox is destroyed after execution
- **Controlled**: Only specified components and prompts are executed

## Examples

```bash
# Simple web app creation
npx claude-code-templates@latest --sandbox e2b --prompt "Create an HTML page with CSS animations"

# Full stack development
npx claude-code-templates@latest --sandbox e2b --agent fullstack-developer --prompt "Create a Node.js API with authentication"

# Data analysis
npx claude-code-templates@latest --sandbox e2b --agent data-scientist --prompt "Analyze this CSV data and create visualizations"
```

## Template Information

- **Provider**: E2B (https://e2b.dev)
- **Base Template**: anthropic-claude-code
- **Timeout**: 5 minutes (configurable)
- **Environment**: Ubuntu with Claude Code pre-installed