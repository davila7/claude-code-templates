# Install Claude Code Templates

Install components from this repository to the user's global `~/.claude/` directory.

## Instructions

The user wants to install Claude Code templates. Follow these steps:

### Step 1: Determine what to install

If the user specified a component type in their message (e.g., "install SDD", "install agents for DevOps"), use that.
Otherwise, present this menu:

```
Available component types:

  sdd        — Spec-Driven Development workflow (commands + agents + skill)
  agents     — AI specialist agents (28 categories: devops, security, data-ai, etc.)
  commands   — Slash commands (26 categories: git-workflow, testing, deployment, etc.)
  hooks      — Pre/post tool execution hooks (automation, quality gates, security)
  skills     — Reusable skill packs
  settings   — Claude environment configuration (statuslines, permissions, etc.)
  all        — Everything above

Which components do you want to install?
```

Wait for user response before proceeding.

### Step 2: Confirm target directory

Always install to `~/.claude/` (user scope), never to the current project's `.claude/`.
Inform the user: "Installing to ~/.claude/ — these will be available across all your projects."

### Step 3: Execute installation

Run the appropriate install.sh command from the repo root:

```bash
# SDD only
bash install.sh --sdd

# Specific category
bash install.sh --agents
bash install.sh --commands
bash install.sh --hooks

# Everything
bash install.sh --all

# Preview available components
bash install.sh --list
```

If the user wants a specific subcategory (e.g., only devops agents, only git commands):
```bash
# Copy specific subcategory manually
cp -r cli-tool/components/agents/devops-infrastructure ~/.claude/agents/
cp -r cli-tool/components/commands/git-workflow ~/.claude/commands/
```

### Step 4: Inform Claude about installed components

After installing, tell the user:

```
✅ Installation complete!

Installed: [list what was installed]
Location:  ~/.claude/

Restart Claude Code for new commands/agents to take effect.

What's now available:
```

Then describe the installed components using the catalog below.

---

## Component Catalog

### Agents (28 categories)

| Category | Highlights |
|----------|-----------|
| `expert-advisors` | Principal engineers, orchestrators, debug specialists, mentors |
| `programming-languages` | Go, Python, Rust, Java, C#, Kotlin, Swift, PHP and more |
| `data-ai` | AI engineer, ML engineer, prompt engineer, NLP specialist |
| `devops-infrastructure` | Kubernetes, CI/CD, cloud architects, SRE |
| `security` | Security auditor, penetration tester, compliance specialist |
| `database` | DB architect, Postgres/Neon/NoSQL/SQL Server experts |
| `development-team` | Team lead, code reviewer, refactoring specialist |
| `documentation` | Technical writer, API documenter, diagram architect |
| `deep-research-team` | Research orchestration, literature review, scientific analysis |
| `web-tools` | Web scraper, SEO specialist, API builder |
| `business-marketing` | Product manager, marketer, growth expert |
| `api-graphql` | GraphQL architect, API designer, schema builder |
| `mcp-dev-team` | MCP framework developers |
| `blockchain-web3` | Smart contracts, Web3 architect |
| `game-development` | Unity/Godot experts, game architect |
| `performance-testing` | Load testing, performance profiler |
| `workflow-methodology` | SDD orchestrator |

### Commands (26 categories)

| Category | Highlights |
|----------|-----------|
| `sdd` | Full SDD workflow: init, specify, clarify, plan, analyze, tasks, implement |
| `git-workflow` | PR management, branching strategies, release automation |
| `testing` | Test generation, coverage reports, automation |
| `deployment` | Docker, CI/CD, environment management |
| `documentation` | Auto-doc generation, API docs, guides |
| `project-management` | Task planning, roadmaps, sprint management |
| `security` | Security checks, audit, compliance |
| `database` | Migrations, schema management, optimization |
| `performance` | Profiling, optimization workflows |
| `orchestration` | Multi-agent workflows |
| `setup` | Project scaffolding, environment configuration |
| `svelte` | Svelte component creation, Storybook migration |
| `nextjs-vercel` | Next.js development, Vercel deployment |
| `google-workspace` | Google Docs/Sheets/Slides automation |

### Hooks

| Category | Purpose |
|----------|---------|
| `automation` | Workflow automation on tool events |
| `quality-gates` | Enforce code quality before/after changes |
| `security` | Scan for secrets, dangerous commands |
| `git` | Git operation hooks |
| `testing` | Auto-run tests on file changes |
| `monitoring` | Health and performance monitoring |

### Skills

| Skill | Purpose |
|-------|---------|
| `sdd` | Spec-Driven Development methodology |
| `design-to-code` | Convert designs/mockups to code |

### Settings

| Category | Purpose |
|----------|---------|
| `statusline` | Custom Claude status dashboards (Vercel monitors, Git status, game dashboards) |
| `permissions` | Granular tool permission configs |
| `environment` | Environment variable management |
| `mcp` | MCP server configurations |
