---
name: gemini
description: Use when the user asks to run Gemini CLI for code review, plan review, or big context (>200k) processing. Ideal for comprehensive analysis requiring large context windows. Uses Gemini 3 Pro by default for state-of-the-art reasoning and coding.
---

# Gemini Skill Guide

## When to Use Gemini
- WHEN ASKED TO BE ACTIVATED
- **Code Review**: Comprehensive code reviews across multiple files
- **Plan Review**: Analyzing architectural plans, technical specifications, or project roadmaps
- **Big Context Processing**: Tasks requiring >200k tokens of context (entire codebases, documentation sets)
- **Multi-file Analysis**: Understanding relationships and patterns across many files

## ⚠️ Critical: Background/Non-Interactive Mode Warning

**NEVER use `--approval-mode default` in background or non-interactive shells** (like Claude Code tool calls). It will hang indefinitely waiting for approval prompts that cannot be provided.

**For automated/background reviews:**
- ✅ Use `--approval-mode yolo` for fully automated execution
- ✅ OR wrap with timeout: `timeout 300 gemini ...`
- ❌ NEVER use `--approval-mode default` without interactive terminal

**Symptoms of hung Gemini:**
- Process running 20+ minutes with 0% CPU usage
- No network activity
- Process state shows 'S' (sleeping)

**Fix hung process:**
```bash
# Check if hung
ps aux | grep gemini | grep -v grep

# Kill if necessary
pkill -9 -f "gemini.*gemini-3-pro-preview"
```

## Running a Task

1. Ask the user (via `AskUserQuestion`) which model to use in a **single prompt**. Available models:
   - `gemini-3-pro-preview` ⭐ (flagship model, best for coding & complex reasoning, 35% better at software engineering than 2.5 Pro)
   - `gemini-3-flash` (sub-second latency, distilled from 3 Pro, best for speed-critical tasks)
   - `gemini-2.5-pro` (legacy option, strong all-around performance)
   - `gemini-2.5-flash` (legacy option, cost-efficient with thinking capabilities)
   - `gemini-2.5-flash-lite` (legacy option, fastest processing)

2. Select the approval mode based on the task:
   - `default`: Prompt for approval (⚠️ ONLY for interactive terminal sessions)
   - `auto_edit`: Auto-approve edit tools only (for code reviews with suggestions)
   - `yolo`: Auto-approve all tools (✅ REQUIRED for background/automated tasks)

3. Assemble the command with appropriate options:
   - `-m, --model <MODEL>` - Model selection
   - `--approval-mode <default|auto_edit|yolo>` - Control tool approval
   - `-y, --yolo` - Alternative to `--approval-mode yolo`
   - `-i, --prompt-interactive "prompt"` - Execute prompt and continue interactively
   - `--include-directories <DIR>` - Additional directories to include in workspace
   - `-s, --sandbox` - Run in sandbox mode for isolation

4. **For background/automated tasks, ALWAYS use `--approval-mode yolo`** or add timeout wrapper. NEVER use `default` in non-interactive shells.

5. Run the command and capture the output. For background/automated mode:
   ```bash
   # Recommended: Use yolo for background tasks
   gemini -m gemini-3-pro-preview --approval-mode yolo "Review this codebase for security issues"

   # Or with timeout (5 min limit)
   timeout 300 gemini -m gemini-3-pro-preview --approval-mode yolo "Review this codebase"
   ```

6. For interactive sessions with an initial prompt:
   ```bash
   gemini -m gemini-3-pro-preview -i "Review the authentication system" --approval-mode auto_edit
   ```

7. **After Gemini completes**, inform the user: "The Gemini analysis is complete. You can start a new Gemini session for follow-up analysis or continue exploring the findings."

### Quick Reference

| Use case | Approval mode | Key flags |
| --- | --- | --- |
| Background code review | `yolo` ✅ | `-m gemini-3-pro-preview --approval-mode yolo` |
| Background analysis | `yolo` ✅ | `-m gemini-3-pro-preview --approval-mode yolo` |
| Background with timeout | `yolo` ✅ | `timeout 300 gemini -m gemini-3-pro-preview --approval-mode yolo` |
| Interactive code review | `default` | `-m gemini-3-pro-preview --approval-mode default` (interactive terminal only) |
| Code review with auto-edits | `auto_edit` | `-m gemini-3-pro-preview --approval-mode auto_edit` |
| Automated refactoring | `yolo` | `-m gemini-3-pro-preview --approval-mode yolo` |
| Speed-critical background | `yolo` ✅ | `-m gemini-3-flash --approval-mode yolo` |
| Cost-optimized background | `yolo` ✅ | `-m gemini-2.5-flash --approval-mode yolo` |
| Multi-directory analysis | `yolo` (if background) | `--include-directories <DIR1> --include-directories <DIR2>` |
| Interactive with prompt | `auto_edit` or `default` | `-i "prompt" --approval-mode <mode>` |

### Model Selection Guide

| Model | Best for | Context window | Key features |
| --- | --- | --- | --- |
| `gemini-3-pro-preview` ⭐ | **Flagship model**: Complex reasoning, coding, agentic tasks | 1M input / 64k output | Vibe coding, 76.2% SWE-bench, $2-4/M input |
| `gemini-3-flash` | Sub-second latency, speed-critical applications | 1M input / 64k output | Distilled from 3 Pro, TPU-optimized |
| `gemini-2.5-pro` | Legacy: Strong all-around performance | 1M input / 65k output | Thinking mode, mature stability |
| `gemini-2.5-flash` | Legacy: Cost-efficient, high-volume tasks | 1M input / 65k output | Best price ($0.15/M), thinking mode |
| `gemini-2.5-flash-lite` | Legacy: Fastest processing, high throughput | 1M input / 65k output | Maximum speed, minimal latency |

**Gemini 3 Advantages**: 35% higher accuracy in software engineering, state-of-the-art on SWE-bench (76.2%), GPQA Diamond (91.9%), and WebDev Arena (1487 Elo). Knowledge cutoff: January 2025.

**Coming Soon**: `gemini-3-deep-think` for ultra-complex reasoning with enhanced thinking capabilities.

## Common Use Cases

### Code Review (Background/Automated)
```bash
# For background execution (Claude Code, CI/CD, etc.)
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Perform a comprehensive code review focusing on:
   1. Security vulnerabilities
   2. Performance issues
   3. Code quality and maintainability
   4. Best practices violations"

# With timeout safety (5 minutes)
timeout 300 gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Perform a comprehensive code review..."
```

### Plan Review (Background/Automated)
```bash
# For background execution
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Review this architectural plan for:
   1. Scalability concerns
   2. Missing components
   3. Integration challenges
   4. Alternative approaches"
```

### Big Context Analysis (Background/Automated)
```bash
# For background execution
gemini -m gemini-3-pro-preview --approval-mode yolo \
  "Analyze the entire codebase to understand:
   1. Overall architecture
   2. Key patterns and conventions
   3. Potential technical debt
   4. Refactoring opportunities"
```

### Interactive Code Review (Terminal Only)
```bash
# ONLY use default mode in interactive terminal
gemini -m gemini-3-pro-preview --approval-mode default \
  "Review the authentication flow for security issues"
```

## Following Up

- Gemini CLI sessions are typically one-shot or interactive. Unlike Codex, there's no built-in resume functionality.
- For follow-up analysis, start a new Gemini session with context from previous findings.
- When proposing follow-up actions, restate the chosen model and approval mode.
- Use `AskUserQuestion` after each Gemini command to confirm next steps or gather clarifications.

## Error Handling

- Stop and report failures whenever `gemini --version` or a Gemini command exits non-zero.
- Request direction before retrying failed commands.
- Before using high-impact flags (`--approval-mode yolo`, `-y`, `--sandbox`), ask the user for permission using `AskUserQuestion` unless already granted.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.

## Troubleshooting Hung Gemini Processes

### Detection
```bash
# Check for hung processes
ps aux | grep -E "gemini.*gemini-3" | grep -v grep

# Look for these symptoms:
# - Process running 20+ minutes
# - CPU usage at 0%
# - Process state 'S' (sleeping)
# - No network connections
```

### Diagnosis
```bash
# Get detailed process info
ps -o pid,etime,pcpu,stat,command -p <PID>

# Check network activity
lsof -p <PID> 2>/dev/null | grep -E "(TCP|ESTABLISHED)" | wc -l
# If result is 0, process is hung
```

### Resolution
```bash
# Kill hung Gemini processes
pkill -9 -f "gemini.*gemini-3-pro-preview"

# Or kill specific PID
kill -9 <PID>

# Verify cleanup
ps aux | grep gemini | grep -v grep
```

### Prevention
- **ALWAYS use `--approval-mode yolo` for background/automated tasks**
- Add timeout wrapper for safety: `timeout 300 gemini ...`
- Never use `--approval-mode default` in non-interactive shells
- Monitor first run with `ps` to ensure process completes

## Tips for Large Context Processing

1. **Be specific**: Provide clear, structured prompts for what to analyze
2. **Use include-directories**: Explicitly specify all relevant directories
3. **Choose the right model**:
   - Use `gemini-3-pro-preview` for complex reasoning, coding tasks, and maximum analysis quality (recommended default)
   - Use `gemini-3-flash` for speed-critical tasks requiring sub-second response times
   - Use `gemini-2.5-flash` for cost-optimized high-volume processing
4. **Leverage Gemini 3's strengths**: 35% better at software engineering tasks, exceptional at agentic workflows and vibe coding
5. **Break down complex tasks**: Even with large context, structured analysis is more effective
6. **Save findings**: Ask Gemini to output structured reports that can be saved for reference

## CLI Version

Requires Gemini CLI v0.16.0 or later for Gemini 3 model support. Check version: `gemini --version`
