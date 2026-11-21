---
name: openagent
description: Give an AI agent a portable identity with OpenAgent (5dive-ai/openagent), an open spec for agent identity. Writes and validates a signed `<id>.persona.yaml` (name, role, face, voice, writing style), renders it as a trading card, installs it into Claude Code's CLAUDE.md, and moves an agent's persona, skills and memory to another harness. Use when the user asks to name the agent or give it a persona, make an OpenAgent card, check a persona file, or move an agent between Claude Code, Codex, Hermes and OpenClaw.
---

# OpenAgent (5dive-ai/openagent)

OpenAgent is an open spec (MIT) for an agent's identity. One `<id>.persona.yaml` file holds how the agent looks, sounds and writes, so it can be carried between Claude Code, Codex, Hermes and OpenClaw. The `@5dive/openagent` CLI writes the file, validates it against the spec's JSON Schema, renders it as a card and installs it.

Spec and source: https://github.com/5dive-ai/openagent

Run the CLI from npm with `npx`, pinned to a version:

```bash
npx -y @5dive/openagent@0.62.0 --help
```

## Before you run anything

- **Work in a folder you own.** The CLI writes the persona file, the card and a `faces/` folder into the current directory.
- **This skill keeps publishing opt-in.** The CLI's default is to publish: `init` publishes a signed public profile on openagent.5dive.ai unless you pass `--no-publish`. Pass `--no-publish` unless the user has said yes to a public profile.
- **The key is a secret.** `init` creates a signing key at `~/.openagent/agent.key` (mode 0600) and signs the persona with it. Never print it, paste it or commit it, and add `*.key` to `.gitignore` if the user's persona lives in a repo. `--no-sign` skips the key.
- **Ask before editing global files.** `install --to=claude-code` adds a marked block to the top of `~/.claude/CLAUDE.md`. Show the `--dry-run` output first and run it only when the user agrees.

## 1. Ask two questions

Ask in a plain chat message, not an interactive picker:

1. What name should the agent carry?
2. Is there a photo or avatar to use as its face?

If the user says it's your call, pick a sensible name and go on without a face; the card falls back to a monogram.

## 2. Create the persona

```bash
npx -y @5dive/openagent@0.62.0 init --yes --no-publish \
  --name "Ada" --role "Release engineer" \
  --vibe "Calm under pressure; reads the diff before the summary." \
  --voice "short sentences" --voice "names the risk first" \
  --sample "Shipped. One flaky test left, ticket filed." \
  --face "woman in her 30s, short dark hair, soft studio light, head and shoulders" \
  -o ada.persona.yaml
```

`--vibe` becomes `behavior`, each `--voice` adds a writing rule, `--face` is the one-sentence look (`face.anchor`), and `--face-ref <path|url>` sets the portrait. Without `--yes` and with a terminal, `init` asks its own five questions instead (name, job, face, voice, vibe).

Already have an identity in a harness? `init --from claude-code` (or `codex`, `hermes`, `openclaw`) reads the name and role that harness already uses. A flag you pass wins, and `init` fills only what is missing.

## 3. Validate

```bash
npx -y @5dive/openagent@0.62.0 validate ada.persona.yaml
```

Exit 0 means valid. The schema rejects unknown keys, so fix every error it prints and run it again.

## 4. Render the card

```bash
npx -y @5dive/openagent@0.62.0 card ada.persona.yaml -o ada.png   # still image
npx -y @5dive/openagent@0.62.0 card ada.persona.yaml -o ada.mp4   # animated (mp4 needs ffmpeg; without it the CLI writes an APNG)
```

Open the rendered file and look at it before you share it. The card shows `behavior`, `voice.audio.style` and `voice.written.sample` on about two lines each and cuts the rest with "…", so keep each to one sentence of about 110 characters, with the point first.

The card carries a rarity tier (Common, Rare, Epic, Legendary) rolled from the agent's signing key. It is fixed for that key, and filling in more fields does not change it. An unsigned persona shows as Ungraded.

## 5. The face

Pick the face in this order:

1. **The user's photo or avatar.**
2. **A portrait from an image tool you already have.** Prompt: "Photorealistic head-and-shoulders portrait of <who the agent is>. Centered, facing the camera, soft even studio lighting, simple clean background, 1:1 square, no text, no logos." Record it under `face.recipe` (`model` and `prompt` are required, `provider` and `seed` are optional) so it can be made again.
3. **No face.** The card renders a monogram.

Don't draw the face as SVG or ASCII art yourself. `face.ref` takes an image URL, which `card` downloads without logging in, or a file path, read next to the persona file. A path only works where that file exists, so use a URL that opens without a login if the persona will be rendered anywhere else.

## 6. Install it into Claude Code (optional)

```bash
npx -y @5dive/openagent@0.62.0 install --to=claude-code ada.persona.yaml --dry-run   # show what it would write
npx -y @5dive/openagent@0.62.0 install --to=claude-code ada.persona.yaml --yes
npx -y @5dive/openagent@0.62.0 install --to=claude-code --remove --yes                # take it back out
```

It adds a marked block above whatever `~/.claude/CLAUDE.md` already holds and leaves the rest of the file as it was. The block tells Claude Code to answer as the persona when asked who it is, from the next session on. `--to=codex|hermes|openclaw` writes the file each of those reads.

## 7. Move an agent to another harness

```bash
npx -y @5dive/openagent@0.62.0 export --from=claude-code --memory --persona ada.persona.yaml -o agent.tar.gz
npx -y @5dive/openagent@0.62.0 import agent.tar.gz --to=codex --dry-run
```

Export reads the persona from the block step 6 installed, or from `--persona <file>`. The bundle holds the persona, the skills and, with `--memory`, the memory files, copied as they are. Export refuses to build a bundle with a secret-shaped string in it (an API key, token, private key or password) and names the file and line.

## Persona fields

Required: `id` (lowercase letters, digits and hyphens only), `name`, `role`, `face.ref`, `face.anchor`, `voice`, `behavior`. `init` fills all of them.

```yaml
openagent: "0.2"
id: ada
name: Ada
role: Release engineer
face:
  ref: https://example.com/faces/ada.png
  anchor: "woman in her 30s, short dark hair, soft studio light, head and shoulders"
voice:
  audio:
    base: Kore            # a Gemini prebuilt TTS voice name
    style: "Even pace, low energy, dry."
  written:
    rules: ["short sentences", "names the risk first"]
    sample: "Shipped. One flaky test left, ticket filed."
behavior: "Calm under pressure; reads the diff before the summary."
posts_about: ["releases", "CI"]
links:
  profile: https://example.com/ada
```

Write the human-readable fields in the language the user speaks. Leave `id` in its fixed format and `voice.audio.base` as a voice name. Re-render the card after every edit; if you edit a signed file, run `sign` again so `verify` still passes.

## More commands

`npx -y @5dive/openagent@0.62.0 --help` lists the rest: `speak` (read a line in the persona's voice, needs `GEMINI_API_KEY`), `flow` (a scene prompt for video tools such as Flow, Veo or Runway, plus the face reference images that keep the face the same across clips), `sign` (writes an ed25519 signature over the file) and `verify` (checks it), `doctor`, and `card --to-charactercard` (export as a SillyTavern/Chub character card).
