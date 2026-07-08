---
name: "luma-imagegen"
description: "Use when the user asks to generate images via the Luma AI API (Dream Machine / Photon); collects a prompt and options interactively, then calls the API using the bundled script. Requires LUMA_API_KEY — will prompt the user if missing."
author: lumalabs
---

# Luma Image Generation Skill

Generates images using the Luma AI Photon model (Dream Machine API). Handles API key detection, interactive prompt collection, parameter selection, async polling, and final image download — all via the bundled `scripts/luma_imagegen.py` CLI.

## When to use
- Generate a new image from a text description using Luma AI (Photon / Photon Flash)
- Use a reference image to guide style, structure, or character consistency
- Modify or stylize an existing image using Luma's `modify_image_ref`

## Workflow

1. **Check API key** — detect `LUMA_API_KEY` in environment. If missing, guide the user (see below).
2. **Collect inputs** — ask the user for: prompt, aspect ratio, model choice, and any optional reference images.
3. **Build the structured prompt** — augment the user's description into a labeled spec (see prompt template below).
4. **Run the bundled CLI** — execute `scripts/luma_imagegen.py` with the collected parameters.
5. **Poll until complete** — the script handles async polling automatically; wait for `state: completed`.
6. **Display result** — show the final image URL and download the image to `output/luma/`.
7. **Iterate** — if the result doesn't match expectations, adjust the prompt and re-run.

## API key detection & setup

Before any API call, check for the key:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/luma_imagegen.py --check-key
```

If `LUMA_API_KEY` is missing:
1. Tell the user the key is not set.
2. Direct them to generate one: https://lumalabs.ai/dream-machine/api/keys
3. Ask them to add it to their `.env` file or export it in their shell:
   ```bash
   export LUMA_API_KEY=your_key_here
   ```
4. **Never ask the user to paste the key in chat.** Ask them to set it locally and confirm when ready.
5. Once confirmed, retry the `--check-key` command to verify.

## Interactive questions to ask the user

Ask these questions before running the generation:

1. **Prompt** *(required)*: "What image do you want to generate? Describe the scene, subject, style, and any important details."
2. **Aspect ratio** *(optional, default `16:9`)*: "What aspect ratio? Options: `1:1`, `3:4`, `4:3`, `9:16`, `16:9` (default), `9:21`, `21:9`"
3. **Model** *(optional, default `photon-1`)*: "Use `photon-1` (higher quality) or `photon-flash-1` (faster and cheaper)?"
4. **Reference image** *(optional)*: "Do you have a reference image URL for style or structure guidance?"

Only ask what's needed — skip questions the user has already answered in their message.

## Running the CLI

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/luma_imagegen.py \
  --prompt "YOUR AUGMENTED PROMPT" \
  --aspect-ratio 16:9 \
  --model photon-1 \
  [--image-ref "https://example.com/ref.jpg" --image-ref-weight 0.85] \
  [--out output/luma/]
```

All flags:
| Flag | Default | Description |
|------|---------|-------------|
| `--prompt` | *(required)* | Text description of the image |
| `--aspect-ratio` | `16:9` | `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `9:21`, `21:9` |
| `--model` | `photon-1` | `photon-1` or `photon-flash-1` |
| `--image-ref` | — | Public URL for style/structure reference |
| `--image-ref-weight` | `0.85` | Weight of reference image (0.0–1.0) |
| `--modify-ref` | — | Base image URL to modify |
| `--modify-ref-weight` | `0.5` | Weight for modification fidelity |
| `--out` | `output/luma/` | Output directory for downloaded images |
| `--poll-interval` | `3` | Seconds between polling requests |
| `--check-key` | — | Verify LUMA_API_KEY is set and exit |

## Output conventions
- Save final images to `output/luma/` with descriptive filenames (e.g., `photon1_hero_16x9.png`). The output directory is relative to the current working directory when the script is invoked.
- Log the generation ID for reference (useful to retrieve the image later).
- If the generation fails, show the `failure_reason` from the API response.

## Prompt augmentation

Reformat the user's description into a structured spec. Only make implied details explicit — do not invent new requirements.

Template (include only relevant lines):
```
Primary request: <user's main prompt>
Scene/background: <environment or setting>
Subject: <main subject>
Style/medium: <photo/illustration/3D/cinematic/etc>
Composition/framing: <wide/close-up/overhead; subject placement>
Lighting/mood: <lighting type and emotional tone>
Color palette: <dominant colors or palette notes>
Aspect ratio: <e.g., 16:9 landscape>
Avoid: <elements to exclude>
```

Augmentation rules:
- Keep it concise — add only what the user implied or provided.
- Always include "Avoid:" to prevent common quality issues (watermarks, logos, blur).
- For modification requests, explicitly list what should change and what must stay the same.

## Example augmented prompts

### Landscape hero image
```
Primary request: a misty mountain lake at sunrise
Scene/background: alpine lake surrounded by pine trees, light morning fog
Style/medium: photorealistic nature photography
Composition/framing: wide panoramic, lake centered, mountains in background
Lighting/mood: golden hour, warm and serene
Aspect ratio: 16:9 landscape
Avoid: people, boats, watermarks, oversaturation
```

### Product shot
```
Primary request: a ceramic coffee mug on a wooden table
Scene/background: warm kitchen interior, soft bokeh background
Subject: minimalist white ceramic mug, steam rising
Style/medium: clean product photography
Lighting/mood: soft diffused window light
Aspect ratio: 1:1 square
Avoid: text, logos, harsh shadows, clutter
```

## Prompting best practices
- Describe scene → subject → style → composition → lighting.
- Mention the intended use (hero image, social post, product shot) to calibrate detail level.
- Use "Avoid:" to eliminate common defects (watermarks, blur, stock-photo clichés).
- For modifications, list invariants explicitly ("change only the background; keep the mug unchanged").
- Start with `photon-flash-1` for quick iteration; switch to `photon-1` for final quality.
- If the result isn't satisfactory, make one targeted change per iteration.

## Models reference
| Model | Speed | Quality | Best for |
|-------|-------|---------|----------|
| `photon-1` | Slower | Higher | Final assets, complex scenes |
| `photon-flash-1` | Fast | Good | Rapid iteration, drafts |

## Dependencies
The script uses only the Python standard library. No additional packages are required.
