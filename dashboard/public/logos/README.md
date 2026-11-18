# Logos

Marks shown next to third-party tools on the component page. Each one names the
tool it stands for; the trademarks belong to their owners and no endorsement is
implied.

| File | Mark | Source |
| --- | --- | --- |
| `nvidia.svg` | NVIDIA eye | [simple-icons](https://github.com/simple-icons/simple-icons) 16.38.0 (CC0-1.0), official green `#76B900`. NVIDIA's guidelines forbid recoloring it: never add the `oss-icon` class. |
| `agents/claude-code.svg` | Claude Code | [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons) `@lobehub/icons-static-svg` 1.104.0 (MIT), color |
| `agents/codex.svg` | Codex | lobe-icons, monochrome |
| `agents/copilot-cli.svg` | GitHub Copilot | lobe-icons, monochrome |
| `agents/opencode.svg` | OpenCode | lobe-icons, monochrome |
| `agents/hermes.svg` | Hermes Agent (Nous Research) | lobe-icons, monochrome |
| `agents/openclaw.svg` | OpenClaw | lobe-icons, color |

The monochrome files are white and use the `oss-icon` class, which inverts them
in light mode. `dashboard/src/lib/component-page.ts` (`HARNESS_AGENT_LOGOS`)
says which is which.
