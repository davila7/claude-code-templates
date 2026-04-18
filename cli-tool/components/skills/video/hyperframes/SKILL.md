---
name: hyperframes
description: HTML-native video composition framework by HeyGen. Write HTML, render video, built for AI agents with GSAP animations, captions, TTS, and deterministic rendering
repo: https://github.com/heygen-com/hyperframes
license: Apache-2.0
tags: [Video, HTML, GSAP, Animation, HeyGen, TTS, Captions, AI-Agents, Composition, Rendering]
---

# hyperframes

## Overview

HyperFrames is HeyGen's open-source video rendering framework that lets you create video compositions using plain HTML with `data-*` attributes. Built for AI agents, it supports GSAP animations, Lottie, CSS transitions, Three.js, captions, TTS and deterministic MP4 rendering.

Tagline: **"Write HTML. Render video. Built for agents."**

## When to Use

- When you want to generate videos programmatically without React or a custom DSL
- When you need AI-agent-optimized video workflows (init, lint, preview, render, transcribe)
- When you want deterministic output from HTML + data attributes
- When you need multi-scene compositions with GSAP timelines
- When you want to turn prompts like "10-second product intro with fade-in title" into rendered MP4s
- When you need audio-reactive animations, captions, or TTS synced to the timeline

## Requirements

- Node.js >= 22
- FFmpeg installed and available on PATH

## Installation

Install the official HeyGen skill into your Claude Code setup:

```bash
npx skills add heygen-com/hyperframes
```

This registers the skill locally so Claude can use it when generating or editing HyperFrames compositions.

## Step-by-Step Guide

1. Install the skill with the command above
2. Scaffold a new composition project:
   ```bash
   npx hyperframes init my-video
   cd my-video
   ```
3. Preview with live reload in the browser:
   ```bash
   npx hyperframes preview
   ```
4. Lint and validate before rendering:
   ```bash
   npx hyperframes lint
   npx hyperframes validate
   ```
5. Render to MP4:
   ```bash
   npx hyperframes render
   ```

## Core Concepts

- **HTML compositions**: Clips defined with `data-duration`, `data-start`, and related `data-*` attributes
- **GSAP timelines**: Registered on `window.__timelines["<composition-id>"]`, always created with `{ paused: true }`
- **Frame Adapter pattern**: Pluggable animation runtimes (GSAP, Lottie, CSS, Three.js)
- **Deterministic rendering**: Same input HTML always produces the same MP4 output
- **Hero-frame-first layout**: Write the static CSS for each scene's most-visible moment, then add `gsap.from()` entrances

## Critical Rules

- Always establish a visual identity first (`DESIGN.md`, `visual-style.md`, or ask the user)
- Every scene element must animate IN via entrance tweens — no jump cuts
- No exit animations except on the final scene (transitions handle exits)
- Never use `Math.random()`, time-based logic, or `repeat: -1` (breaks deterministic capture)
- Never animate `visibility` or `display`, and never call media methods manually
- Build timelines synchronously — no `async`, `setTimeout`, or Promises inside timeline construction
- Register every timeline on `window.__timelines` so the renderer can drive playback

## Example Prompts

Once the skill is installed, Claude can handle requests like:

- "Create a 10-second product intro with a fade-in title and background music"
- "Turn this CSV into an animated bar chart race"
- "Make a 9:16 TikTok-style hook video about [topic]"
- "Make the title 2x bigger and add a fade-out on the final scene"

## Best Practices

- Run `npx hyperframes lint` and `npx hyperframes validate` before every render
- Enforce WCAG contrast (4.5:1 normal text, 3:1 large text) — address warnings, don't ignore them
- Use `max-width` for text wrapping, never `<br>`
- Keep background music and voiceover as top-level audio clips, not nested inside timed divs
- Commit `DESIGN.md` so style stays consistent across renders and team members

## References

- Official repository: https://github.com/heygen-com/hyperframes
- Companion skills registered alongside hyperframes: `gsap`, `hyperframes-cli`, `hyperframes-registry`, `website-to-hyperframes`
- Related skill in this catalog: `skills/development/heygen-best-practices` (for the HeyGen avatar API)
