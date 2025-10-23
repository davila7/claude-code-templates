---
title: Frontend Developer Agent
category: Development Team
duration: 5 min
---

# Frontend Developer Agent

## What is this agent?

The **Frontend Developer Agent** is a specialized AI assistant that helps you build React applications. Think of it as having an expert React developer on your team.

**What it does:**

- Builds **React components** with TypeScript
- Creates **responsive designs** for all devices
- Manages **app state** (Redux, Zustand, Context)
- Optimizes **performance** (lazy loading, code splitting)
- Ensures **accessibility** (WCAG, ARIA labels)

**How it works:**

When you ask Claude for frontend help, it automatically delegates the task to this specialized agent. The agent works in its own context and returns the complete solution.

## Installation

One command installs it:

```bash
npx claude-code-templates@latest --agent frontend-developer --yes
```

This creates `.claude/agents/frontend-developer.md` in your project.

## How subagents work

**Subagents** are specialized AI assistants. Each one:

- Has **its own context** (keeps main conversation clean)
- Uses **specific tools** (Read, Write, Edit, Bash)
- Follows **custom instructions** for its specialty
- Returns **complete solutions** to Claude

**Key benefit:** Your main chat stays focused while the specialist handles technical details.

## Using the agent

### Automatic (recommended)

Just ask naturally:

Create a Button with primary and secondary styles

Build a navigation bar with logo and menu

Add authentication flow to my app

**Claude automatically:**
1. Sees it's a frontend task
2. Calls the frontend-developer agent
3. Agent builds the solution
4. Returns complete code

### Explicit

You can also request it directly:

Use frontend-developer to create a Card component

Ask the frontend-developer agent to optimize this code

## What you get

When the agent creates a component, you receive:

**Complete React code:**
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant, children }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`}>
      {children}
    </button>
  );
}
```

Plus:
- **Styling** (Tailwind or CSS-in-JS)
- **State management** (if needed)
- **Accessibility** (ARIA labels, keyboard nav)
- **Performance tips** (memoization, lazy loading)
- **Usage example** in comments

## Agent configuration

The agent's configuration file looks like this:

```markdown
---
name: frontend-developer
description: Use PROACTIVELY for UI components, state management,
             performance, accessibility, and frontend architecture
tools: Read, Write, Edit, Bash
model: sonnet
---

You are a frontend developer specializing in modern React...
```

**What each part means:**

- `name`: How you reference it
- `description`: When Claude should use it ("PROACTIVELY" = automatic)
- `tools`: Which Claude Code tools it can use
- `model`: AI model powering it (sonnet/opus/haiku)

## Managing agents

### View all agents

```bash
/agents
```

Shows:
- Built-in agents
- Your custom agents
- Plugin agents

### Edit the agent

**Option 1:** Use the `/agents` command, select "Edit"

**Option 2:** Edit the file directly:
```bash
.claude/agents/frontend-developer.md
```

**Customize it** to match your preferences! For example, force Tailwind CSS:

```markdown
---
name: frontend-developer
...
---

You are a frontend developer...

IMPORTANT: Always use Tailwind CSS. Never use CSS-in-JS.
```

## Quiz

?> Where is the agent file stored?
- [ ] `node_modules/` folder
- [x] `.claude/agents/` folder
- [ ] `~/.config/` folder
- [ ] System directory

?> What does "PROACTIVELY" mean?
- [ ] Agent asks permission first
- [x] Claude uses it automatically
- [ ] Only works on request
- [ ] Requires special flag

?> Which tools can the agent use?
- [ ] Only Read
- [ ] All tools
- [x] Read, Write, Edit, Bash
- [ ] No tools

## Best practices

**Be specific in requests**

✅ Good: "Create Button with loading state, sizes sm/md/lg, disabled state"

❌ Vague: "make a button"

**Start default, then customize**

1. Install default agent
2. Use it a few times
3. Note what you'd change
4. Edit the agent file

**Use with other agents**

Chain agents for complete workflows:

Use frontend-developer to create the component, then code-reviewer to check it

## Advanced: Custom tools

Control which tools the agent can access:

```markdown
---
tools: Read, Edit  # Only these two
---
```

Or give all tools:

```markdown
---
# Omit tools field = inherits all tools
---
```

**Why limit tools?**
- Security: prevent unwanted changes
- Focus: keep agent in its expertise
- Control: you decide what it modifies

## Summary

**What you learned:**

✅ What subagents are (specialized AI assistants)
✅ How to install frontend-developer
✅ How Claude delegates automatically
✅ How to customize the agent
✅ Best practices for prompts

**Next steps:**

1. Install: `npx claude-code-templates@latest --agent frontend-developer --yes`
2. Ask Claude: "Create a Card component"
3. Watch it work!
4. Customize to your needs

**Explore more:**
- 600+ agents at **aitmpl.com**
- Backend, DevOps, testing agents
- Create custom agents with `/agents`

Happy coding! 🚀
