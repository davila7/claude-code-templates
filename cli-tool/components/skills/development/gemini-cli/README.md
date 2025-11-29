# Gemini CLI Skill for Claude Code

A Claude Code skill that enables effective use of Google's Gemini CLI as a powerful auxiliary tool.

## What This Skill Does

This skill teaches Claude Code how to wield Gemini CLI for:

- **Code Generation** - Create apps, components, and modules
- **Code Review** - Security audits, bug detection, improvements
- **Test Generation** - Unit tests, integration tests
- **Documentation** - JSDoc, README, API docs
- **Web Research** - Current information via Google Search
- **Architecture Analysis** - Codebase investigation and mapping

## Installation

Copy the skill directory to your Claude Code skills folder:

```bash
# Clone the repo
git clone https://github.com/forayconsulting/gemini_cli_skill.git

# Copy to Claude Code skills directory
cp -r gemini_cli_skill ~/.claude/skills/gemini-cli
```

Or manually create `~/.claude/skills/gemini-cli/` and copy the files.

## Prerequisites

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
- Gemini API key or OAuth authentication configured

```bash
# Install Gemini CLI
npm install -g @google/gemini-cli

# Authenticate
gemini  # First run prompts for auth
```

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Main skill definition - when to use, core instructions |
| `reference.md` | Complete CLI command and flag reference |
| `templates.md` | Reusable prompt templates for common tasks |
| `patterns.md` | Integration patterns and workflows |
| `tools.md` | Gemini's built-in tools documentation |

## Usage

Once installed, Claude Code automatically uses this skill when appropriate. Just ask:

```
"Use Gemini to review this code for security issues"
"Have Gemini generate tests for this module"
"Ask Gemini what's new in TypeScript 5.5"
"Get Gemini to analyze this codebase architecture"
```

## Key Features

### Prompt Templates

Ready-to-use templates for:
- Code generation (single-file, multi-file, components)
- Code review (comprehensive, security, performance)
- Test generation (unit, integration)
- Documentation (JSDoc, README, API)

### Integration Patterns

- **Generate-Review-Fix** - Quality assurance cycle
- **Background Execution** - Parallel task processing
- **Model Selection** - Pro vs Flash decision tree
- **Rate Limit Handling** - Strategies for free tier limits

### Gemini's Unique Tools

- `google_web_search` - Real-time internet search
- `codebase_investigator` - Deep architecture analysis
- `save_memory` - Cross-session persistence

## Quick Reference

```bash
# Basic generation
gemini "Create [description]" --yolo -o text

# Code review
gemini "Review [file] for bugs and security issues" -o text

# Web research
gemini "What's new in [topic]? Use Google Search." -o text

# Architecture analysis
gemini "Use codebase_investigator to analyze this project" -o text

# Faster model for simple tasks
gemini "[prompt]" -m gemini-2.5-flash -o text
```

## Why Use Gemini from Claude Code?

| Use Case | Benefit |
|----------|---------|
| Second opinion | Different AI perspective on code |
| Current info | Google Search grounding |
| Architecture | codebase_investigator tool |
| Parallel work | Offload tasks while continuing |

## License

MIT
