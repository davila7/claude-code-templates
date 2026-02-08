# Evaluation: mitchellh/vouch for Claude Code Templates

**Repository:** https://github.com/mitchellh/vouch
**Author:** Mitchell Hashimoto (creator of Terraform, Vagrant, Ghostty)
**License:** MIT
**Date:** 2026-02-08

## What is Vouch?

A project trust management system. Maintainers explicitly **vouch** for contributors before they can interact with a project, and can **denounce** bad actors. The trust list is a flat `.td` file (Trustdown format) that can be parsed with standard tools.

Key features:
- Flat-file trust list (`VOUCHED.td`) with simple syntax
- Web of trust across projects (shared vouch/denounce lists)
- GitHub Actions for automated PR gating (check-pr, manage-by-issue, manage-by-discussion)
- CLI for local management (add, check, denounce, remove)
- Used in production by [Ghostty](https://github.com/ghostty-org/ghostty)

## Compatibility Assessment

### Blockers for Direct Migration

| Issue | Severity | Details |
|-------|----------|---------|
| **Nushell dependency** | Critical | The entire CLI and library is written in Nushell (`.nu` files). Claude Code Templates components use Bash, Python, or Node.js. Nushell is not standard in most dev environments. |
| **Not a Claude Code tool** | High | Vouch is a standalone project governance system, not designed to enhance Claude Code workflows. |
| **GitHub Actions focus** | High | Primary integration is through GitHub Actions composite actions, which operate at CI/CD level, not developer CLI level. |
| **Custom file format** | Medium | `.td` (Trustdown) format requires Nushell's `from td`/`to td` commands for structured parsing. |

### What Could Be Adapted

Despite the direct migration being impractical, we could create **inspired components** that help Claude Code users work with vouch-enabled repositories:

| Component Type | Idea | Feasibility |
|----------------|------|-------------|
| **Agent** | Vouch-aware code reviewer that reads `VOUCHED.td` and understands the trust model | High |
| **Command** | `/vouch-check <username>` using `gh` CLI and simple file parsing | High |
| **Hook** | Pre-tool hook that warns when working on PRs from unvouched contributors | Medium |
| **Setting** | Configuration for vouch-enabled repos (env vars, permissions) | Medium |

## Verdict

**Not recommended for direct migration.** The vouch project is well-designed but fundamentally incompatible with Claude Code Templates for these reasons:

1. **Runtime mismatch** - Nushell vs Bash/Python/Node.js ecosystem
2. **Wrong integration layer** - GitHub Actions (CI/CD) vs Claude Code (developer CLI)
3. **Self-contained system** - Vouch works independently; wrapping it adds complexity without clear value over using the GitHub Actions directly

### Alternative Recommendation

If the goal is to bring trust management awareness to Claude Code, we could create **new, original components** inspired by vouch's concepts:

1. A **command** (`/vouch-check`) that parses `VOUCHED.td` using bash/grep (the format is simple enough: one username per line, `-` prefix for denounced)
2. An **agent** that understands the vouch model and helps maintainers manage their trust lists
3. A **hook** that reads `VOUCHED.td` before PR operations and adds context about contributor trust status

These would be original Claude Code Templates components that understand the vouch ecosystem, rather than a port of the Nushell tooling.
