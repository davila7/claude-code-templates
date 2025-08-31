---
sidebar_position: 5
---

# Automation Hooks

Automation hooks in `claude-code-templates` allow you to execute custom actions at key moments during the Claude Code workflow. This enables powerful automation and integration with your existing development processes.

## Types of Hooks

-   **PreToolUse**: These hooks execute before Claude Code uses a tool. They can be used for security checks, logging, or statement detection.
-   **PostToolUse**: These hooks run after Claude Code has used a tool. Common uses include auto-formatting code, performing type checking, or running tests.
-   **Stop**: These hooks are triggered when the Claude Code workflow stops. They can be used for final linting, bundle analysis, or other post-completion tasks.
-   **Notification**: These hooks are designed for activity logging and monitoring, allowing you to receive notifications about various events within the Claude Code workflow.
