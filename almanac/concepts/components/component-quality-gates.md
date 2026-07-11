---
title: "Component Quality Gates"
summary: "Component quality gates are the review, naming, security, and scanning checks that must pass before catalog assets are trusted."
topics: [concepts, components, validation, security]
sources:
  - id: claude-quality-rules
    type: file
    path: CLAUDE.md
  - id: component-reviewer-agent
    type: file
    path: .claude/agents/component-reviewer.md
  - id: skillspector-scan
    type: file
    path: scripts/skillspector_scan.py
  - id: owasp-security-skill
    type: file
    path: .claude-plugin/skills/owasp-security/SKILL.md
---

# Component Quality Gates

Component quality gates are the checks this repository expects before a component change is merged into the catalog. They combine contributor workflow rules, the `component-reviewer` agent, security requirements, and SkillSpector scans for skills [@claude-quality-rules] [@component-reviewer-agent] [@skillspector-scan]. These gates matter because component files are later downloaded into user Claude Code environments, so weak metadata, bad paths, broken references, or embedded secrets can become user-facing install problems.

## Required Review

The repository guidance says component changes must be reviewed with the `component-reviewer` subagent before committing [@claude-quality-rules]. The same guidance gives the expected creation flow: create the component file under `cli-tool/components/{type}/{category}/{name}`, use descriptive kebab-case names, include clear descriptions and examples, run the reviewer, fix issues, and regenerate the catalog with `python scripts/generate_components_json.py` [@claude-quality-rules].

The reviewer is configured for all component directories: agents, commands, MCPs, hooks, settings, skills, and loops [@component-reviewer-agent]. Its output model separates approved results, warnings, and critical issues, so contributors can distinguish blocking problems from improvements [@component-reviewer-agent].

## Type-Specific Contracts

The review rules are different for each component type. Agents need Markdown frontmatter with fields such as `name`, `description`, `tools`, and `model` [@component-reviewer-agent]. Commands need Markdown frontmatter for allowed tools, argument hints, and descriptions [@component-reviewer-agent]. Hooks and settings are JSON files with descriptions and valid Claude Code configuration shapes [@component-reviewer-agent]. MCPs need an `mcpServers` object with server descriptions, commands, and args [@component-reviewer-agent]. Skills must be directories containing `SKILL.md`, and loops must include a loop-oriented frontmatter contract with fields such as `interval`, `stop-condition`, and component references [@component-reviewer-agent].

The reviewer also enforces naming and path conventions across all types. File and directory names should be kebab-case, component frontmatter names should match filenames where applicable, and absolute user paths are rejected in favor of relative paths or `$CLAUDE_PROJECT_DIR` references [@component-reviewer-agent].

## Security Gates

Hardcoded secrets are critical failures. The repository-wide security guidance forbids API keys, tokens, passwords, project IDs, org IDs, infrastructure identifiers, and database connection strings in code, and requires environment variables or Cloudflare secrets instead [@claude-quality-rules]. The component reviewer repeats that rule for components and lists patterns such as API keys, tokens, passwords, private keys, and credentialed database URLs as rejection triggers [@component-reviewer-agent].

The repository also ships an OWASP security skill as a reusable security reference. It covers web application, ASVS, mobile, API, Kubernetes, and agentic application security guidance, including checks for hardcoded secrets, broken access control, injection, and prompt-injection risk [@owasp-security-skill]. That skill is not the component schema validator, but it documents the security vocabulary contributors can use when reviewing risky components.

## SkillSpector Gate

Skills have an additional security scan. The repository guidance says skills under `cli-tool/components/skills/**` are scanned with NVIDIA SkillSpector in static-only mode and that the PR workflow blocks when changed skills score HIGH or CRITICAL, meaning risk score greater than 50 [@claude-quality-rules]. The batch orchestrator discovers skill directories by looking for `SKILL.md`, runs `skillspector scan <dir> --no-llm --format json`, aggregates SARIF output, and reports counts for scanned skills, HIGH/CRITICAL findings, medium findings, low or clean results, and scan errors [@skillspector-scan].

This makes skill quality a two-layer gate: the component reviewer checks repository structure and component conventions, while SkillSpector checks the skill content for security risk [@component-reviewer-agent] [@skillspector-scan].

## Relation To The Component System

The [Component System](component-system) works only if catalog items stay installable and understandable. Quality gates protect that shared contract. They keep metadata usable for the catalog, keep install paths predictable, and prevent security-sensitive files from entering the component library [@claude-quality-rules] [@component-reviewer-agent].
