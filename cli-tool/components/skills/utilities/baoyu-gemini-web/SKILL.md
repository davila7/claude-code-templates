---
name: baoyu-gemini-web
description: Image generation skill using Gemini Web. Generates images from text prompts via Google Gemini. Also supports text generation. Use as the image generation backend for other skills like cover-image, xhs-images, article-illustrator.
---

# Gemini Web Client

Supports:
- Text generation
- Image generation (download + save)
- Reference image upload (attach images for vision tasks)
- Multi-turn conversations within the same executor instance (`keepSession`)
- Experimental video generation (`generateVideo`) — Gemini may return an async placeholder; download might require Gemini web UI

## Quick start

```bash
npx -y bun scripts/main.ts "Hello, Gemini"
npx -y bun scripts/main.ts --prompt "Explain quantum computing"
npx -y bun scripts/main.ts --prompt "A cute cat" --image cat.png
npx -y bun scripts/main.ts --promptfiles system.md content.md --image out.png

# Multi-turn conversation (agent generates unique sessionId)
npx -y bun scripts/main.ts "Remember this: 42" --sessionId my-unique-id-123
npx -y bun scripts/main.ts "What number?" --sessionId my-unique-id-123
```

## Executor options (programmatic)

This skill is typically consumed via `createGeminiWebExecutor(geminiOptions)` (see `scripts/executor.ts`).

Key options in `GeminiWebOptions`:
- `referenceImages?: string | string[]` Upload local images as references (vision input).
- `keepSession?: boolean` Reuse Gemini `chatMetadata` to continue the same conversation across calls (required if you want reference images to persist across multiple messages).
- `generateVideo?: string` Generate a video and (best-effort) download to the given path. Gemini may return `video_gen_chip` (async); in that case you must open Gemini web UI to download the result.

Notes:
- `generateVideo` cannot be combined with `generateImage` / `editImage`.
- When `keepSession=true` and `referenceImages` is set, reference images are uploaded once per executor instance.

## Commands

### Text generation

```bash
# Simple prompt (positional)
npx -y bun scripts/main.ts "Your prompt here"

# Explicit prompt flag
npx -y bun scripts/main.ts --prompt "Your prompt here"
npx -y bun scripts/main.ts -p "Your prompt here"

# With model selection
npx -y bun scripts/main.ts -p "Hello" -m gemini-2.5-pro

# Pipe from stdin
echo "Summarize this" | npx -y bun scripts/main.ts
```

### Image generation

```bash
# Generate image with default path (./generated.png)
npx -y bun scripts/main.ts --prompt "A sunset over mountains" --image

# Generate image with custom path
npx -y bun scripts/main.ts --prompt "A cute robot" --image robot.png

# Shorthand
npx -y bun scripts/main.ts "A dragon" --image=dragon.png
```

### Output formats

```bash
# Plain text (default)
npx -y bun scripts/main.ts "Hello"

# JSON output
npx -y bun scripts/main.ts "Hello" --json
```

## Options

| Option | Description |
|--------|-------------|
| `--prompt <text>`, `-p` | Prompt text |
| `--promptfiles <files...>` | Read prompt from files (concatenated in order) |
| `--model <id>`, `-m` | Model: gemini-3-pro (default), gemini-2.5-pro, gemini-2.5-flash |
| `--image [path]` | Generate image, save to path (default: generated.png) |
| `--sessionId <id>` | Session ID for multi-turn conversation (agent generates unique ID) |
| `--list-sessions` | List saved sessions (max 100, sorted by update time) |
| `--json` | Output as JSON |
| `--login` | Refresh cookies only, then exit |
| `--cookie-path <path>` | Custom cookie file path |
| `--profile-dir <path>` | Chrome profile directory |
| `--help`, `-h` | Show help |

CLI note: `scripts/main.ts` supports text generation, image generation, and multi-turn conversations via `--sessionId`. Reference images and video generation are exposed via the executor API.

## Models

- `gemini-3-pro` - Default, latest model
- `gemini-2.5-pro` - Previous generation pro
- `gemini-2.5-flash` - Fast, lightweight

## Authentication

First run opens Chrome to authenticate with Google. Cookies are cached for subsequent runs.

```bash
# Force cookie refresh
npx -y bun scripts/main.ts --login
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `GEMINI_WEB_DATA_DIR` | Data directory |
| `GEMINI_WEB_COOKIE_PATH` | Cookie file path |
| `GEMINI_WEB_CHROME_PROFILE_DIR` | Chrome profile directory |
| `GEMINI_WEB_CHROME_PATH` | Chrome executable path |

## Examples

### Generate text response
```bash
npx -y bun scripts/main.ts "What is the capital of France?"
```

### Generate image
```bash
npx -y bun scripts/main.ts "A photorealistic image of a golden retriever puppy" --image puppy.png
```

### Get JSON output for parsing
```bash
npx -y bun scripts/main.ts "Hello" --json | jq '.text'
```

### Generate image from prompt files
```bash
# Concatenate system.md + content.md as prompt
npx -y bun scripts/main.ts --promptfiles system.md content.md --image output.png
```

### Multi-turn conversation
```bash
# Start a session with unique ID (agent generates this)
npx -y bun scripts/main.ts "You are a helpful math tutor." --sessionId task-abc123

# Continue the conversation (remembers context)
npx -y bun scripts/main.ts "What is 2+2?" --sessionId task-abc123
npx -y bun scripts/main.ts "Now multiply that by 10" --sessionId task-abc123

# List recent sessions (max 100, sorted by update time)
npx -y bun scripts/main.ts --list-sessions
```

Session files are stored in `~/Library/Application Support/baoyu-skills/gemini-web/sessions/<id>.json` and contain:
- `id`: Session ID
- `metadata`: Gemini chat metadata for continuation
- `messages`: Array of `{role, content, timestamp, error?}`
- `createdAt`, `updatedAt`: Timestamps
