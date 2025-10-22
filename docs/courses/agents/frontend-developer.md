<!--
author: Claude Code Templates
email: support@aitmpl.com
version: 1.0.0
language: en
narrator: US English Female
mode: Textbook
dark: true

comment: Learn how to use the Frontend Developer agent for React development

logo: https://aitmpl.com/static/favicon/android-chrome-512x512.png

@style
.lia-slide {
    padding: 2rem;
}

/* Force dark theme with coral accent */
:root {
    --color-background: #0d1117;
    --color-text: #e2e8f0;
    --color-highlight: #d57455;
}

body {
    background-color: #0d1117 !important;
}

.lia-slide,
.lia-content,
main {
    background-color: #0d1117 !important;
}

/* 1. Hide main navbar */
header.lia-toolbar,
.lia-toolbar-main,
nav.lia-toolbar,
.lia-toolbar {
    display: none !important;
}

/* 2. Customize sidebar with coral color */
aside.lia-toc,
.lia-toc,
.lia-toc-container {
    background-color: #d57455 !important;
}

/* Sidebar text colors */
.lia-toc a,
.lia-toc-container a,
.lia-toc li,
.lia-toc span {
    color: #ffffff !important;
}

.lia-toc a:hover {
    color: #0d1117 !important;
    background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Style active link */
.lia-toc .lia-active {
    background-color: rgba(15, 23, 42, 0.3) !important;
    border-left: 4px solid #0d1117 !important;
}

/* 3. Hide search in sidebar */
.lia-toc .lia-input,
.lia-toc input[type="search"],
.lia-toc .lia-search,
.lia-toc-search,
.lia-toc [type="search"] {
    display: none !important;
}

/* Hide Home button */
.lia-toc .lia-btn-home,
.lia-toc a[href="#1"],
.lia-toc-home {
    display: none !important;
}
@end

-->

# Frontend Developer Agent

> 🎨 Your AI partner for modern React development

## What is this agent?

The **Frontend Developer Agent** specializes in:

* React components with TypeScript
* Responsive design (mobile-first)
* Accessibility (WCAG 2.1)
* Performance optimization
* Modern CSS (Tailwind)

---

## Installation

Install the agent in your project:

```bash
npx claude-code-templates@latest --agent frontend-developer --yes
```

This installs the agent to `.claude/agents/frontend-developer.md`

---

## How to use it

### 1. Start Claude Code in your project

```bash
claude
```

### 2. The agent is automatically available

Claude Code will use the agent's expertise when you ask for frontend help.

### 3. Example prompts

**Good prompts are specific:**

```
Create a Button component with:
- Variants: primary, secondary, outline
- Sizes: sm, md, lg
- Loading state with spinner
- TypeScript + Tailwind CSS
- Full accessibility (ARIA)
```

**Simple prompts work too:**

```
Create a responsive Card component
```

```
Add dark mode to my app
```

---

## Quick Quiz

**Question 1: Where is the agent installed?**

[( )] `node_modules/`
[(X)] `.claude/agents/`
[( )] `~/.config/claude/`
[( )] `/usr/local/`

**Question 2: What makes a good prompt?**

[( )] "make a button"
[( )] "help me"
[(X)] "Create a Button with primary/secondary variants, sizes sm/md/lg, using TypeScript"
[( )] "do the thing"

**Question 3: What does the agent specialize in?**

[[X]] React components
[[ ]] Backend APIs
[[X]] Accessibility
[[X]] Responsive design
[[ ]] Database design
[[X]] TypeScript

---

## Example: Create a Card Component

Try asking the agent:

<div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea;">

**Prompt:**

```
Create a Card component with:
- Header, body, footer sections
- Image support with lazy loading
- Hover effects
- Responsive padding
- TypeScript + Tailwind
```

</div>

**What you'll get:**

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("card", className)}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children }: Props) {
  return <div className="card-header">{children}</div>;
};

Card.Body = function CardBody({ children }: Props) {
  return <div className="card-body">{children}</div>;
};

Card.Footer = function CardFooter({ children }: Props) {
  return <div className="card-footer">{children}</div>;
};
```

---

## Best Practices

### ✅ Do This

* Be specific about requirements
* Mention tech stack (TypeScript, Tailwind)
* Ask for accessibility features
* Request responsive design

### ❌ Avoid This

* Vague requests ("make it nice")
* No context ("create component")
* Missing requirements

---

## Next Steps

**Ready to build?**

1. Install the agent: `npx claude-code-templates@latest --agent frontend-developer --yes`
2. Start Claude Code: `claude-code`
3. Ask the agent to create components!

**More Resources:**

* [📖 Documentation](https://docs.aitmpl.com)
* [💬 Discord](https://discord.gg/dyTTwzBhwY)
* [🌐 More Agents](https://aitmpl.com/agents)

---

## 🎓 Congratulations!

You now know how to use the Frontend Developer Agent.

**What you learned:**

* ✅ How to install the agent
* ✅ How to write effective prompts
* ✅ What the agent specializes in
* ✅ Best practices for usage

**Happy coding! 🚀**
