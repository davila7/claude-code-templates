---
name: "speech"
description: "Use when the user asks for text-to-speech narration or voiceover, accessibility reads, audio prompts, or batch speech generation via the OpenAI Audio API; run the bundled CLI (`scripts/text_to_speech.py`) with built-in voices and require `OPENAI_API_KEY` for live calls. Custom voice creation is out of scope."
author: openai
---


# Speech Generation Skill

Generate spoken audio for the current project (narration, product demo voiceover, IVR prompts, accessibility reads). Defaults to `gpt-4o-mini-tts-2025-12-15` and built-in voices, and prefers the bundled CLI for deterministic, reproducible runs.

## When to use
- Generate a single spoken clip from text
- Generate a batch of prompts (many lines, many files)

## Decision tree (single vs batch)
- If the user provides multiple lines/prompts or wants many outputs -> **batch**
- Else -> **single**

## Workflow
1. Decide intent: single vs batch (see decision tree above).
2. Collect inputs up front: exact text (verbatim), desired voice, delivery style, format, and any constraints.
3. If batch: write a temporary JSONL under tmp/ (one job per line), run once, then delete the JSONL.
4. Augment instructions into a short labeled spec without rewriting the input text.
5. Run the bundled CLI (`scripts/text_to_speech.py`) with sensible defaults (see references/cli.md).
6. For important clips, validate: intelligibility, pacing, pronunciation, and adherence to constraints.
7. Iterate with a single targeted change (voice, speed, or instructions), then re-check.
8. Save/return final outputs and note the final text + instructions + flags used.

## Temp and output conventions
- Use `tmp/speech/` for intermediate files (for example JSONL batches); delete when done.
- Write final artifacts under `output/speech/` when working in this repo.
- Use `--out` or `--out-dir` to control output paths; keep filenames stable and descriptive.

## Dependencies (install if missing)
Prefer `uv` for dependency management.

Python packages:
```
uv pip install openai
```
If `uv` is unavailable:
```
python3 -m pip install openai
```

## Environment
- `OPENAI_API_KEY` must be set for live API calls.

If the key is missing, give the user these steps:
1. Create an API key in the OpenAI platform UI: https://platform.openai.com/api-keys
2. Set `OPENAI_API_KEY` as an environment variable in their system.
3. Offer to guide them through setting the environment variable for their OS/shell if needed.
- Never ask the user to paste the full key in chat. Ask them to set it locally and confirm when ready.

If installation isn't possible in this environment, tell the user which dependency is missing and how to install it locally.

## Defaults & rules
- Use `gpt-4o-mini-tts-2025-12-15` unless the user requests another model.
- Default voice: `cedar`. If the user wants a brighter tone, prefer `marin`.
- Built-in voices only. Custom voices are out of scope for this skill.
- `instructions` are supported for GPT-4o mini TTS models, but not for `tts-1` or `tts-1-hd`.
- Input length must be <= 4096 characters per request. Split longer text into chunks.
- Enforce 50 requests/minute. The CLI caps `--rpm` at 50.
- Require `OPENAI_API_KEY` before any live API call.
- Provide a clear disclosure to end users that the voice is AI-generated.
- Use the OpenAI Python SDK (`openai` package) for all API calls; do not use raw HTTP.
- Prefer the bundled CLI (`scripts/text_to_speech.py`) over writing new one-off scripts.
- Never modify `scripts/text_to_speech.py`. If something is missing, ask the user before doing anything else.

## Instruction augmentation
Reformat user direction into a short, labeled spec. Only make implicit details explicit; do not invent new requirements.

Quick clarification (augmentation vs invention):
- If the user says "narration for a demo", you may add implied delivery constraints (clear, steady pacing, friendly tone).
- Do not introduce a new persona, accent, or emotional style the user did not request.

Template (include only relevant lines):
```
Voice Affect: <overall character and texture of the voice>
Tone: <attitude, formality, warmth>
Pacing: <slow, steady, brisk>
Emotion: <key emotions to convey>
Pronunciation: <words to enunciate or emphasize>
Pauses: <where to add intentional pauses>
Emphasis: <key words or phrases to stress>
Delivery: <cadence or rhythm notes>
```

Augmentation rules:
- Keep it short; add only details the user already implied or provided elsewhere.
- Do not rewrite the input text.
- If any critical detail is missing and blocks success, ask a question; otherwise proceed.

## Examples

### Single example (narration)
```
Input text: "Welcome to the demo. Today we'll show how it works."
Instructions:
Voice Affect: Warm and composed.
Tone: Friendly and confident.
Pacing: Steady and moderate.
Emphasis: Stress "demo" and "show".
```

### Batch example (IVR prompts)
```
{"input":"Thank you for calling. Please hold.","voice":"cedar","response_format":"mp3","out":"hold.mp3"}
{"input":"For sales, press 1. For support, press 2.","voice":"marin","instructions":"Tone: Clear and neutral. Pacing: Slow.","response_format":"wav"}
```

## Instructioning best practices (short list)
- Structure directions as: affect -> tone -> pacing -> emotion -> pronunciation/pauses -> emphasis.
- Keep 4 to 8 short lines; avoid conflicting guidance.
- For names/acronyms, add pronunciation hints (e.g., "enunciate A-I") or supply a phonetic spelling in the text.
- For edits/iterations, repeat invariants (e.g., "keep pacing steady") to reduce drift.
- Iterate with single-change follow-ups.

More principles: `references/prompting.md`. Copy/paste specs: `references/sample-prompts.md`.

## Guidance by use case
Use these modules when the request is for a specific delivery style. They provide targeted defaults and templates.
- Narration / explainer: `references/narration.md`
- Product demo / voiceover: `references/voiceover.md`
- IVR / phone prompts: `references/ivr.md`
- Accessibility reads: `references/accessibility.md`

## CLI + environment notes
- CLI commands + examples: `references/cli.md`
- API parameter quick reference: `references/audio-api.md`
- Instruction patterns + examples: `references/voice-directions.md`
- If network approvals / sandbox settings are getting in the way: `references/codex-network.md`

## Reference map
- **`references/cli.md`**: how to run speech generation/batches via `scripts/text_to_speech.py` (commands, flags, recipes).
- **`references/audio-api.md`**: API parameters, limits, voice list.
- **`references/voice-directions.md`**: instruction patterns and examples.
- **`references/prompting.md`**: instruction best practices (structure, constraints, iteration patterns).
- **`references/sample-prompts.md`**: copy/paste instruction recipes (examples only; no extra theory).
- **`references/narration.md`**: templates + defaults for narration and explainers.
- **`references/voiceover.md`**: templates + defaults for product demo voiceovers.
- **`references/ivr.md`**: templates + defaults for IVR/phone prompts.
- **`references/accessibility.md`**: templates + defaults for accessibility reads.
- **`references/codex-network.md`**: environment/sandbox/network-approval troubleshooting.
