# Permission Presets

Copy-paste permission configurations for `.claude/settings.json` or `~/.claude/settings.json`.

## Available Presets

| Preset | Who It's For | Philosophy |
|--------|-------------|------------|
| Balanced Development | Most teams | Allow common tools, protect secrets, ask for destructive ops |
| Python Development | Python teams | uv, pytest, ruff, mypy auto-allowed |
| Ruby/Rails Development | Rails teams | bundle, rails, rspec, rubocop auto-allowed |
| Go Development | Go teams | go, make auto-allowed |
| Restrictive | New Claude Code users | Read-only by default, ask for everything else |
| Open | Experienced users | Everything allowed except catastrophic operations |

See `development-presets.md` for complete configurations.

Source: https://github.com/CodeWithBehnam/cc-docs
