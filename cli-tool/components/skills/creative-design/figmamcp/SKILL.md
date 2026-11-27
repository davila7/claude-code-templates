---
name: figmamcp
description: >-
  Use when reading or editing a Figma file through the figmamcp server —
  inspecting nodes; creating or modifying shapes, frames, text, styles,
  variables, components, instances, annotations, or prototype reactions; and
  recovering from the server's structured errors. Explains the plugin's hard
  constraints (scope locking, name verification, batch validation) and how to
  pick the right tool.
---

# figmamcp

figmamcp lets an agent read and edit a live Figma document through a plugin that **enforces** safety constraints at execution time. Two things to internalize before acting:

1. **Discover before acting.** Every workflow that touches a node starts with a read (`page_info` → `node_info`). IDs and names the user gives you may be stale; verify them.
2. **The plugin can refuse you.** Hard constraints (scope, name verification, per-item batch checks) are checked inside Figma and return structured error codes. There is no way around them — plan calls to comply up front.
3. **Explicit variable scopes.** When creating a new variable, you **must** explicitly provide its `scopes`.

## References

Load the one you need:

- **[references/constraints.md](references/constraints.md)** — the hard rules the plugin enforces (scope locking, name verification, no implicit selection, batch validation, URL IDs) and what to do when a constraint forbids the request.
- **[references/error-playbook.md](references/error-playbook.md)** — every structured error code and its correct recovery.
- **[references/workflows.md](references/workflows.md)** — the discover-before-acting pattern and canonical recipes (find-and-update text, create-in-frame, edit-by-URL, bulk text replacement).
- **[references/tool-selection.md](references/tool-selection.md)** — choosing among overlapping tools, `node_info` field selection (fast vs slow), batch vs single, and streaming progress.

The same content is available over the MCP connection as resources under `figmamcp://guide/*`.
