# Language-Specific Coding Rules

Drop-in rules for `.claude/rules/` that enforce language-specific conventions.
Each file uses YAML frontmatter with glob patterns so Claude Code automatically
applies the rules to matching files.

## Installation

Copy the rules you need into `.claude/rules/` in your project:

```bash
mkdir -p .claude/rules
cp python.md typescript.md react.md .claude/rules/
```

Claude Code will automatically apply matching rules based on the `globs` patterns in each file's frontmatter.

## Available Rules

| File | Globs | Key Conventions |
|------|-------|-----------------|
| `python.md` | `**/*.py` | PEP 8, type hints on all signatures, f-strings, pathlib, dataclasses |
| `typescript.md` | `**/*.ts`, `**/*.tsx` | Strict mode, no `any`, unions over enums, const-first |
| `react.md` | `**/*.tsx`, `**/*.jsx` | Functional components, custom hooks, named exports, accessibility |
| `go.md` | `**/*.go` | Immediate error checks, context as first param, table-driven tests |
| `rails.md` | `**/*.rb`, `**/*.erb` | Fat models/thin controllers, strong params, scopes, service objects |
| `rust.md` | `**/*.rs` | Result over panic, `?` operator, borrows, minimize unsafe |
| `sql.md` | `**/*.sql`, `**/migrations/**` | snake_case, BIGINT IDs, reversible migrations, index FKs |
| `testing.md` | `**/*test*`, `**/*spec*` | Arrange-Act-Assert, one concept per test, no sleep/timeouts |

## Customization

Each rule file is self-contained markdown. Edit directly to match your team's conventions.

Source: https://github.com/CodeWithBehnam/cc-docs
