# CLAUDE.md Starter Templates

Copy-paste starting points for CLAUDE.md files, tailored to specific frameworks.
Each starter includes the main template plus variants for popular alternatives
within the ecosystem.

## Installation

Copy the starter for your stack into your project root as `CLAUDE.md`:

```bash
# From the claude-code-templates/cli-tool/components/settings/claude-md-starters/ directory:
cp python-starter.md /path/to/your-project/CLAUDE.md
```

Then customize the placeholders (`<project-name>`, `<package_name>`, etc.).

## Available Starters

| File | Stack | Variants Included |
|------|-------|-------------------|
| `python-starter.md` | Python (uv, pytest, ruff, mypy) | pip+venv, Poetry, Django, FastAPI |
| `typescript-starter.md` | TypeScript/Node.js (npm, Vitest) | pnpm, Bun, Express API, CLI tool |
| `react-nextjs-starter.md` | React/Next.js (App Router, Tailwind) | Vite+React, shadcn/ui, Tailwind v3 |
| `rails-starter.md` | Ruby on Rails (Minitest, PostgreSQL) | RSpec, API-only |
| `monorepo-starter.md` | Monorepo (Turborepo, pnpm workspaces) | Path-specific rules, CLAUDE.md imports |

## What Each Starter Includes

- Project overview section (name, description, runtime, package manager)
- Quick commands (install, run, test, lint, build)
- Project structure diagram
- Code style conventions specific to the framework
- Testing patterns and commands
- Error handling guidelines
- Dependency management rules
- Framework-specific patterns (e.g., Hotwire for Rails, Server Components for Next.js)

## Tips

- Start with the base template, then append the variant sections you need
- The monorepo starter shows how to use `.claude/rules/` for path-specific rules
- Add your own team conventions in the "Conventions" section at the bottom

Source: https://github.com/CodeWithBehnam/cc-docs
