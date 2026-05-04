---
name: diagrammer
description: Render clean blueprint-style SVG diagrams from JSON specs. Use when users ask to draw, sketch, or diagram a request flow, neural net, transformer block, system architecture, state machine, data pipeline, or any node-and-edge technical visual they want as an SVG for docs, READMEs, posts, or slides.
---

# diagrammer

Use `diagrammer` to turn a small JSON spec into a clean SVG diagram. It is useful when the user wants a precise technical diagram without opening a design tool.

## Install

The renderer must be installed locally:

```bash
pipx install diagrammer
```

## Workflow

1. Convert the user's plain-English diagram request into a JSON spec.
2. Save the spec to a temporary or project file.
3. Render it:

```bash
diagrammer path/to/spec.json > path/to/diagram.svg
```

4. Return the SVG path to the user.

## Spec Essentials

```json
{
  "nodes": [
    {"id": "client", "type": "box", "label": "client"},
    {"id": "api", "type": "box", "label": "api"},
    {"id": "db", "type": "database", "label": "postgres"}
  ],
  "edges": [
    {"from": "client", "to": "api", "label": "request"},
    {"from": "api", "to": "db", "label": "query"}
  ]
}
```

Built-in node types: `box`, `circle`, `text`, `database`, `stack`, `group`, `note`, and `custom`.

Useful optional fields:

- `direction`: `"LR"` or `"TB"`
- `router`: `"straight"` or `"ortho"`
- `label` on edges
- `style`: `"solid"` or `"dashed"`
- `weight`: `"thin"` or `"thick"`

For the full reference, run:

```bash
diagrammer prompt
```

## When To Choose This

Use `diagrammer` when the output should be a checked-in SVG artifact, especially for:

- README diagrams
- architecture sketches
- request flows
- state machines
- neural-net or transformer diagrams
- simple data pipelines

Prefer Mermaid when the user specifically asks for Mermaid syntax or wants diagrams rendered by a Markdown platform. Prefer Excalidraw when the user wants editable hand-drawn canvas files.
