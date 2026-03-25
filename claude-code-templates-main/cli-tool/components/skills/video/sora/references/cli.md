# CLI reference (`scripts/sora.py`)

This file contains the command catalog for the bundled video generation CLI. Keep `SKILL.md` overview-first; put verbose CLI details here.

## What this CLI does
- `create`: create a new video job (async)
- `create-and-poll`: create a job, poll until complete, optionally download
- `poll`: wait for an existing job to finish
- `status`: retrieve job status/details
- `download`: download video/thumbnail/spritesheet
- `list`: list recent jobs
- `delete`: delete a job
- `remix`: remix a completed video
- `create-batch`: create multiple jobs from a JSONL file

Real API calls require **network access** + `OPENAI_API_KEY`. `--dry-run` does not.

## Quick start (works from any repo)
Set a stable path to the skill CLI (default `CODEX_HOME` is `~/.codex`):

```
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export SORA_CLI="$CODEX_HOME/skills/sora/scripts/sora.py"
```

If you're in this repo, you can set the path directly:

```
# Use repo root (tests run from output/* so $PWD is not the root)
export SORA_CLI="$(git rev-parse --show-toplevel)/<path-to-skill>/scripts/sora.py"
```

If `git` isn't available, set `SORA_CLI` to the absolute path to `<path-to-skill>/scripts/sora.py`.

If uv cache fails with permission errors, set a writable cache:

```
export UV_CACHE_DIR="/tmp/uv-cache"
```

Dry-run (no API call; no network required; does not require the `openai` package):

```
python "$SORA_CLI" create --prompt "Test" --dry-run
```

Preflight a full prompt without running the API:

```
python "$SORA_CLI" create --prompt-file prompt.txt --dry-run --json-out out/request.json
```

Create a job (requires `OPENAI_API_KEY` + network):

```
uv run --with openai python "$SORA_CLI" create \
  --model sora-2 \
  --prompt "Wide tracking shot of a teal coupe on a desert highway" \
  --size 1280x720 \
  --seconds 8
```

Create from a prompt file (avoids shell-escaping issues for multi-line prompts):

```
cat > prompt.txt << 'EOF'
Use case: landing page hero
Primary request: a matte black camera on a pedestal
Action: slow 30-degree orbit over 4 seconds
Camera: 85mm, shallow depth of field
Lighting/mood: soft key light, subtle rim
Constraints: no logos, no text
EOF

uv run --with openai python "$SORA_CLI" create \
  --prompt-file prompt.txt \
  --size 1280x720 \
  --seconds 4
```

If your prompt file is already structured (Use case/Scene/Camera/etc), disable tool augmentation:

```
uv run --with openai python "$SORA_CLI" create \
  --prompt-file prompt.txt \
  --no-augment \
  --size 1280x720 \
  --seconds 4
```

Create + poll + download:

```
uv run --with openai python "$SORA_CLI" create-and-poll \
  --model sora-2-pro \
  --prompt "Close-up of a steaming coffee cup on a wooden table" \
  --size 1280x720 \
  --seconds 8 \
  --download \
  --variant video \
  --out coffee.mp4
```

Create + poll + write JSON bundle:

```
uv run --with openai python "$SORA_CLI" create-and-poll \
  --prompt "Minimal product teaser of a matte black camera" \
  --json-out out/coffee-job.json
```

Remix a completed video:

```
uv run --with openai python "$SORA_CLI" remix \
  --id video_abc123 \
  --prompt "Same shot, shift palette to teal/sand/rust with warm backlight."
```

Download a thumbnail or spritesheet:

```
uv run --with openai python "$SORA_CLI" download --id video_abc123 --variant thumbnail --out thumb.webp
uv run --with openai python "$SORA_CLI" download --id video_abc123 --variant spritesheet --out sheet.jpg
```

## Guardrails (important)
- Use `python "$SORA_CLI" ...` (or equivalent full path) for all video work.
- For API calls, prefer `uv run --with openai ...` to avoid missing SDK errors.
- Do **not** create one-off runners unless the user explicitly asks.
- **Never modify** `scripts/sora.py` unless the user asks.

## Defaults (unless overridden by flags)
- Model: `sora-2`
- Size: `1280x720`
- Seconds: `4` (API expects a string enum: "4", "8", "12")
- Variant: `video`
- Poll interval: `10` seconds

## JSON output (`--json-out`)
- For `create`, `status`, `list`, `delete`, `poll`, and `remix`, `--json-out` writes the JSON response to a file.
- For `create-and-poll`, `--json-out` writes a bundle: `{ "create": ..., "final": ... }`.
- If the path has no extension, `.json` is added automatically.
- In `--dry-run`, `--json-out` writes the request preview instead of a response.

## Input reference images
- Must be jpg/png/webp; they should match the target size.
- Provide the path with `--input-reference`.

## Optional deps
Prefer `uv run --with ...` for an out-of-the-box run without changing the current project env; otherwise install into your active env:

```
uv pip install openai
```

## JSONL schema for `create-batch`
Each line is a JSON object (or a raw prompt string). Required key: `prompt`.

Top-level override keys:
- `model`, `size`, `seconds`
- `input_reference` (path)
- `out` (optional output filename for the job JSON)

Prompt augmentation keys (top-level or under `fields`):
- `use_case`, `scene`, `subject`, `action`, `camera`, `style`, `lighting`, `palette`, `audio`, `dialogue`, `text`, `timing`, `constraints`, `negative`

Notes:
- `fields` merges into the prompt augmentation inputs.
- Top-level keys override CLI defaults.
- `seconds` must be one of: "4", "8", "12".

## Common recipes

Create with prompt augmentation fields:

```
uv run --with openai python "$SORA_CLI" create \
  --prompt "A minimal product teaser shot of a matte black camera" \
  --use-case "landing page hero" \
  --camera "85mm, slow orbit" \
  --lighting "soft key, subtle rim" \
  --constraints "no logos, no text"
```

Two-variant workflow (base + remix):

```
# 1) Base clip
uv run --with openai python "$SORA_CLI" create-and-poll \
  --prompt "Ceramic mug on a sunlit wooden table in a cozy cafe" \
  --size 1280x720 --seconds 4 --download --out output.mp4

# 2) Remix with invariant (same shot, change only the drink)
uv run --with openai python "$SORA_CLI" remix \
  --id video_abc123 \
  --prompt "Same shot and framing; replace the mug with an iced americano in a glass, visible ice and condensation."

# 3) Poll and download the remix
uv run --with openai python "$SORA_CLI" poll \
  --id video_def456 --download --out remix.mp4
```

Poll and download after a job finishes:

```
uv run --with openai python "$SORA_CLI" poll --id video_abc123 --download --variant video --out out.mp4
```

Write JSON response to a file:

```
uv run --with openai python "$SORA_CLI" status --id video_abc123 --json-out out/status.json
```

Batch create (JSONL input):

```
mkdir -p tmp/sora
cat > tmp/sora/prompts.jsonl << 'EOB'
{"prompt":"A neon-lit rainy alley, slow dolly-in","seconds":"4"}
{"prompt":"A warm sunrise over a misty lake, gentle pan","seconds":"8",
 "fields":{"camera":"35mm, slow pan","lighting":"soft dawn light"}}
EOB

uv run --with openai python "$SORA_CLI" create-batch --input tmp/sora/prompts.jsonl --out-dir out --concurrency 3

# Cleanup (recommended)
rm -f tmp/sora/prompts.jsonl
```

Notes:
- `create-batch` writes one JSON response per job under `--out-dir`.
- Output names default to `NNN-<prompt-slug>.json`.
- Use `--concurrency` to control parallelism (default `3`). Higher concurrency can hit rate limits.
- Treat the JSONL file as temporary: write it under `tmp/` and delete it after the run (do not commit it). If `rm` is blocked in your sandbox, skip cleanup or truncate the file.

## CLI notes
- Supported sizes depend on model (see `references/video-api.md`).
- Seconds are limited to 4, 8, or 12.
- Download URLs expire after about 1 hour; copy assets to your own storage.
- In CI/sandboxes where long-running commands time out, prefer `create` + `poll` (or add `--timeout`).

## See also
- API parameter quick reference: `references/video-api.md`
- Prompt structure and examples: `references/prompting.md`
- Sample prompts: `references/sample-prompts.md`
- Troubleshooting: `references/troubleshooting.md`
