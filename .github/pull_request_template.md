## What this PR does

<!-- One or two sentences. Link the issue it closes, if any (Closes #123). -->

## Type

- [ ] New component
- [ ] Change to an existing component
- [ ] CLI (`cli-tool/src`, `cli-tool/bin`)
- [ ] Website (`dashboard/`)
- [ ] Docs or other

## Checklist for components

- [ ] Files are under `cli-tool/components/{type}/{category}/` with a kebab-case name
- [ ] Frontmatter has `name` and a specific `description` (for skills, `name` matches the folder)
- [ ] No API keys, tokens or absolute paths; secrets are read from environment variables
- [ ] If it runs code (hook script, MCP, mod), the README or description says what it runs and what it accesses
- [ ] I did **not** commit `docs/components.json` or `dashboard/public/` (they are regenerated after merge)

## How I tested it

<!-- The command you ran, e.g. npx claude-code-templates@latest --skill category/name --dry-run, and what you saw. -->
