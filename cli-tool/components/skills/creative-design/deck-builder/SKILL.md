---
name: deck-builder
description: Builds single-file, type-correct HTML decks (pitch, sales, launch, keynote, all-hands) from a one-line brief, with PDF and PPTX import and inline editing. Use when a user needs a presentation-ready slide deck from a short brief, or wants to turn an existing PDF or PPTX deck into an editable HTML one.
---

# FluidDocs Deck Builder

Build a real, presentation-ready slide deck from a short brief, or turn an existing PDF or PPTX deck into a navigable, inline-editable HTML one.

## When to Use This Skill

Use this skill when the user:
- Needs a slide deck from a one-line brief (pitch, sales, launch, keynote, all-hands)
- Wants to convert an existing PDF or PPTX deck into editable HTML
- Asks for an offline, shareable, single-file deck with no build step

## What It Does

Builds one self-contained HTML file per deck on a fixed 1440x810 canvas, with a content spine specific to the deck type, so the structure is correct (a pitch is not a sales deck is not an all-hands). It can import a PDF or PPTX and rebuild it as a navigable, inline-editable HTML deck with the original screenshots preserved. A three-reviewer pass (Brand, Copy, Layout) runs before output. No build step, no dependencies.

## How to Use

1. Give a one-line brief describing the deck type and topic.
2. To import, point it at a PDF or PPTX and ask it to rebuild as HTML.
3. In the output, press E to edit any element inline and Ctrl+S to save a new file.

## Example

Prompt: "Build a 14-slide seed pitch for Switchboard, an observability layer for LLM workloads."

Output: a single switchboard-pitch.html file you can open offline, arrow-key through, and edit inline.

## Source

Open source (MIT): https://github.com/FluidForm-ai/fluiddocs-deck-builder
