# Gemini Skill

Harness the power of Google's Gemini 3 Pro for comprehensive code analysis, plan reviews, and big context processing. This skill enables Claude Code to leverage Gemini CLI for tasks requiring massive context windows (>200k tokens) and state-of-the-art reasoning capabilities.

## Purpose

The Gemini skill provides access to Google's flagship Gemini 3 Pro model through the Gemini CLI, offering:

- **Massive Context Windows**: Process up to 1M tokens of input across entire codebases
- **State-of-the-Art Performance**: 76.2% on SWE-bench, 35% better at software engineering than Gemini 2.5 Pro
- **Advanced Reasoning**: Exceptional at complex coding tasks, architectural analysis, and agentic workflows
- **Flexible Automation**: Support for both interactive and background/automated execution modes

## When to Use This Skill

Use the Gemini skill when:

- User explicitly asks to run Gemini CLI or mentions Gemini
- Performing comprehensive code reviews across multiple files or entire codebases
- Analyzing architectural plans, technical specifications, or project roadmaps
- Processing large context (>200k tokens) such as entire documentation sets
- Understanding complex relationships and patterns across many files
- Tasks requiring advanced reasoning on software engineering problems

**Activation Keywords**: "use Gemini", "run Gemini", "Gemini review", "analyze with Gemini", "big context", ">200k tokens"

## How It Works

The skill acts as an intelligent wrapper around the Gemini CLI, providing:

1. **Model Selection**: Guides users to choose the optimal Gemini model for their task
2. **Approval Mode Management**: Automatically selects the correct approval mode based on execution context
3. **Background Safety**: Prevents hung processes in non-interactive environments
4. **Structured Prompts**: Helps construct effective prompts for comprehensive analysis

### Execution Flow

```
User Request → Model Selection → Approval Mode → Command Assembly → Execution → Results
```

The skill handles all complexity around:
- Preventing hung processes in background mode
- Choosing between interactive and automated execution
- Timeout management for safety
- Error handling and recovery

## Key Features

### 1. Multiple Model Options

| Model | Best For | Performance |
|-------|----------|-------------|
| `gemini-3-pro-preview` ⭐ | Complex reasoning, coding, agentic tasks | 76.2% SWE-bench, flagship quality |
| `gemini-3-flash` | Sub-second latency, speed-critical tasks | Distilled from 3 Pro, TPU-optimized |
| `gemini-2.5-pro` | Legacy all-around performance | Mature stability |
| `gemini-2.5-flash` | Cost-efficient, high-volume tasks | $0.15/M tokens |
| `gemini-2.5-flash-lite` | Fastest processing | Maximum speed |

### 2. Smart Approval Modes

- **`default`**: Prompts for approval (interactive terminal only)
- **`auto_edit`**: Auto-approves edit tools only (code reviews with suggestions)
- **`yolo`**: Auto-approves all tools (required for background/automated tasks)

### 3. Background Execution Safety

The skill automatically protects against hung processes by:
- Enforcing `--approval-mode yolo` for non-interactive shells
- Providing timeout wrappers for safety
- Detecting and killing hung processes
- Warning against dangerous approval mode combinations

### 4. Large Context Processing

- 1M token input capacity
- Multi-directory analysis support
- Structured prompt guidance
- Efficient codebase traversal

## Usage Examples

### Example 1: Comprehensive Code Review (Background)

```bash
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Perform a comprehensive code review focusing on:
   1. Security vulnerabilities
   2. Performance issues
   3. Code quality and maintainability
   4. Best practices violations"
```

**Use Case**: Automated code review in CI/CD or Claude Code background tasks

### Example 2: Architectural Plan Review

```bash
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Review this architectural plan for:
   1. Scalability concerns
   2. Missing components
   3. Integration challenges
   4. Alternative approaches"
```

**Use Case**: Analyzing technical specifications and system designs

### Example 3: Full Codebase Analysis

```bash
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Analyze the entire codebase to understand:
   1. Overall architecture
   2. Key patterns and conventions
   3. Potential technical debt
   4. Refactoring opportunities"
```

**Use Case**: Understanding large codebases or legacy systems

### Example 4: Interactive Code Review (Terminal Only)

```bash
gemini -m gemini-3-pro-preview --approval-mode default \
  "Review the authentication flow for security issues"
```

**Use Case**: Interactive sessions where user can approve/reject suggestions in real-time

### Example 5: Speed-Critical Analysis

```bash
gemini -m gemini-3-flash --approval-mode yolo \
  "Quick security scan for common vulnerabilities"
```

**Use Case**: Fast analysis with sub-second latency requirements

### Example 6: Multi-Directory Analysis

```bash
gemini -m gemini-3-pro-preview --approval-mode yolo \
  --include-directories /path/to/backend \
  --include-directories /path/to/frontend \
  "Analyze the full-stack application architecture"
```

**Use Case**: Projects spanning multiple directories or repositories

## Command Reference

### Core Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-m, --model` | Select Gemini model | `-m gemini-3-pro-preview` |
| `--approval-mode` | Control tool approval | `--approval-mode yolo` |
| `-y, --yolo` | Shorthand for auto-approve | `-y` |
| `-i, --prompt-interactive` | Execute prompt and continue | `-i "Review auth system"` |
| `--include-directories` | Add directories to workspace | `--include-directories /path` |
| `-s, --sandbox` | Run in sandbox mode | `-s` |

### Approval Modes Quick Reference

| Mode | Interactive | Background | Auto-edits | Use When |
|------|------------|------------|------------|----------|
| `default` | ✅ | ❌ | ❌ | Interactive terminal with manual approval |
| `auto_edit` | ✅ | ⚠️ | ✅ | Code reviews with automatic edit suggestions |
| `yolo` | ✅ | ✅ | ✅ | Background/automated tasks (required) |

## Critical: Background Mode Warning

**NEVER use `--approval-mode default` in background or non-interactive shells** (like Claude Code tool calls). It will hang indefinitely waiting for approval prompts that cannot be provided.

### For Automated/Background Tasks

✅ **DO THIS**:
```bash
# Use yolo for fully automated execution
gemini -m gemini-3-pro-preview --approval-mode yolo "Review codebase"

# Or wrap with timeout for safety
timeout 300 gemini -m gemini-3-pro-preview --approval-mode yolo "Review codebase"
```

❌ **NEVER DO THIS**:
```bash
# Will hang indefinitely in background
gemini -m gemini-3-pro-preview --approval-mode default "Review codebase"
```

### Symptoms of Hung Gemini

- Process running 20+ minutes with 0% CPU usage
- No network activity
- Process state shows 'S' (sleeping)

### Fix Hung Process

```bash
# Check if hung
ps aux | grep gemini | grep -v grep

# Kill if necessary
pkill -9 -f "gemini.*gemini-3-pro-preview"
```

## Best Practices

### 1. Model Selection

- **Default to `gemini-3-pro-preview`**: Best quality, 35% better at software engineering
- **Use `gemini-3-flash`**: When speed is critical (sub-second latency)
- **Use `gemini-2.5-flash`**: For cost-optimized high-volume processing ($0.15/M tokens)

### 2. Prompt Engineering

Be specific and structured:

```bash
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Analyze the authentication system for:
   1. OWASP Top 10 vulnerabilities
   2. JWT token handling security
   3. Session management best practices
   4. Rate limiting implementation
   5. Password hashing strength"
```

### 3. Context Management

- Use `--include-directories` to explicitly specify relevant paths
- Break down massive tasks into focused analyses
- Save structured reports for reference

### 4. Safety

- Always use `--approval-mode yolo` for background tasks
- Add timeout wrappers for safety: `timeout 300 gemini ...`
- Monitor first run to ensure process completes
- Check for hung processes with `ps aux | grep gemini`

## Error Handling

The skill handles common errors:

1. **Non-zero exit codes**: Reports failure and requests direction
2. **Hung processes**: Detects and provides kill commands
3. **Warnings in output**: Summarizes and asks for adjustments
4. **Permission issues**: Asks user before using high-impact flags

## Troubleshooting

### Process Hung in Background

**Detection**:
```bash
ps aux | grep -E "gemini.*gemini-3" | grep -v grep
# Look for: 20+ min runtime, 0% CPU, state 'S'
```

**Resolution**:
```bash
pkill -9 -f "gemini.*gemini-3-pro-preview"
```

**Prevention**: Always use `--approval-mode yolo` for background tasks

### No Output After Long Time

Check if process is waiting for approval:
```bash
ps -o pid,etime,pcpu,stat,command -p <PID>
```

If stat is 'S' and CPU is 0%, kill and restart with `--approval-mode yolo`

### Out of Memory

For very large codebases:
- Use `gemini-3-flash` instead of Pro
- Break analysis into smaller chunks
- Use `--include-directories` to limit scope

## Requirements

- Gemini CLI v0.16.0 or later (for Gemini 3 support)
- Check version: `gemini --version`
- Google Cloud credentials configured
- Sufficient API quota for large context operations

## Tips for Success

1. **Start with Pro**: Default to `gemini-3-pro-preview` for best quality
2. **Be Specific**: Clear, structured prompts yield better results
3. **Use Background Mode Safely**: Always use `yolo` in non-interactive contexts
4. **Leverage Context**: Gemini excels at understanding large codebases
5. **Save Results**: Ask Gemini to output structured reports
6. **Follow Up**: Start new sessions with context from previous findings

## Performance Benchmarks

Gemini 3 Pro advantages:
- **SWE-bench**: 76.2% (state-of-the-art)
- **GPQA Diamond**: 91.9%
- **WebDev Arena**: 1487 Elo
- **35% improvement** over Gemini 2.5 Pro in software engineering tasks

## Integration with Claude Code

The skill seamlessly integrates with Claude Code workflows:

1. User requests Gemini analysis
2. Skill prompts for model selection
3. Determines execution context (interactive vs background)
4. Assembles safe command with proper flags
5. Executes and captures output
6. Returns structured results to user

After completion, users can:
- Start new Gemini session for follow-up
- Continue exploring findings with Claude Code
- Save reports for documentation

## Coming Soon

- `gemini-3-deep-think`: Ultra-complex reasoning with enhanced thinking capabilities
- Extended context windows beyond 1M tokens
- Enhanced multi-modal analysis

## Resources

- [Gemini CLI Documentation](https://github.com/google/generative-ai-docs)
- [Gemini API Reference](https://ai.google.dev/docs)
- [Model Comparison](https://ai.google.dev/models/gemini)

---

**Knowledge Cutoff**: Gemini 3 models have knowledge through January 2025
**Skill Version**: Compatible with Gemini CLI v0.16.0+
