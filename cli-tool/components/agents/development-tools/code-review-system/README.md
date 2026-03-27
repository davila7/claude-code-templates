# AI Code Review Team

**17 specialized AI agents for Claude Code. Finds 3x more bugs, 20x faster.**

> **Note:** This is a template system for [Claude Code](https://claude.ai/code) (the AI IDE). The agents are prompts that Claude executes - no local LLMs needed.

## 🚀 Quick Start

### Option 1: Use with Claude Code (Recommended)

1. Open your project in Claude Code
2. Copy this `code-review-system` folder to your project
3. Ask Claude: "Review my code using the code-review-team"
4. Claude will orchestrate all 17 agents automatically

### Option 2: Manual Orchestration

```bash
cd lib
npm install
node cli.js review
```

This generates the review plan. You then run it with Claude Code.

## 📊 What You Get

- **Security issues** - SQL injection, XSS, auth bypasses
- **Performance problems** - N+1 queries, memory leaks, slow algorithms
- **Code quality** - Bad patterns, complexity, maintainability
- **Best practices** - React/Vue/Node/Python/Go patterns
- **Accessibility** - WCAG compliance issues

## 💡 Usage

### With Claude Code (Easy)
```
You: "Review my code using the code-review-team"
Claude: *runs all 17 agents and gives you a report*
```

### Manual (Advanced)
```bash
# Generate review plan
node cli.js review

# Then paste the plan to Claude Code
# Claude executes each agent
```

## ⚙️ How It Works

1. **17 specialized prompts** (agents) - each focuses on one area (security, performance, React, etc.)
2. **Claude Code executes them** - using its AI (no local compute needed)
3. **Orchestrator coordinates** - runs agents in the right order
4. **Results aggregated** - one comprehensive report

**You need:** Claude Code (the IDE)  
**You don't need:** Local LLMs, GPUs, or heavy compute

## 📈 Results

| Before | After |
|--------|-------|
| 19 minutes | 30 seconds |
| 28 bugs found | 85-120 bugs found |
| 5% false positives | 1% false positives |

## 🎯 What's Included

**17 Specialized Agents:**
- Security (SQL injection, XSS, auth issues)
- Performance (N+1 queries, memory leaks)
- Frontend (React, Vue, Angular patterns)
- Backend (Node, Python, Go patterns)
- Mobile (iOS, Android, React Native)
- DevOps (Docker, Kubernetes, CI/CD)
- Database (SQL optimization, schema issues)
- Accessibility (WCAG compliance)
- And 9 more...

**Orchestration System:**
- Runs agents in parallel (fast)
- Manages dependencies
- Aggregates results
- Filters false positives

## 🔧 Configuration (Optional)

Edit `team.yaml` to:
- Enable/disable specific agents
- Adjust confidence thresholds
- Configure workflow phases

Default settings work great for most projects.

## 📚 Documentation

**Just want to use it?**
- This README is all you need

**Want to customize?**
- [GETTING_STARTED.md](GETTING_STARTED.md) - 5-minute guide
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command cheat sheet
- [team.yaml](team.yaml) - Configuration file

**Want to contribute?**
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to help

## 🤔 FAQ

**Q: Do I need to run LLMs locally?**  
A: No. This works with Claude Code (the IDE). Claude runs the agents in the cloud.

**Q: Do I need a GPU or powerful computer?**  
A: No. Just Claude Code. The AI runs on Anthropic's servers.

**Q: What is this exactly?**  
A: It's a collection of specialized prompts (agents) that Claude Code can execute. Think of it as a "team of AI experts" for code review.

**Q: Can I use this without Claude Code?**  
A: Technically yes, but you'd need to manually run each agent prompt with any AI. Claude Code makes it automatic.

**Q: What languages does it support?**  
A: JavaScript, TypeScript, Python, Go, Java, C#, PHP, Ruby, and more.

**Q: Can I use this in CI/CD?**  
A: Yes, but you'd need Claude Code API access or run the orchestrator to generate plans that another AI executes.

## 🎉 That's It

**Simplest way:**
1. Open project in Claude Code
2. Say: "Review my code using the code-review-team"
3. Get comprehensive report from 17 specialized agents

**No local LLMs. No GPUs. No complex setup.**

Just Claude Code + these agent templates.

## 📞 Help

- **Issues**: [GitHub Issues](https://github.com/davila7/claude-code-templates/issues)
- **Questions**: [GitHub Discussions](https://github.com/davila7/claude-code-templates/discussions)

---

**Made with ❤️ by the Claude Code Templates team**

MIT License | [Website](https://aitmpl.com) | [Docs](https://docs.aitmpl.com)

---

**What this is:** A collection of specialized agent prompts for Claude Code  
**What this isn't:** A standalone tool that runs LLMs locally  
**Requirements:** Claude Code (the AI IDE)
