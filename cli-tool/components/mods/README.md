# Mods

Claude Mods are Claude Code plugins whose behaviour lives in a function-hooks
module: one `register(on, options)` entry that hooks the engine's events as
functions `($, e, next)`. Reference: https://github.com/anthropics/claude-code/tree/main/mods

**Early access.** Mods load in Claude Code >= 2.1.259 with
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases.

## Layout in this repo

Each mod is a complete plugin directory, exactly Anthropic's `mods/` layout:

```
{category}/{name}/
  .claude-plugin/plugin.json   name, version, description, author, license, userConfig, types
  hooks/hooks.json             { "description", "modules": ["./register.ts"] }
  hooks/**                     the hooks-modules: any number of .ts/.tsx files, relative imports
  types/*.d.ts                 optional: the contract of a noun the mod adds to $
  tests/**                     optional: claude plugin test (or the mod's own runner)
  README.md                    what the site shows; everything else is browsable beside it
```

`npx claude-code-templates --mod {category}/{name}` downloads the directory
and writes it verbatim to `.claude/skills/{name}/`, which Claude Code
auto-loads as `{name}@skills-dir`. Third-party mods (e.g. `games/cc-arcade`)
are vendored as-is with their LICENSE and attribution in `plugin.json`.

## Options

A mod's options are declared as `userConfig` in `.claude-plugin/plugin.json`
(the engine reads options only from the manifest). Field types are `string | number | boolean | directory | file`
(`title` is required; `options` makes a picker; `sensitive` goes to secure
storage). There is no array type, so list options take a comma-separated
string. Values are read from **user** settings (`~/.claude/settings.json`),
`--settings <file>` or managed settings, never from project settings:

```json
{ "pluginConfigs": { "npm-to-pnpm-rewriter": { "options": { "manager": "yarn" } } } }
```

`types/claude-code.d.ts` is Anthropic's declaration file as `/plugin-types`
writes it (the first line names the Claude Code version). Regenerate it from a
current Claude Code rather than editing it.

## Typecheck

```bash
cd cli-tool/components/mods && npx -y typescript@5 tsc -p tsconfig.json
```

The root `tsconfig.json` covers every mod's `hooks/` and `types/` (`strict`,
without `noUncheckedIndexedAccess`, so third-party code typechecks). Every module must import its types from `'claude-code'` only, spell `$` as
`$.noun.event(...)` at the call site (never pass `$` to a helper), treat `e`
as frozen, and return `{ deny }` / `{ result }` / `next(e)` as the event's
result type demands. After installing, `claude plugin validate <dir>` lists
what the module hooks and calls; `claude plugin test <dir>` runs its tests.
