# Component checklist

## Format
- [ ] Markdown components start with YAML frontmatter that parses.
- [ ] `name` is kebab-case and matches the file or folder name.
- [ ] `description` says what it does and when to use it, in one or two sentences.
- [ ] JSON components parse, with no trailing commas or comments.

## Security
- [ ] No API keys, tokens, passwords, account or project ids. Secrets come from environment variables or placeholders such as `<api-key>`.
- [ ] No absolute paths or home directories (`/Users/...`, `C:\...`, `~/...`). Paths are relative to the project.
- [ ] Every command a hook, MCP server or script runs is listed and does only what the description says.
- [ ] Packages an MCP server starts with `npx`, `uvx` or `pipx run` are pinned to an exact version.
- [ ] No shell built from user input (string interpolation into `bash -c`, `eval`, backticks).
- [ ] No text that tells the model to ignore instructions, hide actions or send data elsewhere.

## Quality
- [ ] Instructions are specific steps, not general advice.
- [ ] Tools are limited to what the task needs (`tools:` / `allowed-tools:`).
- [ ] Supporting files the component mentions exist.
